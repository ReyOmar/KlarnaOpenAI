// Seed — Datos iniciales para el prototipo
// NOTA: Los nombres "Terra" y "Luna" son decisiones de diseño de este proyecto,
// NO datos confirmados por Klarna (ver sección 2 del spec).

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // 1. Modelos de IA
  // Pricing de referencia (agosto 2026):
  // GPT-5.6 Terra = $2 entrada / $12 salida por millón de tokens
  // GPT-5.6 Luna = $0.20 entrada / $1.20 salida por millón de tokens
  // Usamos gpt-4o y gpt-4o-mini como implementación real
  const terra = await prisma.modeloIA.upsert({
    where: { nombre: 'Terra' },
    update: {},
    create: {
      nombre: 'Terra',
      nombreApi: 'gpt-4o',
      costoEntradaMusd: 2.0,    // $2 USD / millón tokens entrada
      costoSalidaMusd: 12.0,    // $12 USD / millón tokens salida
    },
  });

  const luna = await prisma.modeloIA.upsert({
    where: { nombre: 'Luna' },
    update: {},
    create: {
      nombre: 'Luna',
      nombreApi: 'gpt-4o-mini',
      costoEntradaMusd: 0.20,   // $0.20 USD / millón tokens entrada
      costoSalidaMusd: 1.20,    // $1.20 USD / millón tokens salida
    },
  });

  console.log('  ✅ Modelos IA:', terra.nombre, luna.nombre);

  // 2. Configuración global
  const config = await prisma.configuracion.upsert({
    where: { id: 1 },
    update: {},
    create: {
      presupuestoMensual: 20000, // $20,000 USD/mes (supuesto, no dato público de Klarna)
      umbralAlerta: 2000,        // Alerta cuando saldo < $2,000 USD
    },
  });

  console.log('  ✅ Configuración: presupuesto $' + config.presupuestoMensual + '/mes');

  // 3. Agentes de soporte
  const agente1 = await prisma.agente.upsert({
    where: { email: 'maria.garcia@klarna-demo.com' },
    update: {},
    create: {
      nombre: 'María García',
      email: 'maria.garcia@klarna-demo.com',
      disponible: true,
    },
  });

  const agente2 = await prisma.agente.upsert({
    where: { email: 'carlos.lopez@klarna-demo.com' },
    update: {},
    create: {
      nombre: 'Carlos López',
      email: 'carlos.lopez@klarna-demo.com',
      disponible: true,
    },
  });

  console.log('  ✅ Agentes:', agente1.nombre, agente2.nombre);

  // 4. Usuario de demostración
  const usuario = await prisma.usuario.upsert({
    where: { email: 'demo@usuario.com' },
    update: {},
    create: {
      nombre: 'Usuario Demo',
      email: 'demo@usuario.com',
    },
  });

  console.log('  ✅ Usuario demo:', usuario.nombre, '(ID:', usuario.id, ')');

  // 5. Saldo diario inicial y datos históricos de 30 días
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const recargaDiaria = config.presupuestoMensual / 30; // ~667 USD/día

  // Generar 30 días de historial para que el gráfico tenga datos
  let saldoAcumulado = 10000; // C(0) = 10,000 USD (saldo inicial de ejemplo)

  for (let i = 29; i >= 0; i--) {
    const fecha = new Date(hoy);
    fecha.setDate(fecha.getDate() - i);

    // Simular consumo diario variable (entre 350 y 600 USD)
    const consumoBase = 491; // Consumo promedio según spec (~491 USD/día con Terra)
    const variacion = (Math.random() - 0.5) * 200; // ±100 USD de variación
    const consumoDia = Math.max(consumoBase + variacion, 100);

    saldoAcumulado = Math.max(saldoAcumulado + recargaDiaria - consumoDia, 0);

    await prisma.saldoDiario.upsert({
      where: { fecha },
      update: {},
      create: {
        fecha,
        saldoCt: Math.round(saldoAcumulado * 100) / 100,
        recargaR: Math.round(recargaDiaria * 100) / 100,
        consumoU: Math.round(consumoDia * 100) / 100,
      },
    });
  }

  console.log('  ✅ Historial de saldo: 30 días generados');
  console.log('  💰 Saldo actual C(t): $' + saldoAcumulado.toFixed(2));

  // 6. Generar algunas alertas de ejemplo
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

  // 7. Generar algunos consumos de ejemplo
  const conversacion = await prisma.conversacion.create({
    data: {
      idUsuario: usuario.id,
      estado: 'CERRADA',
    },
  });

  // Simular 10 mensajes con consumos variados
  const mensajesEjemplo = [
    { contenido: '¿Cuál es el estado de mi pedido?', modelo: luna, tokensE: 150, tokensS: 200 },
    { contenido: 'Necesito hacer una devolución', modelo: terra, tokensE: 180, tokensS: 350 },
    { contenido: '¿Cuándo llega mi envío?', modelo: luna, tokensE: 120, tokensS: 180 },
    { contenido: 'Quiero modificar mi plan de pagos', modelo: terra, tokensE: 200, tokensS: 400 },
    { contenido: '¿Cuáles son las políticas de reembolso?', modelo: terra, tokensE: 160, tokensS: 300 },
  ];

  for (const ej of mensajesEjemplo) {
    const msgUsuario = await prisma.mensaje.create({
      data: {
        idConversacion: conversacion.id,
        remitente: 'USUARIO',
        contenido: ej.contenido,
      },
    });

    const msgAsistente = await prisma.mensaje.create({
      data: {
        idConversacion: conversacion.id,
        idModelo: ej.modelo.id,
        remitente: 'ASISTENTE',
        contenido: 'Respuesta de ejemplo para seed.',
      },
    });

    const costo = (ej.tokensE / 1_000_000 * ej.modelo.costoEntradaMusd) +
                  (ej.tokensS / 1_000_000 * ej.modelo.costoSalidaMusd);

    await prisma.consumoAPI.create({
      data: {
        idMensaje: msgAsistente.id,
        idModelo: ej.modelo.id,
        tokensEntrada: ej.tokensE,
        tokensSalida: ej.tokensS,
        costoUsd: Math.round(costo * 1_000_000) / 1_000_000,
      },
    });
  }

  console.log('  ✅ Consumos de ejemplo: 5 conversaciones seed');

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
