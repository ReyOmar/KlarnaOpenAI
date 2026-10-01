// API Service Layer — Fetch wrappers para cada endpoint del backend

// En desarrollo Vite redirige /api al backend (ver vite.config.ts).
// Si el frontend se despliega en otro dominio, define VITE_API_URL=https://mi-backend.com
const API_BASE = `${(import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')}/api`;

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Error desconocido' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

// ─── Mensajes ───────────────────────────────────────────

export type MensajeResponse = {
  tipo: 'respuesta' | 'handoff';
  conversacionId: number;
  mensaje: {
    id: number;
    remitente: 'ASISTENTE' | 'AGENTE_HUMANO';
    contenido: string;
    timestamp: string;
  };
  agente?: string | null;
  motivo?: string;
  simulado?: boolean;
  _debug?: {
    modelo: string;
    modeloApi: string;
    proveedor: string;
    motivo: string;
    tokensEntrada: number;
    tokensSalida: number;
    costo: number;
  };
}

export function enviarMensaje(userId: number, contenido: string, conversacionId?: number | null): Promise<MensajeResponse> {
  return fetchJSON('/mensajes', {
    method: 'POST',
    body: JSON.stringify({ userId, contenido, conversacionId: conversacionId ?? undefined }),
  });
}

// ─── Saldo ──────────────────────────────────────────────

export type SaldoResponse = {
  saldoActual: number;
  recargaDiaria: number;
  consumoDiario: number;
  consumoPromedio7d: number;
  diasHastaAgotamiento: number | '∞';
  presupuestoMensual: number;
  umbralAlerta: number;
  fecha: string;
}

export function obtenerSaldo(): Promise<SaldoResponse> {
  return fetchJSON('/saldo');
}

export type SaldoHistorial = {
  fecha: string;
  saldoCt: number;
  recargaR: number;
  consumoU: number;
}

export function obtenerSaldoHistorial(dias: number = 30): Promise<SaldoHistorial[]> {
  return fetchJSON(`/saldo/historial?dias=${dias}`);
}

// ─── Alertas ────────────────────────────────────────────

export type Alerta = {
  id: number;
  tipo: 'BAJO' | 'CRITICO' | 'AGOTADO';
  umbralUsd: number;
  estado: 'ACTIVA' | 'RESUELTA' | 'IGNORADA';
  fecha: string;
  saldo: {
    fecha: string;
    saldoCt: number;
  };
}

export function obtenerAlertas(): Promise<Alerta[]> {
  return fetchJSON('/alertas');
}

export function resolverAlerta(id: number): Promise<Alerta> {
  return fetchJSON(`/alertas/${id}/resolver`, {
    method: 'PATCH',
  });
}

// ─── Handoffs ───────────────────────────────────────────

export type Handoff = {
  id: number;
  motivo: string;
  estado: 'PENDIENTE' | 'ASIGNADO' | 'RESUELTO';
  fecha: string;
  agente: {
    nombre: string;
    email: string;
  } | null;
  conversacion: {
    id: number;
    usuario: {
      nombre: string;
    };
  };
}

export function obtenerHandoffs(): Promise<Handoff[]> {
  return fetchJSON('/handoffs');
}

// ─── Modelos ────────────────────────────────────────────

export type ModeloDistribucion = {
  id: number;
  nombre: string;
  nombreApi: string;
  consultas: number;
  costoTotal: number;
  tokensEntradaTotal: number;
  tokensSalidaTotal: number;
  porcentajeConsultas: string;
  porcentajeCosto: string;
}

export type DistribucionResponse = {
  modelos: ModeloDistribucion[];
  totalConsultas: number;
  totalCosto: number;
  proveedor: string;
}

export function obtenerDistribucion(): Promise<DistribucionResponse> {
  return fetchJSON('/modelos/distribucion');
}

// ─── Configuración ──────────────────────────────────────

export type Configuracion = {
  id: number;
  presupuestoMensual: number;
  umbralAlerta: number;
  fechaActualizacion: string;
}

export function obtenerConfiguracion(): Promise<Configuracion> {
  return fetchJSON('/configuracion');
}

export function actualizarConfiguracion(data: Partial<Pick<Configuracion, 'presupuestoMensual' | 'umbralAlerta'>>): Promise<Configuracion> {
  return fetchJSON('/configuracion', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// ─── Health ─────────────────────────────────────────────

export type HealthResponse = {
  status: 'ok' | 'degradado';
  baseDatos: boolean;
  ia: {
    proveedor: string;
    modelos: { terra: string; luna: string };
    fallbackSimulado: boolean;
    advertencia: string | null;
    ultimaLlamada: 'sin-uso' | 'ok' | 'respaldo' | 'error' | 'simulado';
    ultimoError: string | null;
    fechaUltimaLlamada: string | null;
  };
  timestamp: string;
}

export function obtenerHealth(): Promise<HealthResponse> {
  return fetchJSON('/health');
}

// ─── Simulación ─────────────────────────────────────────

export type ParametrosSimulacion = {
  conversacionesDiarias: number;
  crecimientoMensualPct: number;
  variabilidadPct: number;
  porcentajeHandoff: number;
  porcentajeTerra: number;
  tokensEntrada: number;
  tokensSalida: number;
  factorPrecios: number;
  presupuestoMensual: number;
  saldoInicial: number;
  umbralAlerta: number;
  dias: number;
  corridas: number;
  semilla: number;
}

export type IndicadoresSimulacion = {
  saldoFinal: number;
  consumoPromedioDiario: number;
  costoTotal: number;
  recargaDiaria: number;
  costoPorConversacionIA: number;
  diaAlerta: number | null;
  diaAgotamiento: number | null;
  diasSinServicio: number;
  conversacionesNoAtendidas: number;
  probabilidadAgotamiento: number;
  presupuestoMinimoSostenible: number;
}

export type ResultadoSimulacion = {
  parametros: ParametrosSimulacion;
  serie: { dia: number; saldo: number; consumo: number; recarga: number; saldoP5?: number; saldoP95?: number }[];
  indicadores: IndicadoresSimulacion;
}

export type EscenarioPredefinido = {
  id: string;
  nombre: string;
  descripcion: string;
  parametro: keyof ParametrosSimulacion | null;
  cambios: Partial<ParametrosSimulacion>;
}

export type ComparacionEscenario = EscenarioPredefinido & {
  indicadores: IndicadoresSimulacion;
  serie: { dia: number; saldo: number }[];
}

export function obtenerEscenarios(): Promise<{ base: ParametrosSimulacion; escenarios: EscenarioPredefinido[] }> {
  return fetchJSON('/simulacion/escenarios');
}

export function obtenerComparacion(): Promise<ComparacionEscenario[]> {
  return fetchJSON('/simulacion/comparacion');
}

export function simular(parametros: Partial<ParametrosSimulacion>): Promise<ResultadoSimulacion> {
  return fetchJSON('/simulacion', {
    method: 'POST',
    body: JSON.stringify(parametros),
  });
}
