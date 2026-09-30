import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clasificarConsulta, normalizarTexto } from '../src/services/router';

test('normalizarTexto quita tildes, mayúsculas y espacios extra', () => {
  assert.equal(normalizarTexto('  ¿Pásame con un   AGENTE?  '), '¿pasame con un agente?');
});

test('las peticiones explícitas de humano generan handoff', () => {
  const frases = [
    'Quiero hablar con un representante',
    'Quiero hablar con un representante humano',
    'Prefiero hablar con un representante',
    'pasame con un agente por favor',
    'Necesito un asesor',
    'I want to speak to a human',
  ];
  for (const frase of frases) {
    assert.equal(clasificarConsulta(frase).tipo, 'handoff', frase);
  }
});

test('disputas, fraude y temas legales generan handoff', () => {
  const frases = [
    'Tengo un cargo no reconocido en mi tarjeta',
    'Me hicieron doble cobro',
    'Mi cuenta bloqueada no me deja pagar',
    'Creo que es un fraude',
    'Voy a contactar a mi abogado',
    'Abrí una disputa con el comercio',
  ];
  for (const frase of frases) {
    assert.equal(clasificarConsulta(frase).tipo, 'handoff', frase);
  }
});

test('consultas complejas o sensibles van a Terra', () => {
  const frases = [
    'Necesito hacer una devolución',
    '¿Cuáles son las políticas de reembolso?',
    '¿Puedo extender mi plazo de pago?',
    'Quiero modificar mi plan de cuotas',
    '¿Por qué me rechazaron la compra?',
  ];
  for (const frase of frases) {
    assert.equal(clasificarConsulta(frase).tipo, 'terra', frase);
  }
});

test('consultas extensas o con varias preguntas van a Terra', () => {
  assert.equal(clasificarConsulta('a'.repeat(201)).tipo, 'terra');
  assert.equal(clasificarConsulta('¿Cuándo llega? ¿Y cuánto debo?').tipo, 'terra');
});

test('consultas simples van a Luna', () => {
  const frases = ['Hola', '¿Cuál es el estado de mi pedido?', '¿Cuándo llega mi envío?', 'Ver estado de cuenta'];
  for (const frase of frases) {
    assert.equal(clasificarConsulta(frase).tipo, 'luna', frase);
  }
});

test('palabras que contienen "legal" no disparan falsos positivos', () => {
  assert.notEqual(clasificarConsulta('¿Es ilegal pagar tarde?').tipo, 'handoff');
});
