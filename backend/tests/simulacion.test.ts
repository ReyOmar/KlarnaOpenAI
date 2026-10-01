import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PARAMETROS_BASE,
  normalizarParametros,
  simular,
  compararEscenarios,
  costoPorConversacionIA,
} from '../src/services/simulacion';

const base = PARAMETROS_BASE;

test('el costo por conversación combina Terra y Luna según el enrutamiento', () => {
  // 30 % × 0,0064 + 70 % × 0,00064 = 0,002368 USD
  assert.equal(Math.round(costoPorConversacionIA(base) * 1e6) / 1e6, 0.002368);
  assert.equal(costoPorConversacionIA({ ...base, porcentajeTerra: 100 }), 0.0064);
});

test('escenario base determinista coincide con el cálculo analítico', () => {
  const r = simular(base);
  const consumo = 76_667 * 0.9 * 0.002368; // ≈ 163,39 USD/día
  const neto = 6000 / 30 - consumo;
  assert.equal(r.serie.length, 90);
  assert.ok(Math.abs(r.indicadores.consumoPromedioDiario - consumo) < 0.01);
  assert.ok(Math.abs(r.indicadores.saldoFinal - (10_000 + 90 * neto)) < 0.1);
  assert.equal(r.indicadores.diaAgotamiento, null);
});

test('condición extrema: sin presupuesto el saldo llega a 0 y nunca es negativo', () => {
  const r = simular({ ...base, presupuestoMensual: 0 });
  assert.ok(r.serie.every((s) => s.saldo >= 0));
  assert.notEqual(r.indicadores.diaAgotamiento, null);
  assert.ok(r.indicadores.diasSinServicio > 0);
});

test('condición extrema: sin demanda el saldo crece exactamente R por día', () => {
  const r = simular({ ...base, conversacionesDiarias: 0 });
  assert.equal(r.indicadores.saldoFinal, 10_000 + 90 * 200);
  assert.equal(r.indicadores.costoTotal, 0);
});

test('condición extrema: con 100 % de handoff la IA no consume', () => {
  const r = simular({ ...base, porcentajeHandoff: 100 });
  assert.equal(r.indicadores.consumoPromedioDiario, 0);
});

test('sin enrutamiento (E1) el saldo se agota antes del horizonte', () => {
  const e1 = compararEscenarios().find((e) => e.id === 'E1')!;
  const consumo = 76_667 * 0.9 * 0.0064; // ≈ 441,6 USD/día
  const diaEsperado = Math.ceil(10_000 / (consumo - 200));
  assert.equal(e1.resultado.indicadores.diaAgotamiento, diaEsperado);
  assert.ok(e1.resultado.indicadores.diaAlerta! < e1.resultado.indicadores.diaAgotamiento!);
});

test('la simulación estocástica es reproducible con la misma semilla', () => {
  const p = { ...base, variabilidadPct: 30, corridas: 50 };
  assert.deepEqual(simular(p).serie, simular(p).serie);
  const r = simular(p);
  assert.ok(r.serie.every((s) => s.saldoP5! <= s.saldo && s.saldo <= s.saldoP95!));
  assert.ok(r.indicadores.probabilidadAgotamiento >= 0 && r.indicadores.probabilidadAgotamiento <= 1);
});

test('normalizarParametros valida tipos y rangos', () => {
  assert.throws(() => normalizarParametros({ dias: 'mucho' }), /número/);
  assert.throws(() => normalizarParametros({ porcentajeTerra: 150 }), /entre/);
  assert.equal(normalizarParametros({ presupuestoMensual: 9000 }).presupuestoMensual, 9000);
  assert.equal(normalizarParametros({ desconocido: 1 }).dias, 90);
});
