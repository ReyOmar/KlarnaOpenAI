// Router de consultas — Dos decisiones en cascada (spec sección 5)
// Decisión 1: ¿Requiere handoff a un agente humano?
// Decisión 2: Si no, ¿qué modelo usar (Terra/Luna)?

export type RouterResult =
  | { tipo: 'handoff'; motivo: string }
  | { tipo: 'terra'; motivo: string }
  | { tipo: 'luna'; motivo: string };

// ─── Patrones de detección ────────────────────────────────

// Frases que fuerzan escalamiento a humano
const HANDOFF_PATTERNS = [
  // Petición explícita del usuario
  'quiero un representante',
  'hablar con un humano',
  'hablar con una persona',
  'quiero hablar con alguien',
  'necesito un agente',
  'prefiero un representante',
  'pásame con un agente',
  'conectar con soporte',
  'want to speak to a human',
  'talk to a representative',
  'speak to an agent',

  // Disputas complejas
  'disputa',
  'cargo no reconocido',
  'cargo fraudulento',
  'no autoricé',
  'cobro indebido',
  'doble cobro',
  'unauthorized charge',

  // Problemas de acceso / fraude
  'cuenta bloqueada',
  'no puedo acceder',
  'verificación de identidad',
  'fraude',
  'robo de identidad',
  'hackeo',
  'hackearon',
  'account locked',

  // Casos borde / legales
  'demanda',
  'abogado',
  'legal',
  'regulador',
  'queja formal',
];

// Indicadores de consulta compleja → Terra
const COMPLEX_PATTERNS = [
  // Operaciones financieras sensibles
  'reembolso',
  'devolución',
  'cancelar pago',
  'modificar plan',
  'extender plazo',
  'ajustar cuotas',
  'cambiar método de pago',
  'refund',

  // Análisis de cuenta
  'explica mi estado de cuenta',
  'por qué me cobraron',
  'desglose',
  'historial de pagos',
  'explain my statement',

  // Denegaciones
  'por qué me negaron',
  'denegación',
  'rechazaron mi compra',
  'declined',

  // Múltiples temas o consultas largas (se evalúa por longitud más abajo)
];

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
  const texto = contenido.toLowerCase().trim();

  // ─── Decisión 1: ¿Handoff? ─────────────────────────────
  for (const pattern of HANDOFF_PATTERNS) {
    if (texto.includes(pattern)) {
      return {
        tipo: 'handoff',
        motivo: `Detectado patrón de escalamiento: "${pattern}"`,
      };
    }
  }

  // ─── Decisión 2: ¿Terra o Luna? ────────────────────────

  // Verificar patrones complejos
  for (const pattern of COMPLEX_PATTERNS) {
    if (texto.includes(pattern)) {
      return {
        tipo: 'terra',
        motivo: `Consulta compleja/sensible: "${pattern}"`,
      };
    }
  }

  // Consultas largas (> 200 caracteres) tienden a ser más complejas
  if (texto.length > 200) {
    return {
      tipo: 'terra',
      motivo: 'Consulta extensa (> 200 caracteres), posible complejidad',
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

/**
 * Verifica si una consulta está dentro del alcance permitido de la IA.
 * Basado en las reglas reales de Klarna (spec sección 5).
 */
export function estaEnAlcance(contenido: string): boolean {
  const texto = contenido.toLowerCase();
  
  const temasPermitidos = [
    // Gestión de pagos
    'pago', 'cuota', 'plan', 'plazo', 'factura',
    // Seguimiento de pedidos
    'pedido', 'orden', 'envío', 'entrega', 'devolución', 'reembolso', 'estado',
    // Cuenta
    'cuenta', 'perfil', 'datos', 'contraseña',
    // Políticas
    'política', 'términos', 'condiciones',
    // Denegaciones
    'denegación', 'rechazaron', 'negaron',
    // Saludos y consultas generales (aceptar siempre)
    'hola', 'buenos', 'gracias', 'ayuda', 'help',
    // English equivalents
    'payment', 'order', 'delivery', 'return', 'account', 'policy',
  ];

  // Si contiene al menos un tema permitido, está en alcance
  return temasPermitidos.some(tema => texto.includes(tema)) || texto.length < 50;
}
