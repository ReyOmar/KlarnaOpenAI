// Persistencia del modelo Stock & Flow: registro diario de C(t), R y U(t)

import prisma from '../db/prisma';
import { SALDO_INICIAL_USD } from './configuracion';
import { calcularSaldoDiario, inicioDiaUTC, sumarDias, diasEntre, redondearUsd } from './saldo';

// Límite de días a rellenar si el sistema estuvo inactivo mucho tiempo
const MAX_DIAS_RELLENO = 90;

/**
 * Garantiza que exista el registro de saldo del día actual (UTC).
 *
 * Si el último registro es de hace varios días, crea los días intermedios
 * aplicando solo la recarga R (sin consumo), de modo que la serie temporal
 * del gráfico no tenga huecos y C(t) respete C(t+1) = max(C(t) + R - U(t), 0).
 *
 * Usa upsert para tolerar peticiones concurrentes (chat + dashboard).
 */
export async function asegurarSaldoDeHoy(recargaDiaria: number) {
  const hoy = inicioDiaUTC();

  const existente = await prisma.saldoDiario.findUnique({ where: { fecha: hoy } });
  if (existente) return existente;

  const anterior = await prisma.saldoDiario.findFirst({
    where: { fecha: { lt: hoy } },
    orderBy: { fecha: 'desc' },
  });

  let saldo = anterior?.saldoCt ?? SALDO_INICIAL_USD;
  const recarga = redondearUsd(recargaDiaria);

  if (anterior) {
    const faltantes = Math.min(diasEntre(anterior.fecha, hoy) - 1, MAX_DIAS_RELLENO);
    for (let i = faltantes; i >= 1; i--) {
      saldo = calcularSaldoDiario(saldo, recarga, 0);
      const fecha = sumarDias(hoy, -i);
      await prisma.saldoDiario.upsert({
        where: { fecha },
        update: {},
        create: { fecha, saldoCt: redondearUsd(saldo), recargaR: recarga, consumoU: 0 },
      });
    }
  }

  saldo = calcularSaldoDiario(saldo, recarga, 0);

  return prisma.saldoDiario.upsert({
    where: { fecha: hoy },
    update: {},
    create: { fecha: hoy, saldoCt: redondearUsd(saldo), recargaR: recarga, consumoU: 0 },
  });
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
