// Cliente de IA multi-proveedor
// Usa el SDK de OpenAI contra cualquier API compatible (OpenAI, Ollama, Groq,
// Gemini, OpenRouter, LM Studio...). Solo cambia la baseURL, la clave y el modelo.
// NOTA: "Terra" y "Luna" son nombres internos del proyecto (ver spec sección 2):
// Terra = modelo capaz, Luna = modelo económico.

import OpenAI from 'openai';
import { estimarTokensEntrada } from './consumo';

export type NivelModelo = 'terra' | 'luna';

export const PROVEEDORES = ['openai', 'ollama', 'groq', 'gemini', 'custom', 'simulado'] as const;
export type Proveedor = (typeof PROVEEDORES)[number];

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
// AI_BASE_URL, AI_MODEL_TERRA y AI_MODEL_LUNA.
const PRESETS: Record<Exclude<Proveedor, 'simulado'>, Preset> = {
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
    terra: 'llama-3.3-70b-versatile',
    luna: 'llama-3.1-8b-instant',
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

export interface ConfigIA {
  proveedor: Proveedor;
  baseURL?: string;
  apiKey?: string;
  modelos: Record<NivelModelo, string>;
  parametroTokens: ParametroTokens;
  maxTokens: number;
  timeoutMs: number;
  fallbackSimulado: boolean;
  extra: Record<string, unknown>;
  advertencia?: string;
}

function configSimulada(advertencia?: string, fallbackSimulado = true): ConfigIA {
  return {
    proveedor: 'simulado',
    modelos: { terra: 'simulado-terra', luna: 'simulado-luna' },
    parametroTokens: null,
    maxTokens: 0,
    timeoutMs: 0,
    fallbackSimulado,
    extra: {},
    advertencia,
  };
}

/**
 * Resuelve la configuración de IA a partir de variables de entorno.
 * Función pura (recibe el env) para poder probarla sin efectos secundarios.
 *
 * Compatibilidad: si no se define AI_PROVIDER pero existe OPENAI_API_KEY,
 * se usa OpenAI como antes.
 */
export function resolverConfigIA(env: NodeJS.ProcessEnv = process.env): ConfigIA {
  const valor = (env.AI_PROVIDER || '').trim().toLowerCase();
  const fallbackSimulado = env.AI_FALLBACK_SIMULADO !== 'false';

  let proveedor: Proveedor;
  if (!valor) {
    proveedor = env.OPENAI_API_KEY ? 'openai' : 'simulado';
  } else if ((PROVEEDORES as readonly string[]).includes(valor)) {
    proveedor = valor as Proveedor;
  } else {
    return configSimulada(
      `AI_PROVIDER="${valor}" no es válido. Usa uno de: ${PROVEEDORES.join(', ')}.`,
      fallbackSimulado
    );
  }

  if (proveedor === 'simulado') {
    return configSimulada(
      valor ? undefined : 'No hay proveedor de IA configurado; se usan respuestas simuladas.',
      fallbackSimulado
    );
  }

  const preset = PRESETS[proveedor];
  const apiKey =
    env.AI_API_KEY ||
    (proveedor === 'openai' ? env.OPENAI_API_KEY : undefined) ||
    (preset.requiereApiKey ? undefined : 'no-requerida');

  if (!apiKey) {
    return configSimulada(`El proveedor "${proveedor}" requiere AI_API_KEY.`, fallbackSimulado);
  }

  const baseURL = env.AI_BASE_URL || preset.baseURL;
  const modelos = {
    terra: env.AI_MODEL_TERRA || preset.terra,
    luna: env.AI_MODEL_LUNA || preset.luna,
  };

  if (proveedor === 'custom' && (!baseURL || !modelos.terra || !modelos.luna)) {
    return configSimulada(
      'El proveedor "custom" requiere AI_BASE_URL, AI_MODEL_TERRA y AI_MODEL_LUNA.',
      fallbackSimulado
    );
  }

  const maxTokens = parseInt(env.AI_MAX_TOKENS || '', 10);
  const timeoutMs = parseInt(env.AI_TIMEOUT_MS || '', 10);

  return {
    proveedor,
    baseURL,
    apiKey,
    modelos,
    parametroTokens: preset.parametroTokens,
    maxTokens: Number.isFinite(maxTokens) && maxTokens > 0 ? maxTokens : 800,
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 60000,
    fallbackSimulado,
    extra: preset.extra ?? {},
  };
}

// ─── Estado del proveedor (visible en /api/health y en el dashboard) ──────

const config = resolverConfigIA();

const cliente =
  config.proveedor === 'simulado'
    ? null
    : new OpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseURL,
        timeout: config.timeoutMs,
        maxRetries: 1,
      });

type EstadoUltimaLlamada = 'sin-uso' | 'ok' | 'error' | 'simulado';

const estado: { ultimo: EstadoUltimaLlamada; error?: string; fecha?: string } = {
  ultimo: config.proveedor === 'simulado' ? 'simulado' : 'sin-uso',
};

export function obtenerConfigIA(): Readonly<ConfigIA> {
  return config;
}

/** Información pública del proveedor (sin la API key). */
export function infoIA() {
  return {
    proveedor: config.proveedor,
    baseURL: config.baseURL ?? null,
    modelos: config.modelos,
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
  simulado: boolean;
}

export type MensajeHistorial = { role: 'user' | 'assistant'; content: string };

/**
 * Envía el mensaje al modelo correspondiente al nivel (Terra/Luna) y devuelve
 * la respuesta con el uso de tokens. Si el proveedor falla (sin créditos, sin
 * red, modelo inexistente...) y AI_FALLBACK_SIMULADO no es "false", responde
 * con una respuesta simulada para que el prototipo siga funcionando.
 */
export async function generarRespuesta(
  mensajeUsuario: string,
  historial: MensajeHistorial[],
  nivel: NivelModelo
): Promise<RespuestaIA> {
  if (!cliente) {
    return respuestaSimulada(mensajeUsuario, nivel);
  }

  const modelo = config.modelos[nivel];

  try {
    const params: Record<string, unknown> = {
      model: modelo,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...historial,
        { role: 'user', content: mensajeUsuario },
      ],
      ...config.extra,
    };
    if (config.parametroTokens) {
      params[config.parametroTokens] = config.maxTokens;
    }

    const completion = await cliente.chat.completions.create(
      params as unknown as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming
    );

    // Algunos modelos locales (deepseek-r1, qwen3) incluyen su razonamiento en <think>
    const contenido = limpiarRespuesta(completion.choices[0]?.message?.content);
    if (!contenido) {
      throw new Error('El modelo devolvió una respuesta vacía');
    }

    estado.ultimo = 'ok';
    estado.error = undefined;
    estado.fecha = new Date().toISOString();

    return {
      contenido,
      tokensEntrada: completion.usage?.prompt_tokens || estimarTokensEntrada(mensajeUsuario),
      tokensSalida: completion.usage?.completion_tokens || Math.ceil(contenido.length / 4),
      modeloUsado: modelo,
      simulado: false,
    };
  } catch (error: unknown) {
    const mensaje = error instanceof Error ? error.message : String(error);
    estado.ultimo = 'error';
    estado.error = mensaje;
    estado.fecha = new Date().toISOString();

    if (!config.fallbackSimulado) {
      throw error;
    }

    console.warn(`[IA ${config.proveedor}/${modelo}] ${mensaje} → usando respuesta simulada.`);
    return respuestaSimulada(mensajeUsuario, nivel);
  }
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
    simulado: true,
  };
}
