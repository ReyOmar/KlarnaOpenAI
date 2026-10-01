// Verifica la conexión con los proveedores de IA configurados en .env
// Uso: npm run ia:probar

import 'dotenv/config';
import OpenAI from 'openai';
import { ConfigProveedor, infoIA, llamarProveedor, obtenerConfigIA } from '../src/services/ia';

async function probar(etiqueta: string, p: ConfigProveedor) {
  console.log(`\n▶ ${etiqueta}: ${p.proveedor} / ${p.modelo}`);

  // 1. Listar modelos (ayuda a detectar nombres de modelo incorrectos)
  try {
    const cliente = new OpenAI({ apiKey: p.apiKey, baseURL: p.baseURL, timeout: 30000 });
    const ids = (await cliente.models.list()).data.map((m) => m.id);
    const existe = ids.some((id) => id === p.modelo || id === `models/${p.modelo}` || id === `${p.modelo}:latest`);
    console.log(`   ${existe ? '✅' : '❓'} modelo ${existe ? 'disponible' : 'no aparece en la lista del proveedor'} (${ids.length} modelos)`);
  } catch (error) {
    console.log(`   ⚠️  No se pudo listar modelos: ${error instanceof Error ? error.message : error}`);
  }

  // 2. Enviar un mensaje real
  const inicio = Date.now();
  try {
    const r = await llamarProveedor(p, 'Hola, ¿cómo puedo pagar mi próxima cuota?', []);
    console.log(`   ✅ respondió en ${Date.now() - inicio} ms · ${r.tokensEntrada}/${r.tokensSalida} tokens`);
    console.log(`   "${r.contenido.slice(0, 160)}${r.contenido.length > 160 ? '…' : ''}"`);
  } catch (error) {
    console.log(`   ❌ falló: ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  }
}

async function main() {
  const config = obtenerConfigIA();
  const info = infoIA();

  console.log(`\n🔎 Proveedor de IA: ${info.proveedor}`);
  if (info.advertencia) console.log(`   ⚠️  ${info.advertencia}`);

  const pruebas: [string, ConfigProveedor | null][] = [
    ['Terra', config.niveles.terra],
    ['Luna', config.niveles.luna],
    ['Respaldo de Terra', config.respaldo.terra],
    ['Respaldo de Luna', config.respaldo.luna],
  ];
  const activas = pruebas.filter((x): x is [string, ConfigProveedor] => x[1] !== null);

  if (activas.length === 0) {
    console.log('\nModo simulado: no hay nada que probar. Configura AI_PROVIDER en backend/.env.\n');
    return;
  }
  for (const [etiqueta, p] of activas) await probar(etiqueta, p);
  console.log('');
}

main();
