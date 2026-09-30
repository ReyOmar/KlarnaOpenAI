// Motor matemático del modelo Stock & Flow
// Ecuación: C(t+1) = max(C(t) + R - U(t), 0)
// Funciones puras y testeables — reutilizadas por simulación y registro real

/**
 * Calcula el saldo del siguiente periodo.
 * C(t+1) = max(C(t) + R - U(t), 0)
 */
export function calcularSaldoDiario(
  saldoActual: number,
  recarga: number,
  consumo: number
): number {
  return Math.max(saldoActual + recarga - consumo, 0);
}

/**
 * Calcula la recarga diaria a partir del presupuesto mensual.
 * R = presupuesto_mensual / 30
 */
export function calcularRecargaDiaria(presupuestoMensual: number): number {
  return presupuestoMensual / 30;
}

/**
 * Estima los días restantes hasta agotar el saldo,
 * dado un consumo promedio diario.
 * Retorna Infinity si el consumo neto es <= 0 (se gasta menos de lo que se recarga).
 */
export function calcularDiasHastaAgotamiento(
  saldoActual: number,
  consumoPromedioDiario: number,
  recargaDiaria: number
): number {
  const consumoNeto = consumoPromedioDiario - recargaDiaria;
  if (consumoNeto <= 0) return Infinity;
  return Math.ceil(saldoActual / consumoNeto);
}

/**
 * Genera una proyección de saldo para N días futuros.
 */
export function proyectarSaldo(
  saldoInicial: number,
  recargaDiaria: number,
  consumoPromedioDiario: number,
  dias: number
): { dia: number; saldo: number }[] {
  const proyeccion: { dia: number; saldo: number }[] = [];
  let saldo = saldoInicial;

  for (let i = 1; i <= dias; i++) {
    saldo = calcularSaldoDiario(saldo, recargaDiaria, consumoPromedioDiario);
    proyeccion.push({ dia: i, saldo });
  }

  return proyeccion;
}

// ─── Utilidades de fecha ──────────────────────────────────
// Los saldos diarios se indexan por día UTC para que el resultado no dependa
// de la zona horaria del servidor (local vs. despliegue en la nube).

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/** Devuelve la medianoche UTC del día de `fecha`. */
export function inicioDiaUTC(fecha: Date = new Date()): Date {
  return new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate()));
}

/** Suma (o resta, si es negativo) días completos a una fecha. */
export function sumarDias(fecha: Date, dias: number): Date {
  return new Date(fecha.getTime() + dias * MS_POR_DIA);
}

/** Número de días completos entre dos fechas (b - a). */
export function diasEntre(a: Date, b: Date): number {
  return Math.round((inicioDiaUTC(b).getTime() - inicioDiaUTC(a).getTime()) / MS_POR_DIA);
}

/** Redondea a centavos. */
export function redondearUsd(valor: number): number {
  return Math.round(valor * 100) / 100;
}
