// Configuración global — valores por defecto y acceso centralizado
// Los montos son supuestos del proyecto (ver README), no datos publicados por Klarna.

import prisma from '../db/prisma';

export const PRESUPUESTO_MENSUAL_DEFAULT = 20000; // USD/mes
export const UMBRAL_ALERTA_DEFAULT = 2000;        // USD
export const SALDO_INICIAL_USD = 10000;           // C(0) cuando no hay historial

/**
 * Devuelve la configuración vigente; si la tabla está vacía crea una
 * con los valores por defecto para que el sistema nunca quede sin parámetros.
 */
export async function obtenerConfiguracion() {
  const config = await prisma.configuracion.findFirst({ orderBy: { id: 'asc' } });
  if (config) return config;

  return prisma.configuracion.create({
    data: {
      presupuestoMensual: PRESUPUESTO_MENSUAL_DEFAULT,
      umbralAlerta: UMBRAL_ALERTA_DEFAULT,
    },
  });
}
