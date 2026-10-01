// Cliente de IA multi-proveedor
// Usa el SDK de OpenAI contra cualquier API compatible (OpenAI, Ollama, Groq,
// Gemini, OpenRouter, LM Studio...). Solo cambia la baseURL, la clave y el modelo.
// NOTA: "Terra" y "Luna" son nombres internos del proyecto (ver spec sección 2):
// Terra = modelo capaz, Luna = modelo económico.
//
// Cada nivel puede usar un proveedor distinto (AI_PROVIDER_TERRA / AI_PROVIDER_LUNA).
// Si el proveedor de un nivel falla, se intenta con el proveedor del otro nivel
// (respaldo cruzado) y, como último recurso, se responde en modo simulado.

import OpenAI from 'openai';
import { estimarTokensEntrada } from './consumo';

export type NivelModelo = 'terra' | 'luna';
const NIVELES: NivelModelo[] = ['terra', 'luna'];

export const PROVEEDORES = ['openai', 'ollama', 'groq', 'gemini', 'custom', 'simulado'] as const;
export type Proveedor = (typeof PROVEEDORES)[number];
type ProveedorReal = Exclude<Proveedor, 'simulado'>;

type ParametroTokens = 'max_tokens' | 'max_completion_tokens' | null;

interface Preset {
  baseURL?: string;
  terra: string;
  luna: string;
  parametroTokens: ParametroTokens;
  requiereApiKey: boolean;
  extra?: Record<string, unknown>;
}

// Valores por defecto de cada proveedor. Se pueden sobrescribir con
// AI_BASE_URL(_TERRA|_LUNA), AI_MODEL_TERRA y AI_MODEL_LUNA.
const PRESETS: Record<ProveedorReal, Preset> = {
  openai: {
    terra: 'gpt-4o',
    luna: 'gpt-4o-mini',
    parametroTokens: 'max_completion_tokens',
    requiereApiKey: true,
  },
  ollama: {
    baseURL: 'http://localhost:11434/v1',
    terra: 'qwen2.5:7b',
    luna: 'llama3.2:3b',
    parametroTokens: 'max_tokens',
    requiereApiKey: false,
  },
  groq: {
    baseURL: 'https://api.groq.com/openai/v1',
    // En 2026 Groq retiró los modelos Llama 3.x; Qwen 3.8 es el modelo de chat disponible
    terra: 'qwen/qwen3.8-27b',
    luna: 'qwen/qwen3.8-27b',
    parametroTokens: 'max_completion_tokens',
    requiereApiKey: true,
  },
  gemini: {
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    terra: 'gemini-3.5-flash',
    luna: 'gemini-3.5-flash-lite',
    // Los modelos Gemini "piensan" antes de responder; limitar tokens de salida
    // puede dejar la respuesta vacía, así que se controla con reasoning_effort.
    parametroTokens: null,
    requiereApiKey: true,
    extra: { reasoning_effort: 'low' },
  },
  custom: {
    terra: '',
    luna: '',
    parametroTokens: 'max_tokens',
    requiereApiKey: false,
  },
};

/** Configuración de un proveedor concreto para un nivel. */
export interface ConfigProveedor {
  proveedor: ProveedorReal;
  baseURL?: string;
  apiKey: string;
  modelo: string;
  parametroTokens: ParametroTokens;
  extra: Record<string, unknown>;
}

export interface ConfigIA {
  /** Etiqueta legible: "gemini", "gemini + groq" o "simulado". */
  proveedor: string;
  /** Proveedor principal de cada nivel (null = modo simulado). */
  niveles: Record<NivelModelo, ConfigProveedor | null>;
  /** Proveedor de respaldo de cada nivel (el del otro nivel, si es distinto). */
  respaldo: Record<NivelModelo, ConfigProveedor | null>;
  modelos: Record<NivelModelo, string>;
  maxTokens: number;
  timeoutMs: number;
  fallbackSimulado: boolean;
  advertencia?: string;
}

const NOMBRE_ENV: Record<NivelModelo, string> = { terra: 'TERRA', luna: 'LUNA' };

/**
 * Resuelve el proveedor de un nivel. Devuelve null (modo simulado) y una
 * advertencia si la configuración es inválida o falta la API key.
 */
function resolverProveedor(
  proveedor: ProveedorReal,
  nivel: NivelModelo,
  env: NodeJS.ProcessEnv,
  { usarOverrides }: { usarOverrides: boolean }
): { config: ConfigProveedor | null; advertencia?: string } {
  const preset = PRESETS[proveedor];
  const sufijo = NOMBRE_ENV[nivel];

  const apiKey =
    env[`${proveedor.toUpperCase()}_API_KEY`] ||
    env.AI_API_KEY ||
    (preset.requiereApiKey ? undefined : 'no-requerida');
  if (!apiKey) {
    return { config: null, advertencia: `${nivel}: el proveedor "${proveedor}" requiere ${proveedor.toUpperCase()}_API_KEY.` };
  }

  // Los overrides de URL y modelo solo aplican al proveedor elegido para el nivel,
  // no al proveedor que se usa como respaldo.
  const baseURL = (usarOverrides && (env[`AI_BASE_URL_${sufijo}`] || env.AI_BASE_URL)) || preset.baseURL;
  const modelo = (usarOverrides && env[`AI_MODEL_${sufijo}`]) || preset[nivel];

  if (proveedor === 'custom' && (!baseURL || !modelo)) {
    return { config: null, advertencia: `${nivel}: el proveedor "custom" requiere AI_BASE_URL y AI_MODEL_${sufijo}.` };
  }

  return {
    config: { proveedor, baseURL, apiKey, modelo, parametroTokens: preset.parametroTokens, extra: preset.extra ?? {} },
  };
}

/**
 * Resuelve la configuración de IA a partir de variables de entorno.
 * Función pura (recibe el env) para poder probarla sin efectos secundarios.
 *
 * - AI_PROVIDER define el proveedor de ambos niveles.
 * - AI_PROVIDER_TERRA / AI_PROVIDER_LUNA lo sobrescriben por nivel.
 * - Compatibilidad: sin AI_PROVIDER pero con OPENAI_API_KEY se usa OpenAI.
 */
export function resolverConfigIA(env: NodeJS.ProcessEnv = process.env): ConfigIA {
  const fallbackSimulado = env.AI_FALLBACK_SIMULADO !== 'false';
  const respaldoCruzado = env.AI_RESPALDO_CRUZADO !== 'false';
  const advertencias: string[] = [];

  const general = (env.AI_PROVIDER || '').trim().toLowerCase();
  const porDefecto = general || (env.OPENAI_API_KEY ? 'openai' : 'simulado');

  const elegidos = {} as Record<NivelModelo, string>;
  const niveles = {} as Record<NivelModelo, ConfigProveedor | null>;

  for (const nivel of NIVELES) {
    const especifico = (env[`AI_PROVIDER_${NOMBRE_ENV[nivel]}`] || '').trim().toLowerCase();
    const elegido = especifico || porDefecto;
    elegidos[nivel] = elegido;

    if (!(PROVEEDORES as readonly string[]).includes(elegido)) {
      advertencias.push(`${nivel}: "${elegido}" no es un proveedor válido. Usa uno de: ${PROVEEDORES.join(', ')}.`);
      niveles[nivel] = null;
    } else if (elegido === 'simulado') {
      niveles[nivel] = null;
    } else {
      const r = resolverProveedor(elegido as ProveedorReal, nivel, env, { usarOverrides: true });
      if (r.advertencia) advertencias.push(r.advertencia);
      niveles[nivel] = r.config;
    }
  }

  // Respaldo cruzado: si un nivel usa un proveedor y el otro nivel uno distinto,
  // el del otro nivel (con su modelo por defecto para este nivel) sirve de respaldo.
  const respaldo = { terra: null, luna: null } as Record<NivelModelo, ConfigProveedor | null>;
  if (respaldoCruzado) {
    for (const nivel of NIVELES) {
      const otro = niveles[nivel === 'terra' ? 'luna' : 'terra'];
      if (otro && otro.proveedor !== niveles[nivel]?.proveedor) {
        respaldo[nivel] = resolverProveedor(otro.proveedor, nivel, env, { usarOverrides: false }).config;
      }
    }
  }

  if (!niveles.terra && !niveles.luna && !general && !env.AI_PROVIDER_TERRA && !env.AI_PROVIDER_LUNA && !env.OPENAI_API_KEY) {
    advertencias.push('No hay proveedor de IA configurado; se usan respuestas simuladas.');
  }

  const etiqueta = (n: NivelModelo) => niveles[n]?.proveedor ?? 'simulado';
  const proveedor = etiqueta('terra') === etiqueta('luna') ? etiqueta('terra') : `${etiqueta('terra')} + ${etiqueta('luna')}`;

  const maxTokens = parseInt(env.AI_MAX_TOKENS || '', 10);
  const timeoutMs = parseInt(env.AI_TIMEOUT_MS || '', 10);

  return {
    proveedor,
    niveles,
    respaldo,
    modelos: {
      terra: niveles.terra?.modelo ?? 'simulado-terra',
      luna: niveles.luna?.modelo ?? 'simulado-luna',
    },
    maxTokens: Number.isFinite(maxTokens) && maxTokens > 0 ? maxTokens : 800,
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 60000,
    fallbackSimulado,
    advertencia: advertencias.length ? advertencias.join(' ') : undefined,
  };
}

// ─── Estado del proveedor (visible en /api/health y en el dashboard) ──────

const config = resolverConfigIA();

const clientes = new Map<string, OpenAI>();
function clientePara(p: ConfigProveedor): OpenAI {
  const clave = `${p.baseURL ?? 'openai'}|${p.apiKey}`;
  let cliente = clientes.get(clave);
  if (!cliente) {
    cliente = new OpenAI({ apiKey: p.apiKey, baseURL: p.baseURL, timeout: config.timeoutMs, maxRetries: 1 });
    clientes.set(clave, cliente);
  }
  return cliente;
}

type EstadoUltimaLlamada = 'sin-uso' | 'ok' | 'respaldo' | 'error' | 'simulado';

const hayProveedor = Boolean(config.niveles.terra || config.niveles.luna);
const estado: { ultimo: EstadoUltimaLlamada; error?: string; fecha?: string } = {
  ultimo: hayProveedor ? 'sin-uso' : 'simulado',
};

export function obtenerConfigIA(): Readonly<ConfigIA> {
  return config;
}

const describir = (p: ConfigProveedor | null) => (p ? { proveedor: p.proveedor, modelo: p.modelo, baseURL: p.baseURL ?? null } : null);

/** Información pública del proveedor (sin las API keys). */
export function infoIA() {
  return {
    proveedor: config.proveedor,
    modelos: config.modelos,
    niveles: { terra: describir(config.niveles.terra), luna: describir(config.niveles.luna) },
    respaldo: { terra: describir(config.respaldo.terra), luna: describir(config.respaldo.luna) },
    fallbackSimulado: config.fallbackSimulado,
    advertencia: config.advertencia ?? null,
    ultimaLlamada: estado.ultimo,
    ultimoError: estado.error ?? null,
    fechaUltimaLlamada: estado.fecha ?? null,
  };
}

// System prompt contextualizado al caso Klarna
const SYSTEM_PROMPT = `Eres un asistente virtual de atención al cliente de una empresa fintech de pagos (tipo Klarna).

Tu alcance de responsabilidades:
- Gestión de pagos: agendar, extender plazos, ajustar planes de cuotas
- Seguimiento de pedidos: estado, devoluciones, reembolsos
- Actualizaciones básicas de cuenta
- Preguntas sobre políticas y términos de servicio
- Explicación de denegaciones de compra

Reglas:
- Responde siempre en el mismo idioma que el usuario.
- Sé conciso (máximo 4 frases), amable y profesional.
- No inventes información sobre pedidos o pagos específicos — si no tienes datos, indica que verificarás.
- No menciones que eres un modelo de IA específico ni nombres técnicos de modelos.
- Si el usuario necesita algo fuera de tu alcance, sugiere amablemente que puede hablar con un representante humano.`;

export interface RespuestaIA {
  contenido: string;
  tokensEntrada: number;
  tokensSalida: number;
  modeloUsado: string;
  proveedorUsado: string;
  simulado: boolean;
}

export type MensajeHistorial = { role: 'user' | 'assistant'; content: string };

/** Llama a un proveedor concreto, sin respaldo. Lanza un error si falla. */
export async function llamarProveedor(
  p: ConfigProveedor,
  mensajeUsuario: string,
  historial: MensajeHistorial[]
): Promise<RespuestaIA> {
  const params: Record<string, unknown> = {
    model: p.modelo,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      ...historial,
      { role: 'user', content: mensajeUsuario },
    ],
    ...p.extra,
  };
  if (p.parametroTokens) {
    params[p.parametroTokens] = config.maxTokens;
  }

  const completion = await clientePara(p).chat.completions.create(
    params as unknown as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming
  );

  // Algunos modelos locales (deepseek-r1, qwen3) incluyen su razonamiento en <think>
  const contenido = limpiarRespuesta(completion.choices[0]?.message?.content);
  if (!contenido) {
    throw new Error('El modelo devolvió una respuesta vacía');
  }

  return {
    contenido,
    tokensEntrada: completion.usage?.prompt_tokens || estimarTokensEntrada(mensajeUsuario),
    tokensSalida: completion.usage?.completion_tokens || Math.ceil(contenido.length / 4),
    modeloUsado: p.modelo,
    proveedorUsado: p.proveedor,
    simulado: false,
  };
}

/**
 * Envía el mensaje al proveedor del nivel (Terra/Luna). Si falla, prueba con el
 * proveedor de respaldo; si ambos fallan y AI_FALLBACK_SIMULADO no es "false",
 * responde con una respuesta simulada para que el prototipo siga funcionando.
 */
export async function generarRespuesta(
  mensajeUsuario: string,
  historial: MensajeHistorial[],
  nivel: NivelModelo
): Promise<RespuestaIA> {
  const intentos = [config.niveles[nivel], config.respaldo[nivel]].filter((p): p is ConfigProveedor => p !== null);
  if (intentos.length === 0) {
    return respuestaSimulada(mensajeUsuario, nivel);
  }

  const errores: string[] = [];
  for (const [i, p] of intentos.entries()) {
    try {
      const respuesta = await llamarProveedor(p, mensajeUsuario, historial);
      estado.ultimo = i === 0 ? 'ok' : 'respaldo';
      estado.error = i === 0 ? undefined : errores.join(' | ');
      estado.fecha = new Date().toISOString();
      return respuesta;
    } catch (error: unknown) {
      const mensaje = error instanceof Error ? error.message : String(error);
      errores.push(`${p.proveedor}/${p.modelo}: ${mensaje}`);
      console.warn(`[IA ${nivel}] ${p.proveedor}/${p.modelo} falló: ${mensaje}`);
    }
  }

  estado.ultimo = 'error';
  estado.error = errores.join(' | ');
  estado.fecha = new Date().toISOString();

  if (!config.fallbackSimulado) {
    throw new Error(estado.error);
  }
  console.warn(`[IA ${nivel}] sin proveedores disponibles → usando respuesta simulada.`);
  return respuestaSimulada(mensajeUsuario, nivel);
}

export function limpiarRespuesta(texto: string | null | undefined): string {
  return (texto ?? '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

/**
 * Respuesta de respaldo basada en palabras clave. Permite probar el flujo
 * completo (router, consumo, saldo y alertas) sin un proveedor de IA activo.
 */
export function respuestaSimulada(mensajeUsuario: string, nivel: NivelModelo): RespuestaIA {
  const lower = mensajeUsuario
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

  let contenido =
    'Entiendo tu consulta. Puedes dividir tus compras en 3 o 4 cuotas sin intereses, consultar el estado de tus pedidos o adelantar pagos directamente desde la app.';

  if (/(pago|cuota|pagar|deuda|plazo)/.test(lower)) {
    contenido = 'Tu próximo pago está programado para el siguiente ciclo de facturación. Puedes pagarlo ahora con tarjeta de débito o crédito, o postergarlo hasta 14 días sin cargos adicionales desde la sección de Pagos.';
  } else if (/(devol|reembols|retorn)/.test(lower)) {
    contenido = 'Para gestionar una devolución, primero notifica a la tienda donde compraste y luego regístrala en la app. Pausaremos tus cuotas mientras el comercio procesa la recepción de los artículos.';
  } else if (/(pedido|envio|entrega|orden)/.test(lower)) {
    contenido = 'Puedes ver el estado de tu pedido en la sección "Compras" de la app. Si el comercio ya lo despachó, allí encontrarás el número de seguimiento.';
  } else if (/(denegad|rechaz|aprobar|negaron)/.test(lower)) {
    contenido = 'Cada solicitud de compra se evalúa individualmente considerando tu historial y el monto solicitado. Te recomendamos verificar que tus datos de pago estén actualizados.';
  } else if (/\b(hola|buenas|buenos dias)\b/.test(lower)) {
    contenido = '¡Hola! Soy tu asistente virtual. Puedo ayudarte con pagos, pedidos, devoluciones y dudas sobre tu cuenta. ¿Qué necesitas?';
  }

  return {
    contenido,
    tokensEntrada: estimarTokensEntrada(mensajeUsuario),
    tokensSalida: Math.ceil(contenido.length / 4),
    modeloUsado: `simulado-${nivel}`,
    proveedorUsado: 'simulado',
    simulado: true,
  };
}
