// POST /api/mensajes — Recibe un mensaje del usuario, ejecuta el router, devuelve respuesta
// Este es el endpoint principal que integra router + IA + consumo + saldo + alertas

import { Router, Request, Response } from 'express';
import prisma from '../db/prisma';
import { clasificarConsulta } from '../services/router';
import { enviarMensaje } from '../services/openai';
import { calcularCostoConversacion } from '../services/consumo';
import { calcularSaldoDiario, calcularRecargaDiaria } from '../services/saldo';
import { evaluarYRegistrarAlerta } from '../services/alertas';

const router = Router();

interface MensajeBody {
  userId: number;
  conversacionId?: number;
  contenido: string;
}

router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, conversacionId, contenido } = req.body as MensajeBody;

    if (!userId || !contenido) {
      res.status(400).json({ error: 'userId y contenido son requeridos' });
      return;
    }

    // 1. Obtener o crear conversación
    let conversacion;
    if (conversacionId) {
      conversacion = await prisma.conversacion.findUnique({
        where: { id: conversacionId },
      });
      if (!conversacion) {
        res.status(404).json({ error: 'Conversación no encontrada' });
        return;
      }
    } else {
      conversacion = await prisma.conversacion.create({
        data: { idUsuario: userId },
      });
    }

    // 2. Guardar mensaje del usuario
    await prisma.mensaje.create({
      data: {
        idConversacion: conversacion.id,
        remitente: 'USUARIO',
        contenido,
      },
    });

    // 3. Ejecutar router
    const clasificacion = clasificarConsulta(contenido);

    // 4. Procesar según clasificación
    if (clasificacion.tipo === 'handoff') {
      // Escalar a humano — no llamar IA
      await prisma.conversacion.update({
        where: { id: conversacion.id },
        data: { estado: 'HANDOFF' },
      });

      // Asignar agente disponible
      const agenteDisponible = await prisma.agente.findFirst({
        where: { disponible: true },
      });

      await prisma.handoff.create({
        data: {
          idConversacion: conversacion.id,
          idAgente: agenteDisponible?.id || null,
          motivo: clasificacion.motivo,
          estado: agenteDisponible ? 'ASIGNADO' : 'PENDIENTE',
        },
      });

      // Guardar mensaje del sistema
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
        mensaje: {
          id: mensajeHandoff.id,
          remitente: 'AGENTE_HUMANO',
          contenido: mensajeHandoff.contenido,
          timestamp: mensajeHandoff.timestamp,
        },
        agente: agenteDisponible?.nombre || null,
        motivo: clasificacion.motivo,
      });
      return;
    }

    // 5. Llamar a OpenAI con el modelo seleccionado
    const modelo = await prisma.modeloIA.findFirst({
      where: {
        nombre: clasificacion.tipo === 'terra' ? 'Terra' : 'Luna',
      },
    });

    if (!modelo) {
      res.status(500).json({ error: 'Modelo de IA no encontrado en la base de datos' });
      return;
    }

    // Obtener historial de conversación para contexto
    const historial = await prisma.mensaje.findMany({
      where: { idConversacion: conversacion.id },
      orderBy: { timestamp: 'asc' },
      take: 20, // Últimos 20 mensajes como contexto
    });

    const historialFormateado = historial
      .filter(m => m.remitente !== 'AGENTE_HUMANO')
      .map(m => ({
        role: (m.remitente === 'USUARIO' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: m.contenido,
      }));

    const respuestaIA = await enviarMensaje(
      contenido,
      historialFormateado.slice(0, -1), // Excluir el último (ya lo enviamos como mensaje actual)
      modelo.nombreApi
    );

    // 6. Guardar mensaje de respuesta
    const mensajeRespuesta = await prisma.mensaje.create({
      data: {
        idConversacion: conversacion.id,
        idModelo: modelo.id,
        remitente: 'ASISTENTE',
        contenido: respuestaIA.contenido,
      },
    });

    // 7. Registrar consumo de API
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

    // 8. Actualizar saldo diario
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const config = await prisma.configuracion.findFirst();
    const recargaDiaria = calcularRecargaDiaria(config?.presupuestoMensual || 20000);

    let saldoHoy = await prisma.saldoDiario.findUnique({
      where: { fecha: hoy },
    });

    if (!saldoHoy) {
      // Obtener saldo del día anterior
      const ayer = new Date(hoy);
      ayer.setDate(ayer.getDate() - 1);
      const saldoAyer = await prisma.saldoDiario.findUnique({
        where: { fecha: ayer },
      });

      const saldoAnterior = saldoAyer?.saldoCt || 10000; // Saldo inicial por defecto
      const nuevoSaldo = calcularSaldoDiario(saldoAnterior, recargaDiaria, 0);

      saldoHoy = await prisma.saldoDiario.create({
        data: {
          fecha: hoy,
          saldoCt: nuevoSaldo,
          recargaR: recargaDiaria,
          consumoU: 0,
        },
      });
    }

    // Actualizar consumo acumulado del día
    const nuevoConsumo = saldoHoy.consumoU + costo;
    const nuevoSaldo = Math.max(saldoHoy.saldoCt - costo, 0);

    saldoHoy = await prisma.saldoDiario.update({
      where: { id: saldoHoy.id },
      data: {
        consumoU: nuevoConsumo,
        saldoCt: nuevoSaldo,
      },
    });

    // 9. Evaluar alertas
    const umbral = config?.umbralAlerta || 2000;
    await evaluarYRegistrarAlerta(saldoHoy.id, nuevoSaldo, umbral);

    // 10. Responder al frontend
    // NOTA: No enviamos info del modelo al usuario final — el router es invisible
    res.json({
      tipo: 'respuesta',
      conversacionId: conversacion.id,
      mensaje: {
        id: mensajeRespuesta.id,
        remitente: 'ASISTENTE',
        contenido: respuestaIA.contenido,
        timestamp: mensajeRespuesta.timestamp,
      },
      // Metadata solo para debug/admin (el frontend del chat NO debe mostrar esto)
      _debug: {
        modelo: modelo.nombre,
        motivo: clasificacion.motivo,
        tokensEntrada: respuestaIA.tokensEntrada,
        tokensSalida: respuestaIA.tokensSalida,
        costo: costo,
      },
    });
  } catch (error) {
    console.error('Error en POST /api/mensajes:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;
