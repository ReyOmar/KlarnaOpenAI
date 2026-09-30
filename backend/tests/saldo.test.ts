import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calcularSaldoDiario,
  calcularRecargaDiaria,
  calcularDiasHastaAgotamiento,
  proyectarSaldo,
  inicioDiaUTC,
  sumarDias,
  diasEntre,
} from '../src/services/saldo';
import { calcularCostoConversacion, estimarTokensEntrada } from '../src/services/consumo';
import { evaluarUmbral } from '../src/services/alertas';

test('C(t+1) = max(C(t) + R - U(t), 0)', () => {
  assert.equal(calcularSaldoDiario(1000, 100, 300), 800);
  assert.equal(calcularSaldoDiario(100, 50, 500), 0); // nunca negativo
});

test('la recarga diaria es el presupuesto mensual / 30', () => {
  assert.equal(calcularRecargaDiaria(30000), 1000);
});

test('días hasta agotamiento', () => {
  assert.equal(calcularDiasHastaAgotamiento(1000, 600, 500), 10);
  assert.equal(calcularDiasHastaAgotamiento(1000, 400, 500), Infinity); // recarga > consumo
});

test('proyección de saldo acumula día a día', () => {
  const p = proyectarSaldo(1000, 100, 300, 3);
  assert.deepEqual(p.map((d) => d.saldo), [800, 600, 400]);
});

test('utilidades de fecha trabajan en UTC', () => {
  const fecha = new Date('2026-09-30T23:30:00.000Z');
  assert.equal(inicioDiaUTC(fecha).toISOString(), '2026-09-30T00:00:00.000Z');
  assert.equal(sumarDias(inicioDiaUTC(fecha), -1).toISOString(), '2026-09-29T00:00:00.000Z');
  assert.equal(diasEntre(new Date('2026-09-01T10:00:00Z'), fecha), 29);
});

test('costo = tokens/1M × precio de entrada + tokens/1M × precio de salida', () => {
  // Terra: $2 entrada / $12 salida por millón → 800 in + 400 out = 0.0016 + 0.0048
  assert.equal(calcularCostoConversacion({ costoEntradaMusd: 2, costoSalidaMusd: 12 }, 800, 400), 0.0064);
  assert.equal(estimarTokensEntrada('abcd'.repeat(10)), 210);
});

test('evaluarUmbral clasifica BAJO, CRITICO y AGOTADO', () => {
  assert.equal(evaluarUmbral(5000, 2000).generada, false);
  assert.equal(evaluarUmbral(1500, 2000).tipo, 'BAJO');
  assert.equal(evaluarUmbral(400, 2000).tipo, 'CRITICO');
  assert.equal(evaluarUmbral(0, 2000).tipo, 'AGOTADO');
});
