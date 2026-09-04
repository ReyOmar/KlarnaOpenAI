// Cálculo de costo por conversación
// Fórmula: (tokens_entrada / 1,000,000 × precio_entrada) + (tokens_salida / 1,000,000 × precio_salida)

export interface ModeloPricing {
  costoEntradaMusd: number; // USD por millón de tokens de entrada
  costoSalidaMusd: number;  // USD por millón de tokens de salida
}

/**
 * Calcula el costo en USD de una llamada a la API.
 */
export function calcularCostoConversacion(
  modelo: ModeloPricing,
  tokensEntrada: number,
  tokensSalida: number
): number {
  const costoEntrada = (tokensEntrada / 1_000_000) * modelo.costoEntradaMusd;
  const costoSalida = (tokensSalida / 1_000_000) * modelo.costoSalidaMusd;
  return Math.round((costoEntrada + costoSalida) * 1_000_000) / 1_000_000; // 6 decimales
}

/**
 * Estima tokens de entrada basado en el contenido del mensaje.
 * Aproximación: ~4 caracteres por token (razonable para español/inglés).
 * Se suma un overhead del system prompt (~200 tokens).
 */
export function estimarTokensEntrada(contenido: string): number {
  const tokensContenido = Math.ceil(contenido.length / 4);
  const overheadSystemPrompt = 200;
  return tokensContenido + overheadSystemPrompt;
}
