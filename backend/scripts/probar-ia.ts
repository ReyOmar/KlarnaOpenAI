// Verifica la conexión con el proveedor de IA configurado en .env
// Uso: npm run ia:probar

import 'dotenv/config';
import OpenAI from 'openai';
import { generarRespuesta, infoIA, obtenerConfigIA } from '../src/services/ia';

async function main() {
  const config = obtenerConfigIA();
  const info = infoIA();

  console.log('\n🔎 Proveedor de IA');
  console.log(`   Proveedor: ${info.proveedor}`);
  console.log(`   Base URL:  ${info.baseURL ?? '(por defecto del SDK)'}`);
  console.log(`   Terra:     ${info.modelos.terra}`);
  console.log(`   Luna:      ${info.modelos.luna}`);
  if (info.advertencia) console.log(`   ⚠️  ${info.advertencia}`);

  if (config.proveedor === 'simulado') {
    console.log('\nModo simulado: no hay nada que probar. Configura AI_PROVIDER en backend/.env.\n');
    return;
  }

  // 1. Listar modelos disponibles (ayuda a detectar nombres de modelo incorrectos)
  try {
    const cliente = new OpenAI({ apiKey: config.apiKey, baseURL: config.baseURL, timeout: config.timeoutMs });
    const lista = await cliente.models.list();
    const ids = lista.data.map((m) => m.id);
    console.log(`\n📋 ${ids.length} modelos disponibles en el proveedor`);
    for (const nivel of ['terra', 'luna'] as const) {
      const modelo = config.modelos[nivel];
      const existe = ids.some((id) => id === modelo || id === `models/${modelo}` || id === `${modelo}:latest`);
      console.log(`   ${existe ? '✅' : '❓'} ${nivel}: ${modelo}${existe ? '' : ' (no aparece en la lista; revisa el nombre o descárgalo con "ollama pull")'}`);
    }
  } catch (error) {
    console.log(`\n⚠️  No se pudo listar modelos: ${error instanceof Error ? error.message : error}`);
  }

  // 2. Enviar un mensaje real a cada nivel (si cae al modo simulado, se reporta como fallo)
  for (const nivel of ['luna', 'terra'] as const) {
    const inicio = Date.now();
    try {
      const r = await generarRespuesta('Hola, ¿cómo puedo pagar mi próxima cuota?', [], nivel);
      if (r.simulado) throw new Error(infoIA().ultimoError ?? 'respuesta simulada');
      console.log(`\n✅ ${nivel} (${r.modeloUsado}) respondió en ${Date.now() - inicio} ms · ${r.tokensEntrada}/${r.tokensSalida} tokens`);
      console.log(`   "${r.contenido.slice(0, 160)}${r.contenido.length > 160 ? '…' : ''}"`);
    } catch (error) {
      console.log(`\n❌ ${nivel} falló: ${error instanceof Error ? error.message : error}`);
      process.exitCode = 1;
    }
  }
  console.log('');
}

main();
