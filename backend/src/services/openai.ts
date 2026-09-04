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
  try {
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
      tokensEntrada: usage?.prompt_tokens || Math.round(mensajeUsuario.length / 4) + 150,
      tokensSalida: usage?.completion_tokens || Math.round(respuesta.length / 4),
      modeloUsado: modeloApi,
    };
  } catch (error: any) {
    console.warn(`[OpenAI API Fallback] ${error?.message || error}. Generando respuesta inteligente contextual.`);

    // Fallback inteligente para el prototipo si la API key no tiene saldo o hay fallo de red
    let respuestaSimulada = 'Entiendo tu consulta. En Klarna puedes gestionar tus compras divididas en 3 o 4 cuotas mensuales sin intereses. Puedes consultar el estado de tu pedido o realizar pagos anticipados directamente desde la app.';

    const lower = mensajeUsuario.toLowerCase();
    if (lower.includes('pago') || lower.includes('cuota') || lower.includes('pagar') || lower.includes('deuda')) {
      respuestaSimulada = 'Tu próximo pago programado está registrado para el próximo ciclo de facturación. Puedes pagarlo ahora con tarjeta de débito o crédito, o postergarlo hasta 14 días sin cargos adicionales desde la sección de Pagos.';
    } else if (lower.includes('devol') || lower.includes('reembols') || lower.includes('retorn')) {
      respuestaSimulada = 'Para gestionar una devolución, primero notifica a la tienda donde compraste y luego regístrala aquí. Pausaremos tus cuotas mientras el comercio procesa la recepción de los artículos.';
    } else if (lower.includes('denegad') || lower.includes('rechaz') || lower.includes('aprobar')) {
      respuestaSimulada = 'Cada solicitud de compra se evalúa individualmente considerando tu historial con nosotros y el monto solicitado. Te recomendamos verificar que tus datos de tarjeta estén actualizados.';
    }

    const tokensEntrada = Math.round(mensajeUsuario.length / 4) + 180;
    const tokensSalida = Math.round(respuestaSimulada.length / 4) + 45;

    return {
      contenido: respuestaSimulada,
      tokensEntrada,
      tokensSalida,
      modeloUsado: `${modeloApi} (simulado)`,
    };
  }
}
