// POST /api/mensajes — Recibe un mensaje del usuario, ejecuta el router, devuelve respuesta
// Este es el endpoint principal que integra router + IA + consumo + saldo + alertas

import { Router, Request, Response } from 'express';
import prisma from '../db/prisma';
import { clasificarConsulta } from '../services/router';
import { generarRespuesta, MensajeHistorial } from '../services/ia';
import { calcularCostoConversacion } from '../services/consumo';
import { calcularRecargaDiaria } from '../services/saldo';
import { asegurarSaldoDeHoy, registrarConsumoDiario } from '../services/saldoDiario';
import { evaluarYRegistrarAlerta } from '../services/alertas';
import { obtenerConfiguracion } from '../services/configuracion';
import { obtenerUsuarioDemo } from '../services/datosBase';

const router = Router();

const MAX_LONGITUD_MENSAJE = 2000;
const MENSAJES_DE_CONTEXTO = 20;

interface MensajeBody {
  userId?: number;
  conversacionId?: number;
  contenido?: unknown;
}

router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, conversacionId, contenido: contenidoRaw } = (req.body ?? {}) as MensajeBody;
    const contenido = typeof contenidoRaw === 'string' ? contenidoRaw.trim() : '';

    if (!contenido) {
      res.status(400).json({ error: 'El campo "contenido" es requerido' });
      return;
    }
    if (contenido.length > MAX_LONGITUD_MENSAJE) {
      res.status(400).json({ error: `El mensaje supera los ${MAX_LONGITUD_MENSAJE} caracteres` });
      return;
    }

    // 1. Obtener o crear conversación
    let conversacion;
    if (conversacionId) {
      conversacion = await prisma.conversacion.findUnique({
        where: { id: Number(conversacionId) },
        include: { handoff: { include: { agente: true } } },
      });
      if (!conversacion) {
        res.status(404).json({ error: 'Conversación no encontrada' });
        return;
      }
    } else {
      // El prototipo no tiene login: si el usuario no existe se usa el usuario demo
      const usuario =
        (userId && (await prisma.usuario.findUnique({ where: { id: Number(userId) } }))) ||
        (await obtenerUsuarioDemo());

      conversacion = await prisma.conversacion.create({
        data: { idUsuario: usuario.id },
        include: { handoff: { include: { agente: true } } },
      });
    }

    // 2. Guardar mensaje del usuario
    const mensajeUsuario = await prisma.mensaje.create({
      data: {
        idConversacion: conversacion.id,
        remitente: 'USUARIO',
        contenido,
      },
    });

    // 3. Si la conversación ya fue escalada, la atiende el agente humano (sin IA)
    if (conversacion.estado === 'HANDOFF' || conversacion.handoff) {
      const agente = conversacion.handoff?.agente;
      const mensajeAgente = await prisma.mensaje.create({
        data: {
          idConversacion: conversacion.id,
          remitente: 'AGENTE_HUMANO',
          contenido: agente
            ? `${agente.nombre} ya tiene tu caso y te responderá en breve. Tu mensaje quedó registrado.`
            : 'Tu caso ya está en la cola de atención humana. Un agente te responderá en breve; tu mensaje quedó registrado.',
        },
      });

      res.json({
        tipo: 'handoff',
        conversacionId: conversacion.id,
        mensaje: formatearMensaje(mensajeAgente),
        agente: agente?.nombre ?? null,
        motivo: conversacion.handoff?.motivo ?? 'Conversación ya escalada',
        simulado: false,
      });
      return;
    }

    // 4. Ejecutar router
    const clasificacion = clasificarConsulta(contenido);

    // 5. Handoff: escalar a humano — no llamar a la IA
    if (clasificacion.tipo === 'handoff') {
      const agenteDisponible = await prisma.agente.findFirst({
        where: { disponible: true },
        orderBy: { id: 'asc' },
      });

      await prisma.$transaction([
        prisma.conversacion.update({
          where: { id: conversacion.id },
          data: { estado: 'HANDOFF' },
        }),
        prisma.handoff.create({
          data: {
            idConversacion: conversacion.id,
            idAgente: agenteDisponible?.id ?? null,
            motivo: clasificacion.motivo,
            estado: agenteDisponible ? 'ASIGNADO' : 'PENDIENTE',
          },
        }),
      ]);

      const mensajeHandoff = await prisma.mensaje.create({
        data: {
          idConversacion: conversacion.id,
          remitente: 'AGENTE_HUMANO',
          contenido: agenteDisponible
            ? `Te estoy conectando con ${agenteDisponible.nombre}, quien podrá ayudarte con tu solicitud. Un momento por favor.`
            : 'En este momento todos nuestros representantes están ocupados. Un agente se comunicará contigo lo antes posible.',
        },
      });

      res.json({
        tipo: 'handoff',
        conversacionId: conversacion.id,
        mensaje: formatearMensaje(mensajeHandoff),
        agente: agenteDisponible?.nombre ?? null,
        motivo: clasificacion.motivo,
        simulado: false,
      });
      return;
    }

    // 6. Llamar a la IA con el modelo seleccionado (Terra o Luna)
    const modelo = await prisma.modeloIA.findUnique({
      where: { nombre: clasificacion.tipo === 'terra' ? 'Terra' : 'Luna' },
    });

    if (!modelo) {
      res.status(500).json({ error: 'Modelo de IA no encontrado en la base de datos' });
      return;
    }

    // Últimos N mensajes previos como contexto (sin el mensaje actual)
    const previos = await prisma.mensaje.findMany({
      where: {
        idConversacion: conversacion.id,
        id: { not: mensajeUsuario.id },
        remitente: { in: ['USUARIO', 'ASISTENTE'] },
      },
      orderBy: { id: 'desc' },
      take: MENSAJES_DE_CONTEXTO,
    });

    const historial: MensajeHistorial[] = previos.reverse().map((m) => ({
      role: m.remitente === 'USUARIO' ? 'user' : 'assistant',
      content: m.contenido,
    }));

    const respuestaIA = await generarRespuesta(contenido, historial, clasificacion.tipo);

    // 7. Guardar mensaje de respuesta
    const mensajeRespuesta = await prisma.mensaje.create({
      data: {
        idConversacion: conversacion.id,
        idModelo: modelo.id,
        remitente: 'ASISTENTE',
        contenido: respuestaIA.contenido,
      },
    });

    // 8. Registrar consumo de API (con el pricing de referencia del modelo)
    const costo = calcularCostoConversacion(
      { costoEntradaMusd: modelo.costoEntradaMusd, costoSalidaMusd: modelo.costoSalidaMusd },
      respuestaIA.tokensEntrada,
      respuestaIA.tokensSalida
    );

    await prisma.consumoAPI.create({
      data: {
        idMensaje: mensajeRespuesta.id,
        idModelo: modelo.id,
        tokensEntrada: respuestaIA.tokensEntrada,
        tokensSalida: respuestaIA.tokensSalida,
        costoUsd: costo,
      },
    });

    // 9. Actualizar saldo diario: C(t) -= costo, U(t) += costo
    const config = await obtenerConfiguracion();
    const saldoHoy = await asegurarSaldoDeHoy(calcularRecargaDiaria(config.presupuestoMensual));
    const saldoActualizado = await registrarConsumoDiario(saldoHoy.id, costo);

    // 10. Evaluar alertas
    await evaluarYRegistrarAlerta(saldoActualizado.id, saldoActualizado.saldoCt, config.umbralAlerta);

    // 11. Responder al frontend
    // NOTA: el chat no muestra qué modelo respondió — el router es invisible para el usuario.
    res.json({
      tipo: 'respuesta',
      conversacionId: conversacion.id,
      mensaje: formatearMensaje(mensajeRespuesta),
      simulado: respuestaIA.simulado,
      // Metadata solo para debug/admin (el frontend del chat NO la muestra)
      _debug: {
        modelo: modelo.nombre,
        modeloApi: respuestaIA.modeloUsado,
        motivo: clasificacion.motivo,
        tokensEntrada: respuestaIA.tokensEntrada,
        tokensSalida: respuestaIA.tokensSalida,
        costo,
      },
    });
  } catch (error) {
    console.error('Error en POST /api/mensajes:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

function formatearMensaje(m: { id: number; remitente: string; contenido: string; timestamp: Date }) {
  return {
    id: m.id,
    remitente: m.remitente,
    contenido: m.contenido,
    timestamp: m.timestamp,
  };
}

export default router;
