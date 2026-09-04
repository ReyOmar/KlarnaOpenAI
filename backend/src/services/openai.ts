// Cliente OpenAI con selección dinámica de modelo
// NOTA: "Terra" y "Luna" son nombres internos del proyecto (ver spec sección 2).
// Terra → gpt-4o (modelo capaz), Luna → gpt-4o-mini (modelo económico)

import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
- Sé conciso, amable y profesional.
- No inventes información sobre pedidos o pagos específicos — si no tienes datos, indica que verificarás.
- No menciones que eres un modelo de IA específico ni nombres técnicos de modelos.
- Si el usuario necesita algo fuera de tu alcance, sugiere amablemente que puede hablar con un representante humano.`;

export interface OpenAIResponse {
  contenido: string;
  tokensEntrada: number;
  tokensSalida: number;
  modeloUsado: string;
}

/**
 * Envía un mensaje al modelo de OpenAI seleccionado y retorna la respuesta
 * junto con el uso de tokens.
 */
export async function enviarMensaje(
  mensajeUsuario: string,
  historialConversacion: { role: 'user' | 'assistant'; content: string }[],
  modeloApi: string // 'gpt-4o' o 'gpt-4o-mini'
): Promise<OpenAIResponse> {
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...historialConversacion,
    { role: 'user', content: mensajeUsuario },
  ];

  const completion = await openai.chat.completions.create({
    model: modeloApi,
    messages,
    max_tokens: 500,
    temperature: 0.7,
  });

  const respuesta = completion.choices[0]?.message?.content || 'Lo siento, no pude procesar tu consulta.';
  const usage = completion.usage;

  return {
    contenido: respuesta,
    tokensEntrada: usage?.prompt_tokens || 0,
    tokensSalida: usage?.completion_tokens || 0,
    modeloUsado: modeloApi,
  };
}
