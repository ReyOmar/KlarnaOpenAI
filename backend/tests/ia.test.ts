import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolverConfigIA, limpiarRespuesta, respuestaSimulada } from '../src/services/ia';

test('sin AI_PROVIDER pero con OPENAI_API_KEY se usa OpenAI (compatibilidad)', () => {
  const c = resolverConfigIA({ OPENAI_API_KEY: 'sk-test' });
  assert.equal(c.proveedor, 'openai');
  assert.equal(c.apiKey, 'sk-test');
  assert.deepEqual(c.modelos, { terra: 'gpt-4o', luna: 'gpt-4o-mini' });
});

test('sin ninguna configuración se usa el modo simulado', () => {
  const c = resolverConfigIA({});
  assert.equal(c.proveedor, 'simulado');
  assert.ok(c.advertencia);
});

test('Ollama no requiere API key y usa la URL local por defecto', () => {
  const c = resolverConfigIA({ AI_PROVIDER: 'ollama' });
  assert.equal(c.proveedor, 'ollama');
  assert.equal(c.baseURL, 'http://localhost:11434/v1');
  assert.ok(c.apiKey);
});

test('los modelos y la URL se pueden sobrescribir', () => {
  const c = resolverConfigIA({
    AI_PROVIDER: 'ollama',
    AI_BASE_URL: 'http://gpu-server:11434/v1',
    AI_MODEL_TERRA: 'gemma3:12b',
    AI_MODEL_LUNA: 'gemma3:4b',
  });
  assert.equal(c.baseURL, 'http://gpu-server:11434/v1');
  assert.deepEqual(c.modelos, { terra: 'gemma3:12b', luna: 'gemma3:4b' });
});

test('Groq y Gemini sin API key caen a modo simulado con advertencia', () => {
  for (const proveedor of ['groq', 'gemini']) {
    const c = resolverConfigIA({ AI_PROVIDER: proveedor });
    assert.equal(c.proveedor, 'simulado', proveedor);
    assert.match(c.advertencia ?? '', /AI_API_KEY/);
  }
});

test('custom exige base URL y ambos modelos', () => {
  assert.equal(resolverConfigIA({ AI_PROVIDER: 'custom' }).proveedor, 'simulado');
  const c = resolverConfigIA({
    AI_PROVIDER: 'custom',
    AI_BASE_URL: 'https://openrouter.ai/api/v1',
    AI_API_KEY: 'x',
    AI_MODEL_TERRA: 'a',
    AI_MODEL_LUNA: 'b',
  });
  assert.equal(c.proveedor, 'custom');
});

test('un proveedor inválido cae a modo simulado', () => {
  assert.equal(resolverConfigIA({ AI_PROVIDER: 'claude' }).proveedor, 'simulado');
});

test('limpiarRespuesta elimina bloques <think> de modelos de razonamiento', () => {
  assert.equal(limpiarRespuesta('<think>pensando...</think>\nHola'), 'Hola');
  assert.equal(limpiarRespuesta(null), '');
});

test('respuestaSimulada responde según el tema y marca simulado', () => {
  const r = respuestaSimulada('Quiero hacer una devolución', 'terra');
  assert.equal(r.simulado, true);
  assert.match(r.contenido, /devoluci/);
  assert.ok(r.tokensEntrada > 0 && r.tokensSalida > 0);
});
