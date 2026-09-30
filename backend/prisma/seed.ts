// Seed — Datos iniciales para el prototipo
// Se puede ejecutar varias veces: solo crea lo que falta.
// NOTA: Los nombres "Terra" y "Luna" son decisiones de diseño de este proyecto,
// NO datos confirmados por Klarna (ver sección 2 del spec).

import 'dotenv/config';
import prisma from '../src/db/prisma';
import { asegurarDatosBase } from '../src/services/datosBase';
import { obtenerConfiguracion, SALDO_INICIAL_USD } from '../src/services/configuracion';
import { calcularCostoConversacion } from '../src/services/consumo';
import { calcularRecargaDiaria, calcularSaldoDiario, inicioDiaUTC, sumarDias, redondearUsd } from '../src/services/saldo';

const DIAS_HISTORIAL = 30;

async function main() {
  console.log('🌱 Seeding database...');

  // 1-4. Modelos IA (Terra/Luna), configuración, agentes y usuario demo
  const usuario = await asegurarDatosBase();
  const config = await obtenerConfiguracion();
  const terra = await prisma.modeloIA.findUniqueOrThrow({ where: { nombre: 'Terra' } });
  const luna = await prisma.modeloIA.findUniqueOrThrow({ where: { nombre: 'Luna' } });

  console.log(`  ✅ Modelos IA: Terra (${terra.nombreApi}), Luna (${luna.nombreApi})`);
  console.log('  ✅ Configuración: presupuesto $' + config.presupuestoMensual + '/mes');
  console.log('  ✅ Agentes y usuario demo (ID:', usuario.id, ')');

  // 5. Historial de 30 días para que el gráfico tenga datos
  const saldosExistentes = await prisma.saldoDiario.count();
  if (saldosExistentes === 0) {
    const hoy = inicioDiaUTC();
    const recargaDiaria = redondearUsd(calcularRecargaDiaria(config.presupuestoMensual)); // ~667 USD/día
    let saldoAcumulado = SALDO_INICIAL_USD;

    for (let i = DIAS_HISTORIAL - 1; i >= 0; i--) {
      const fecha = sumarDias(hoy, -i);

      // Consumo diario variable alrededor de ~491 USD/día (supuesto con Terra)
      const variacion = (Math.random() - 0.5) * 200; // ±100 USD
      const consumoDia = redondearUsd(Math.max(491 + variacion, 100));

      saldoAcumulado = calcularSaldoDiario(saldoAcumulado, recargaDiaria, consumoDia);

      await prisma.saldoDiario.upsert({
        where: { fecha },
        update: {},
        create: {
          fecha,
          saldoCt: redondearUsd(saldoAcumulado),
          recargaR: recargaDiaria,
          consumoU: consumoDia,
        },
      });
    }

    console.log(`  ✅ Historial de saldo: ${DIAS_HISTORIAL} días generados`);
    console.log('  💰 Saldo actual C(t): $' + saldoAcumulado.toFixed(2));
  } else {
    console.log(`  ↪️  Historial de saldo ya existe (${saldosExistentes} días), se omite`);
  }

  // 6. Alerta de ejemplo si algún día el saldo quedó bajo el umbral (solo si no hay ninguna)
  if ((await prisma.alerta.count()) === 0) {
    const saldoBajo = await prisma.saldoDiario.findFirst({
      where: { saldoCt: { lt: config.umbralAlerta } },
      orderBy: { fecha: 'desc' },
    });
    if (saldoBajo) {
      await prisma.alerta.create({
        data: {
          idSaldo: saldoBajo.id,
          tipo: 'BAJO',
          umbralUsd: config.umbralAlerta,
          estado: 'RESUELTA',
        },
      });
      console.log('  ✅ Alerta de ejemplo creada');
    }
  }

  // 7. Consumos de ejemplo (solo si no hay ninguno)
  if ((await prisma.consumoAPI.count()) === 0) {
    const conversacion = await prisma.conversacion.create({
      data: { idUsuario: usuario.id, estado: 'CERRADA' },
    });

    const mensajesEjemplo = [
      { contenido: '¿Cuál es el estado de mi pedido?', modelo: luna, tokensE: 150, tokensS: 200 },
      { contenido: 'Necesito hacer una devolución', modelo: terra, tokensE: 180, tokensS: 350 },
      { contenido: '¿Cuándo llega mi envío?', modelo: luna, tokensE: 120, tokensS: 180 },
      { contenido: 'Quiero modificar mi plan de pagos', modelo: terra, tokensE: 200, tokensS: 400 },
      { contenido: '¿Cuáles son las políticas de reembolso?', modelo: terra, tokensE: 160, tokensS: 300 },
    ];

    for (const ej of mensajesEjemplo) {
      await prisma.mensaje.create({
        data: { idConversacion: conversacion.id, remitente: 'USUARIO', contenido: ej.contenido },
      });

      const msgAsistente = await prisma.mensaje.create({
        data: {
          idConversacion: conversacion.id,
          idModelo: ej.modelo.id,
          remitente: 'ASISTENTE',
          contenido: 'Respuesta de ejemplo para seed.',
        },
      });

      await prisma.consumoAPI.create({
        data: {
          idMensaje: msgAsistente.id,
          idModelo: ej.modelo.id,
          tokensEntrada: ej.tokensE,
          tokensSalida: ej.tokensS,
          costoUsd: calcularCostoConversacion(ej.modelo, ej.tokensE, ej.tokensS),
        },
      });
    }

    console.log(`  ✅ Consumos de ejemplo: ${mensajesEjemplo.length} mensajes`);
  }

  console.log('\n✨ Seed completado exitosamente!\n');
}

main()
  .catch((e) => {
    console.error('Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
