// Sistema de alertas — Evaluación de umbrales (spec sección 5-6)
// Genera alertas cuando C(t) cae bajo el umbral configurado

import { PrismaClient, TipoAlerta } from '@prisma/client';

const prisma = new PrismaClient();

export interface AlertaResult {
  generada: boolean;
  tipo?: TipoAlerta;
  mensaje?: string;
}

/**
 * Evalúa si el saldo actual amerita generar una alerta.
 * Tipos:
 *   BAJO     → saldo < umbral configurado
 *   CRITICO  → saldo < 25% del umbral
 *   AGOTADO  → saldo = 0
 */
export function evaluarUmbral(
  saldoActual: number,
  umbralAlerta: number
): AlertaResult {
  if (saldoActual <= 0) {
    return {
      generada: true,
      tipo: 'AGOTADO',
      mensaje: `¡Saldo agotado! C(t) = $${saldoActual.toFixed(2)}`,
    };
  }

  const umbralCritico = umbralAlerta * 0.25;

  if (saldoActual < umbralCritico) {
    return {
      generada: true,
      tipo: 'CRITICO',
      mensaje: `Saldo crítico: $${saldoActual.toFixed(2)} (< 25% del umbral $${umbralAlerta.toFixed(2)})`,
    };
  }

  if (saldoActual < umbralAlerta) {
    return {
      generada: true,
      tipo: 'BAJO',
      mensaje: `Saldo bajo: $${saldoActual.toFixed(2)} (< umbral $${umbralAlerta.toFixed(2)})`,
    };
  }

  return { generada: false };
}

/**
 * Evalúa y persiste una alerta si corresponde.
 * Evita alertas duplicadas del mismo tipo en el mismo día.
 */
export async function evaluarYRegistrarAlerta(
  saldoDiarioId: number,
  saldoActual: number,
  umbralAlerta: number
): Promise<AlertaResult> {
  const resultado = evaluarUmbral(saldoActual, umbralAlerta);

  if (!resultado.generada || !resultado.tipo) {
    return resultado;
  }

  // Verificar si ya existe una alerta activa del mismo tipo hoy
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const manana = new Date(hoy);
  manana.setDate(manana.getDate() + 1);

  const alertaExistente = await prisma.alerta.findFirst({
    where: {
      idSaldo: saldoDiarioId,
      tipo: resultado.tipo,
      estado: 'ACTIVA',
      fecha: { gte: hoy, lt: manana },
    },
  });

  if (alertaExistente) {
    return { generada: false };
  }

  // Crear nueva alerta
  await prisma.alerta.create({
    data: {
      idSaldo: saldoDiarioId,
      tipo: resultado.tipo,
      umbralUsd: umbralAlerta,
      estado: 'ACTIVA',
    },
  });

  return resultado;
}
