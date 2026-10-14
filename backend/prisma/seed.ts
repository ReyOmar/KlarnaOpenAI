// Seed — Datos iniciales para el prototipo
// Se puede ejecutar varias veces: solo crea lo que falta.
// El historial de saldo sigue el escenario base (E0) del informe de simulación en Vensim:
// saldo inicial USD 10.000, presupuesto USD 6.000/mes y consumo de la operación base.
// NOTA: Los nombres "Terra" y "Luna" son decisiones de diseño de este proyecto,
// NO datos confirmados por Klarna (ver sección 2 del spec).

import 'dotenv/config';
import prisma from '../src/db/prisma';
import { asegurarDatosBase } from '../src/services/datosBase';
import {
  obtenerConfiguracion,
  PRESUPUESTO_MENSUAL_DEFAULT,
  UMBRAL_ALERTA_DEFAULT,
  SALDO_INICIAL_USD,
} from '../src/services/configuracion';
import { calcularRecargaDiaria, inicioDiaUTC, sumarDias, redondearUsd } from '../src/services/saldo';
import { avanzarDiaModelo } from '../src/services/saldoDiario';
import { evaluarYRegistrarAlerta } from '../src/services/alertas';

const DIAS_HISTORIAL = 30;

// Texto de los consumos de ejemplo que creaban versiones anteriores del seed
const MARCA_EJEMPLO_ANTIGUO = 'Respuesta de ejemplo para seed.';

/**
 * Versiones anteriores del seed creaban un historial de saldo aleatorio (presupuesto
 * USD 20.000) y cinco consumos inventados. Si se detectan, se borran y se rehace el
 * historial con el modelo del informe. Devuelve true si hubo que limpiar.
 */
async function limpiarDatosDeEjemploAntiguos(): Promise<boolean> {
  const mensajes = await prisma.mensaje.findMany({
    where: { contenido: MARCA_EJEMPLO_ANTIGUO },
    select: { idConversacion: true },
  });
  if (mensajes.length === 0) return false;

  const idsConversacion = [...new Set(mensajes.map((m) => m.idConversacion))];
  await prisma.$transaction([
    prisma.consumoAPI.deleteMany({ where: { mensaje: { idConversacion: { in: idsConversacion } } } }),
    prisma.handoff.deleteMany({ where: { idConversacion: { in: idsConversacion } } }),
    prisma.mensaje.deleteMany({ where: { idConversacion: { in: idsConversacion } } }),
    prisma.conversacion.deleteMany({ where: { id: { in: idsConversacion } } }),
    prisma.alerta.deleteMany(),
    prisma.saldoDiario.deleteMany(),
  ]);

  const config = await obtenerConfiguracion();
  await prisma.configuracion.update({
    where: { id: config.id },
    data: { presupuestoMensual: PRESUPUESTO_MENSUAL_DEFAULT, umbralAlerta: UMBRAL_ALERTA_DEFAULT },
  });
  return true;
}

async function main() {
  console.log('🌱 Seeding database...');

  // 1. Modelos IA (Terra/Luna), configuración, agentes y usuario demo
  await asegurarDatosBase();

  // 2. Reemplazar los datos de ejemplo de versiones anteriores
  if (await limpiarDatosDeEjemploAntiguos()) {
    console.log('  🧹 Datos de ejemplo antiguos reemplazados por el escenario base del informe');
  }

  const config = await obtenerConfiguracion();
  console.log(`  ✅ Configuración: presupuesto $${config.presupuestoMensual}/mes, umbral $${config.umbralAlerta}`);

  // 3. Historial de 30 días según el escenario base (E0)
  const saldosExistentes = await prisma.saldoDiario.count();
  if (saldosExistentes === 0) {
    const hoy = inicioDiaUTC();
    const recarga = redondearUsd(calcularRecargaDiaria(config.presupuestoMensual));
    let saldo = SALDO_INICIAL_USD;

    for (let i = DIAS_HISTORIAL - 1; i >= 0; i--) {
      const dia = avanzarDiaModelo(saldo, recarga);
      saldo = dia.saldo;
      const registro = await prisma.saldoDiario.create({
        data: { fecha: sumarDias(hoy, -i), saldoCt: dia.saldo, recargaR: recarga, consumoU: dia.consumo },
      });
      await evaluarYRegistrarAlerta(registro.id, registro.saldoCt, config.umbralAlerta);
    }

    console.log(`  ✅ Historial de saldo: ${DIAS_HISTORIAL} días del escenario base`);
    console.log('  💰 Saldo actual C(t): $' + saldo.toFixed(2));
  } else {
    console.log(`  ↪️  Historial de saldo ya existe (${saldosExistentes} días), se omite`);
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
