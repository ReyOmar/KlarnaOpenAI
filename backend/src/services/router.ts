// Router de consultas — Dos decisiones en cascada (spec sección 5)
// Decisión 1: ¿Requiere handoff a un agente humano?
// Decisión 2: Si no, ¿qué modelo usar (Terra/Luna)?

export type RouterResult =
  | { tipo: 'handoff'; motivo: string }
  | { tipo: 'terra'; motivo: string }
  | { tipo: 'luna'; motivo: string };

interface Patron {
  etiqueta: string;
  regex: RegExp;
}

/**
 * Normaliza el texto para comparar sin depender de mayúsculas ni tildes:
 * "¿Pásame con un AGENTE?" → "¿pasame con un agente?"
 */
export function normalizarTexto(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── Patrones de detección (sobre texto normalizado, sin tildes) ──────

// Frases que fuerzan escalamiento a humano
const HANDOFF_PATTERNS: Patron[] = [
  // Petición explícita del usuario
  { etiqueta: 'solicitud de representante', regex: /\brepresentante\b/ },
  { etiqueta: 'solicitud de agente humano', regex: /\b(agente|asesor|operador)\s+(humano|real)\b/ },
  { etiqueta: 'solicitud de agente humano', regex: /\b(hablar|comunicarme|pasame|conectar|contactar)\b.*\b(humano|persona|alguien|agente|asesor|operador|soporte)\b/ },
  { etiqueta: 'solicitud de agente humano', regex: /\b(necesito|quiero|prefiero)\s+(un|una)\s+(agente|asesor|operador|persona)\b/ },
  { etiqueta: 'solicitud de agente humano', regex: /\b(speak|talk)\s+to\s+(a|an)\s+(human|person|agent|representative)\b/ },

  // Disputas complejas
  { etiqueta: 'disputa', regex: /\bdisputa/ },
  { etiqueta: 'cargo no reconocido', regex: /cargo (no reconocido|fraudulento|indebido|duplicado)/ },
  { etiqueta: 'cobro indebido', regex: /(cobro indebido|doble cobro|cobraron (dos veces|doble))/ },
  { etiqueta: 'transaccion no autorizada', regex: /(no autorice|no reconozco|unauthorized charge)/ },

  // Problemas de acceso / fraude
  { etiqueta: 'cuenta bloqueada', regex: /(cuenta bloqueada|me bloquearon|account locked)/ },
  { etiqueta: 'problema de acceso', regex: /no puedo (acceder|entrar|iniciar sesion)/ },
  { etiqueta: 'verificacion de identidad', regex: /verificacion de identidad/ },
  { etiqueta: 'fraude', regex: /\b(fraude|estafa|robo de identidad|suplantacion)\b/ },
  { etiqueta: 'cuenta comprometida', regex: /\b(hackeo|hackearon|hackeada|hacked)\b/ },

  // Casos borde / legales
  { etiqueta: 'caso legal', regex: /\b(demanda|demandar|abogado|legal|regulador|queja formal|denuncia)\b/ },
];

// Indicadores de consulta compleja → Terra
const COMPLEX_PATTERNS: Patron[] = [
  // Operaciones financieras sensibles
  { etiqueta: 'reembolso', regex: /\b(reembols|refund)/ },
  { etiqueta: 'devolucion', regex: /\bdevol/ },
  { etiqueta: 'cancelar pago', regex: /cancelar.*(pago|cuota|compra)/ },
  { etiqueta: 'modificar plan', regex: /(modificar|cambiar|ajustar).*(plan|cuotas)/ },
  { etiqueta: 'extender plazo', regex: /(extender|ampliar|aplazar|postergar).*(plazo|pago|fecha)/ },
  { etiqueta: 'cambiar metodo de pago', regex: /cambiar.*(metodo de pago|tarjeta)/ },

  // Análisis de cuenta
  { etiqueta: 'estado de cuenta', regex: /(explica|explicame|detalle).*(estado de cuenta|factura)/ },
  { etiqueta: 'explicacion de cobro', regex: /por que me (cobraron|cobran)/ },
  { etiqueta: 'desglose', regex: /\b(desglose|historial de pagos|explain my statement)\b/ },

  // Denegaciones
  { etiqueta: 'denegacion', regex: /(por que me (negaron|rechazaron)|denegacion|denegad|rechazaron mi compra|declined)/ },
];

// Umbral de longitud a partir del cual la consulta se considera compleja
const LONGITUD_COMPLEJA = 200;

// ─── Motor de clasificación ──────────────────────────────

/**
 * Clasifica una consulta del usuario según las reglas del router.
 *
 * Decisión 1 — Handoff: escala a humano si detecta patrones de disputa,
 * acceso, fraude, caso borde, o petición explícita.
 *
 * Decisión 2 — Modelo: si la consulta es compleja o sensible → Terra;
 * si es simple y de bajo riesgo → Luna.
 *
 * Punto de extensión: esta función puede ser reemplazada por un
 * clasificador ML más sofisticado en el futuro.
 */
export function clasificarConsulta(contenido: string): RouterResult {
  const texto = normalizarTexto(contenido);

  // ─── Decisión 1: ¿Handoff? ─────────────────────────────
  const handoff = HANDOFF_PATTERNS.find((p) => p.regex.test(texto));
  if (handoff) {
    return {
      tipo: 'handoff',
      motivo: `Escalamiento: ${handoff.etiqueta}`,
    };
  }

  // ─── Decisión 2: ¿Terra o Luna? ────────────────────────
  const compleja = COMPLEX_PATTERNS.find((p) => p.regex.test(texto));
  if (compleja) {
    return {
      tipo: 'terra',
      motivo: `Consulta compleja/sensible: ${compleja.etiqueta}`,
    };
  }

  // Consultas largas tienden a ser más complejas
  if (texto.length > LONGITUD_COMPLEJA) {
    return {
      tipo: 'terra',
      motivo: `Consulta extensa (> ${LONGITUD_COMPLEJA} caracteres), posible complejidad`,
    };
  }

  // Consultas con signos de interrogación múltiples → múltiples temas
  const questionMarks = (texto.match(/\?/g) || []).length;
  if (questionMarks >= 2) {
    return {
      tipo: 'terra',
      motivo: `Múltiples preguntas detectadas (${questionMarks})`,
    };
  }

  // Default: consulta simple → Luna (modelo económico)
  return {
    tipo: 'luna',
    motivo: 'Consulta simple y de bajo riesgo',
  };
}
