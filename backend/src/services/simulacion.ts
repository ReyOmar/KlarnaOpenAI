// Simulador de escenarios del modelo Stock & Flow
// Proyecta el saldo de créditos C(t) día a día para "probar decisiones" (presupuesto,
// enrutamiento, demanda, precios) sin afectar la operación real.
//
//   Demanda(t)  = V0 · (1 + g)^((t-1)/30) · (1 + ε),   ε ~ U(-v, v)
//   U(t)        = Demanda(t) · (1 - h) · [p · costoTerra + (1 - p) · costoLuna] · f
//   C(t)        = max(C(t-1) + R - U(t), 0),           R = P / 30
//
// Todas las funciones son puras y deterministas para una misma semilla.

import { calcularCostoConversacion } from './consumo';
import { calcularSaldoDiario, calcularRecargaDiaria } from './saldo';

export interface ParametrosSimulacion {
  conversacionesDiarias: number;   // V0: conversaciones que llegan al chat por día
  crecimientoMensualPct: number;   // g: crecimiento de la demanda por mes (%)
  variabilidadPct: number;         // v: variación aleatoria diaria de la demanda (± %)
  porcentajeHandoff: number;       // h: % de conversaciones escaladas a humanos (sin costo de IA)
  porcentajeTerra: number;         // p: % de las conversaciones atendidas por IA que van a Terra
  tokensEntrada: number;           // tokens de entrada promedio por conversación
  tokensSalida: number;            // tokens de salida promedio por conversación
  factorPrecios: number;           // f: multiplicador sobre los precios de referencia
  presupuestoMensual: number;      // P (USD/mes)
  saldoInicial: number;            // C(0) (USD)
  umbralAlerta: number;            // USD
  dias: number;                    // horizonte de simulación
  corridas: number;                // repeticiones (solo relevante con variabilidad > 0)
  semilla: number;                 // semilla del generador aleatorio
}

// Precios de referencia por millón de tokens (los mismos del seed / Tabla 1 del informe)
export const PRECIOS_REFERENCIA = {
  terra: { costoEntradaMusd: 2.0, costoSalidaMusd: 12.0 },
  luna: { costoEntradaMusd: 0.2, costoSalidaMusd: 1.2 },
};

// Escenario base: operación con enrutador y el presupuesto ajustado que se evalúa.
// Volumen = 2,3 millones de conversaciones/mes (Klarna, 2024) ÷ 30. El resto son supuestos.
export const PARAMETROS_BASE: ParametrosSimulacion = {
  conversacionesDiarias: 76_667,
  crecimientoMensualPct: 0,
  variabilidadPct: 0,
  porcentajeHandoff: 10,
  porcentajeTerra: 30,
  tokensEntrada: 800,
  tokensSalida: 400,
  factorPrecios: 1,
  presupuestoMensual: 6_000,
  saldoInicial: 10_000,
  umbralAlerta: 2_000,
  dias: 90,
  corridas: 1,
  semilla: 2026,
};

export interface EscenarioPredefinido {
  id: string;
  nombre: string;
  descripcion: string;
  parametro: keyof ParametrosSimulacion | null;
  cambios: Partial<ParametrosSimulacion>;
}

// Cada escenario modifica UN solo parámetro respecto del base, para comparar con sentido.
export const ESCENARIOS: EscenarioPredefinido[] = [
  { id: 'E0', nombre: 'Base', descripcion: 'Enrutador activo (30 % Terra, 10 % handoff) y presupuesto de USD 6.000/mes', parametro: null, cambios: {} },
  { id: 'E1', nombre: 'Sin enrutamiento', descripcion: 'Todas las consultas de IA van a Terra', parametro: 'porcentajeTerra', cambios: { porcentajeTerra: 100 } },
  { id: 'E2', nombre: 'Demanda duplicada', descripcion: 'Temporada alta sostenida: el volumen diario se duplica', parametro: 'conversacionesDiarias', cambios: { conversacionesDiarias: 153_334 } },
  { id: 'E3', nombre: 'Crecimiento de demanda', descripcion: 'Expansión a nuevos mercados: la demanda crece 20 % cada mes', parametro: 'crecimientoMensualPct', cambios: { crecimientoMensualPct: 20 } },
  { id: 'E4', nombre: 'Alza de precios', descripcion: 'El proveedor sube 50 % el precio por token', parametro: 'factorPrecios', cambios: { factorPrecios: 1.5 } },
  { id: 'E5', nombre: 'Más escalamientos', descripcion: 'El 25 % de las conversaciones pasa a agentes humanos', parametro: 'porcentajeHandoff', cambios: { porcentajeHandoff: 25 } },
  { id: 'E6', nombre: 'Demanda variable', descripcion: 'La demanda diaria varía al azar ±30 % (200 corridas)', parametro: 'variabilidadPct', cambios: { variabilidadPct: 30, corridas: 200 } },
];

export interface PuntoSerie {
  dia: number;
  saldo: number;       // promedio entre corridas
  consumo: number;     // promedio entre corridas
  recarga: number;
  saldoP5?: number;    // percentiles entre corridas (solo si corridas > 1)
  saldoP95?: number;
}

export interface IndicadoresSimulacion {
  saldoFinal: number;
  consumoPromedioDiario: number;     // consumo demandado promedio (USD/día)
  costoTotal: number;                // gasto real del horizonte (no supera lo disponible)
  recargaDiaria: number;
  costoPorConversacionIA: number;
  diaAlerta: number | null;           // primer día con C(t) < umbral
  diaAgotamiento: number | null;      // primer día con C(t) = 0
  diasSinServicio: number;            // días con saldo agotado
  conversacionesNoAtendidas: number;  // conversaciones de IA que el saldo no alcanzó a cubrir
  probabilidadAgotamiento: number;    // fracción de corridas que agotan el saldo
  presupuestoMinimoSostenible: number; // 30 × consumo diario máximo esperado
}

export interface ResultadoSimulacion {
  parametros: ParametrosSimulacion;
  serie: PuntoSerie[];
  indicadores: IndicadoresSimulacion;
}

// ─── Validación ───────────────────────────────────────────

const LIMITES: Record<keyof ParametrosSimulacion, [number, number]> = {
  conversacionesDiarias: [0, 10_000_000],
  crecimientoMensualPct: [-50, 200],
  variabilidadPct: [0, 100],
  porcentajeHandoff: [0, 100],
  porcentajeTerra: [0, 100],
  tokensEntrada: [0, 100_000],
  tokensSalida: [0, 100_000],
  factorPrecios: [0, 100],
  presupuestoMensual: [0, 100_000_000],
  saldoInicial: [0, 100_000_000],
  umbralAlerta: [0, 100_000_000],
  dias: [1, 365],
  corridas: [1, 500],
  semilla: [0, 2 ** 31 - 1],
};

/**
 * Combina los cambios con los parámetros base y valida tipos y rangos.
 * Lanza un Error con un mensaje legible si algún valor es inválido.
 */
export function normalizarParametros(
  cambios: Record<string, unknown> = {},
  base: ParametrosSimulacion = PARAMETROS_BASE
): ParametrosSimulacion {
  const resultado = { ...base };
  for (const [clave, valor] of Object.entries(cambios)) {
    if (!(clave in LIMITES)) continue;
    const campo = clave as keyof ParametrosSimulacion;
    if (typeof valor !== 'number' || !Number.isFinite(valor)) {
      throw new Error(`"${campo}" debe ser un número`);
    }
    const [min, max] = LIMITES[campo];
    if (valor < min || valor > max) {
      throw new Error(`"${campo}" debe estar entre ${min} y ${max}`);
    }
    resultado[campo] = valor;
  }
  resultado.dias = Math.round(resultado.dias);
  resultado.corridas = Math.round(resultado.corridas);
  return resultado;
}

// ─── Motor ────────────────────────────────────────────────

/** Generador pseudoaleatorio reproducible (mulberry32). */
export function crearGenerador(semilla: number): () => number {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Costo esperado de una conversación atendida por IA, según la mezcla Terra/Luna. */
export function costoPorConversacionIA(p: ParametrosSimulacion): number {
  const terra = calcularCostoConversacion(PRECIOS_REFERENCIA.terra, p.tokensEntrada, p.tokensSalida);
  const luna = calcularCostoConversacion(PRECIOS_REFERENCIA.luna, p.tokensEntrada, p.tokensSalida);
  const proporcionTerra = p.porcentajeTerra / 100;
  return (proporcionTerra * terra + (1 - proporcionTerra) * luna) * p.factorPrecios;
}

/** Demanda esperada (sin ruido) del día t, con crecimiento compuesto mensual. */
export function demandaEsperada(p: ParametrosSimulacion, dia: number): number {
  return p.conversacionesDiarias * Math.pow(1 + p.crecimientoMensualPct / 100, (dia - 1) / 30);
}

function percentil(valores: number[], q: number): number {
  const ordenados = [...valores].sort((a, b) => a - b);
  const pos = (ordenados.length - 1) * q;
  const base = Math.floor(pos);
  const resto = pos - base;
  return ordenados[base + 1] !== undefined
    ? ordenados[base] + resto * (ordenados[base + 1] - ordenados[base])
    : ordenados[base];
}

const redondear = (v: number, dec = 2) => Math.round(v * 10 ** dec) / 10 ** dec;

export function simular(parametros: ParametrosSimulacion): ResultadoSimulacion {
  const p = parametros;
  const recarga = calcularRecargaDiaria(p.presupuestoMensual);
  const costoIA = costoPorConversacionIA(p);
  const fraccionIA = 1 - p.porcentajeHandoff / 100;
  const corridas = p.variabilidadPct > 0 ? p.corridas : 1;

  // saldos[d][r] y consumos[d][r]
  const saldos: number[][] = Array.from({ length: p.dias }, () => []);
  const consumos: number[][] = Array.from({ length: p.dias }, () => []);
  let corridasAgotadas = 0;
  let noAtendidasTotal = 0;
  let gastoTotal = 0;

  for (let r = 0; r < corridas; r++) {
    const azar = crearGenerador(p.semilla + r);
    let saldo = p.saldoInicial;
    let agoto = false;

    for (let d = 1; d <= p.dias; d++) {
      const ruido = p.variabilidadPct > 0 ? (p.variabilidadPct / 100) * (2 * azar() - 1) : 0;
      const demanda = demandaEsperada(p, d) * (1 + ruido);
      const consumo = demanda * fraccionIA * costoIA;

      // Si el consumo supera lo disponible, la diferencia queda sin atender
      const disponible = saldo + recarga;
      if (consumo > disponible && costoIA > 0) noAtendidasTotal += (consumo - disponible) / costoIA;
      gastoTotal += Math.min(consumo, disponible);

      saldo = calcularSaldoDiario(saldo, recarga, consumo);
      if (saldo === 0) agoto = true;

      saldos[d - 1].push(saldo);
      consumos[d - 1].push(consumo);
    }
    if (agoto) corridasAgotadas++;
  }

  const promedio = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

  const serie: PuntoSerie[] = saldos.map((valores, i) => {
    const punto: PuntoSerie = {
      dia: i + 1,
      saldo: redondear(promedio(valores)),
      consumo: redondear(promedio(consumos[i])),
      recarga: redondear(recarga),
    };
    if (corridas > 1) {
      punto.saldoP5 = redondear(percentil(valores, 0.05));
      punto.saldoP95 = redondear(percentil(valores, 0.95));
    }
    return punto;
  });

  const diaAlerta = serie.find((s) => s.saldo < p.umbralAlerta)?.dia ?? null;
  const diaAgotamiento = serie.find((s) => s.saldo === 0)?.dia ?? null;
  const consumoMaximoEsperado = demandaEsperada(p, p.dias) * fraccionIA * costoIA;

  return {
    parametros: p,
    serie,
    indicadores: {
      saldoFinal: serie[serie.length - 1].saldo,
      consumoPromedioDiario: redondear(promedio(serie.map((s) => s.consumo))),
      costoTotal: redondear(gastoTotal / corridas),
      recargaDiaria: redondear(recarga),
      costoPorConversacionIA: redondear(costoIA, 6),
      diaAlerta,
      diaAgotamiento,
      diasSinServicio: serie.filter((s) => s.saldo === 0).length,
      conversacionesNoAtendidas: Math.round(noAtendidasTotal / corridas),
      probabilidadAgotamiento: redondear(corridasAgotadas / corridas, 3),
      presupuestoMinimoSostenible: redondear(consumoMaximoEsperado * 30),
    },
  };
}

/** Ejecuta todos los escenarios predefinidos sobre una base (por defecto, la del informe). */
export function compararEscenarios(base: ParametrosSimulacion = PARAMETROS_BASE) {
  return ESCENARIOS.map((e) => {
    const parametros = normalizarParametros(e.cambios, base);
    return { ...e, resultado: simular(parametros) };
  });
}
