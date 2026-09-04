// API Service Layer — Fetch wrappers para cada endpoint del backend

const API_BASE = '/api';

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
  agente?: string;
  motivo?: string;
  _debug?: {
    modelo: string;
    motivo: string;
    tokensEntrada: number;
    tokensSalida: number;
    costo: number;
  };
}

export function enviarMensaje(userId: number, contenido: string, conversacionId?: number): Promise<MensajeResponse> {
  return fetchJSON('/mensajes', {
    method: 'POST',
    body: JSON.stringify({ userId, contenido, conversacionId }),
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
