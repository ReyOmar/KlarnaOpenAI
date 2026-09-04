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
