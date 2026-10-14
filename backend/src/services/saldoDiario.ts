// Persistencia del modelo Stock & Flow: registro diario de C(t), R y U(t)
//
// Cada día el saldo avanza según el escenario base del informe de simulación (E0):
// la operación de Klarna (76.667 conversaciones/día, 10 % a humanos, 30 % de la IA a
// Terra) consume ~USD 163,39 diarios. Los mensajes reales del chat se suman a ese consumo.

import prisma from '../db/prisma';
import { SALDO_INICIAL_USD } from './configuracion';
import { calcularSaldoDiario, inicioDiaUTC, sumarDias, diasEntre, redondearUsd } from './saldo';
import { operacionDiariaBase } from './simulacion';
import { evaluarYRegistrarAlerta } from './alertas';

// Límite de días a rellenar si el sistema estuvo inactivo mucho tiempo
const MAX_DIAS_RELLENO = 90;

/**
 * Un día del modelo: el consumo efectivo es lo que exige la demanda base, limitado a
 * lo disponible (saldo + recarga), igual que el "Consumo efectivo" del modelo en Vensim.
 */
export function avanzarDiaModelo(saldo: number, recarga: number) {
  const consumo = redondearUsd(Math.min(operacionDiariaBase().consumoDiario, saldo + recarga));
  return { consumo, saldo: redondearUsd(calcularSaldoDiario(saldo, recarga, consumo)) };
}

/**
 * Garantiza que exista el registro de saldo del día actual (UTC).
 *
 * Si el último registro es de hace varios días, crea los días intermedios aplicando
 * el modelo (recarga R menos el consumo de la operación base), de modo que la serie
 * no tenga huecos y C(t) respete C(t+1) = max(C(t) + R - U(t), 0). Cada día creado
 * se evalúa contra el umbral de alerta.
 *
 * Usa upsert para tolerar peticiones concurrentes (chat + dashboard).
 */
export async function asegurarSaldoDeHoy(recargaDiaria: number, umbralAlerta: number) {
  const hoy = inicioDiaUTC();

  const existente = await prisma.saldoDiario.findUnique({ where: { fecha: hoy } });
  if (existente) return existente;

  const anterior = await prisma.saldoDiario.findFirst({
    where: { fecha: { lt: hoy } },
    orderBy: { fecha: 'desc' },
  });

  let saldo = anterior?.saldoCt ?? SALDO_INICIAL_USD;
  const recarga = redondearUsd(recargaDiaria);
  const faltantes = anterior ? Math.min(diasEntre(anterior.fecha, hoy) - 1, MAX_DIAS_RELLENO) : 0;

  // Días intermedios y el día de hoy (i = 0)
  let registro = null;
  for (let i = faltantes; i >= 0; i--) {
    const dia = avanzarDiaModelo(saldo, recarga);
    saldo = dia.saldo;
    const fecha = sumarDias(hoy, -i);
    registro = await prisma.saldoDiario.upsert({
      where: { fecha },
      update: {},
      create: { fecha, saldoCt: dia.saldo, recargaR: recarga, consumoU: dia.consumo },
    });
    await evaluarYRegistrarAlerta(registro.id, registro.saldoCt, umbralAlerta);
  }

  return registro!;
}

/**
 * Descuenta un consumo U del saldo del día de forma atómica
 * (evita condiciones de carrera entre mensajes simultáneos).
 */
export async function registrarConsumoDiario(saldoId: number, costoUsd: number) {
  const actualizado = await prisma.saldoDiario.update({
    where: { id: saldoId },
    data: {
      consumoU: { increment: costoUsd },
      saldoCt: { decrement: costoUsd },
    },
  });

  // C(t) nunca puede ser negativo
  if (actualizado.saldoCt < 0) {
    return prisma.saldoDiario.update({ where: { id: saldoId }, data: { saldoCt: 0 } });
  }
  return actualizado;
}
