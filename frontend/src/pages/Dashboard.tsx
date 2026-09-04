// Dashboard — Panel de administración (spec §7.2)
// Visualiza saldo, consumo, distribución de modelos, alertas y handoffs

import { useState, useEffect, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Area, AreaChart,
  BarChart, Bar, Legend
} from 'recharts';
import {
  obtenerSaldo, obtenerSaldoHistorial, obtenerAlertas,
  obtenerHandoffs, obtenerDistribucion, obtenerConfiguracion,
  actualizarConfiguracion,
} from '../services/api';
import type {
  SaldoResponse, SaldoHistorial, Alerta, Handoff,
  DistribucionResponse, Configuracion
} from '../services/api';
import '../styles/dashboard.css';

type Section = 'resumen' | 'alertas' | 'enrutamiento' | 'handoffs' | 'configuracion';

export default function Dashboard() {
  const [activeSection, setActiveSection] = useState<Section>('resumen');
  const [saldo, setSaldo] = useState<SaldoResponse | null>(null);
  const [historial, setHistorial] = useState<SaldoHistorial[]>([]);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [handoffs, setHandoffs] = useState<Handoff[]>([]);
  const [distribucion, setDistribucion] = useState<DistribucionResponse | null>(null);
  const [config, setConfig] = useState<Configuracion | null>(null);
  const [configForm, setConfigForm] = useState({ presupuesto: '', umbral: '' });
  const [configSaved, setConfigSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchAllData = useCallback(async () => {
    try {
      const [saldoData, historialData, alertasData, handoffsData, distData, configData] =
        await Promise.all([
          obtenerSaldo(),
          obtenerSaldoHistorial(30),
          obtenerAlertas(),
          obtenerHandoffs(),
          obtenerDistribucion(),
          obtenerConfiguracion(),
        ]);

      setSaldo(saldoData);
      setHistorial(historialData);
      setAlertas(alertasData);
      setHandoffs(handoffsData);
      setDistribucion(distData);
      setConfig(configData);
      setConfigForm({
        presupuesto: configData.presupuestoMensual.toString(),
        umbral: configData.umbralAlerta.toString(),
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllData();
    // Polling cada 30 segundos
    const interval = setInterval(fetchAllData, 30000);
    return () => clearInterval(interval);
  }, [fetchAllData]);

  const handleSaveConfig = async () => {
    try {
      const updated = await actualizarConfiguracion({
        presupuestoMensual: parseFloat(configForm.presupuesto),
        umbralAlerta: parseFloat(configForm.umbral),
      });
      setConfig(updated);
      setConfigSaved(true);
      setTimeout(() => setConfigSaved(false), 3000);
    } catch (error) {
      console.error('Error saving config:', error);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
    });
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const chartData = historial.map(h => ({
    fecha: formatDate(h.fecha),
    saldo: h.saldoCt,
    consumo: h.consumoU,
    recarga: h.recargaR,
  }));

  // Custom tooltip for charts
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{
        background: 'rgba(12, 12, 17, 0.95)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '8px',
        padding: '12px 16px',
        fontSize: '13px',
      }}>
        <div style={{ color: '#9d9daa', marginBottom: '6px' }}>{label}</div>
        {payload.map((p: any, i: number) => (
          <div key={i} style={{ color: p.color, marginTop: '2px' }}>
            {p.name}: {formatCurrency(p.value)}
          </div>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="dashboard-layout">
        <div className="dashboard-main" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: 0 }}>
          <div style={{ textAlign: 'center', color: 'var(--text-tertiary)' }}>
            <div style={{ fontSize: '2rem', marginBottom: '1rem', animation: 'pulse 1.5s infinite' }}>◆</div>
            Cargando dashboard...
          </div>
        </div>
      </div>
    );
  }

  const sectionTitles: Record<Section, string> = {
    resumen: 'Resumen',
    alertas: 'Alertas',
    enrutamiento: 'Enrutamiento de modelos',
    handoffs: 'Handoffs',
    configuracion: 'Configuración',
  };

  return (
    <div className="dashboard-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <div className="sidebar-logo">PM</div>
            <div>
              <div className="sidebar-brand-name">Prompt Maestro</div>
              <div className="sidebar-brand-sub">Panel Admin</div>
            </div>
          </div>
        </div>
        <nav className="sidebar-nav">
          <button
            className={`sidebar-link ${activeSection === 'resumen' ? 'active' : ''}`}
            onClick={() => setActiveSection('resumen')}
            id="nav-resumen"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
            </svg>
            Resumen
          </button>
          <button
            className={`sidebar-link ${activeSection === 'alertas' ? 'active' : ''}`}
            onClick={() => setActiveSection('alertas')}
            id="nav-alertas"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            Alertas
          </button>
          <button
            className={`sidebar-link ${activeSection === 'enrutamiento' ? 'active' : ''}`}
            onClick={() => setActiveSection('enrutamiento')}
            id="nav-enrutamiento"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 3 21 3 21 8" /><line x1="4" y1="20" x2="21" y2="3" />
              <polyline points="21 16 21 21 16 21" /><line x1="15" y1="15" x2="21" y2="21" />
              <line x1="4" y1="4" x2="9" y2="9" />
            </svg>
            Enrutamiento
          </button>
          <button
            className={`sidebar-link ${activeSection === 'handoffs' ? 'active' : ''}`}
            onClick={() => setActiveSection('handoffs')}
            id="nav-handoffs"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            Handoffs
          </button>
          <button
            className={`sidebar-link ${activeSection === 'configuracion' ? 'active' : ''}`}
            onClick={() => setActiveSection('configuracion')}
            id="nav-configuracion"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            Configuración
          </button>
        </nav>
        <div className="sidebar-footer">
          <a href="/" style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-xs)' }}>
            ← Volver al Chat
          </a>
        </div>
      </aside>

      {/* Main Content */}
      <main className="dashboard-main">
        <div className="dashboard-header">
          <h1 className="dashboard-title">{sectionTitles[activeSection]}</h1>
          <p className="dashboard-subtitle">
            {activeSection === 'resumen' && 'Vista general del sistema de créditos y consumo'}
            {activeSection === 'alertas' && 'Historial de alertas del sistema de monitoreo'}
            {activeSection === 'enrutamiento' && 'Distribución de consultas entre modelos de IA'}
            {activeSection === 'handoffs' && 'Escalamientos a agentes humanos'}
            {activeSection === 'configuracion' && 'Parámetros del presupuesto y umbrales'}
          </p>
        </div>

        {/* ─── RESUMEN ─── */}
        {activeSection === 'resumen' && (
          <>
            {/* 4 Metric Cards */}
            <div className="metrics-grid">
              <div className="metric-card">
                <div className="metric-label">Saldo Actual C(t)</div>
                <div className={`metric-value ${(saldo?.saldoActual || 0) < 2000 ? 'warning' : ''}`}>
                  {formatCurrency(saldo?.saldoActual || 0)}
                </div>
                <div className="metric-subtext">Créditos disponibles</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Consumo Diario U(t)</div>
                <div className="metric-value">
                  {formatCurrency(saldo?.consumoDiario || 0)}
                </div>
                <div className="metric-subtext">Gasto del día actual</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Recarga Diaria R</div>
                <div className="metric-value positive">
                  {formatCurrency(saldo?.recargaDiaria || 0)}
                </div>
                <div className="metric-subtext">Presupuesto / 30 días</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Días hasta agotamiento</div>
                <div className={`metric-value ${
                  saldo?.diasHastaAgotamiento === '∞' ? 'positive' :
                  (saldo?.diasHastaAgotamiento as number) < 7 ? 'error' :
                  (saldo?.diasHastaAgotamiento as number) < 14 ? 'warning' : ''
                }`}>
                  {saldo?.diasHastaAgotamiento === '∞' ? '∞' : `${saldo?.diasHastaAgotamiento} días`}
                </div>
                <div className="metric-subtext">Proyección al ritmo actual</div>
              </div>
            </div>

            {/* Saldo Chart */}
            <div className="chart-card">
              <div className="chart-card-header">
                <div>
                  <div className="chart-card-title">Saldo C(t) — Últimos 30 días</div>
                  <div className="chart-card-subtitle">Evolución del saldo de créditos disponibles</div>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <defs>
                    <linearGradient id="saldoGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="fecha" tick={{ fill: '#6b6b78', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.05)' }} />
                  <YAxis tick={{ fill: '#6b6b78', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.05)' }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={0} stroke="rgba(239, 68, 68, 0.4)" strokeDasharray="8 4" label={{ value: '$0', fill: '#ef4444', fontSize: 11 }} />
                  <Area type="monotone" dataKey="saldo" stroke="#8b5cf6" fill="url(#saldoGradient)" strokeWidth={2} name="Saldo C(t)" dot={false} activeDot={{ r: 4, fill: '#8b5cf6' }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Distribution + Recent Alerts */}
            <div className="two-col-grid">
              <div className="chart-card" style={{ marginBottom: 0 }}>
                <div className="chart-card-header">
                  <div>
                    <div className="chart-card-title">Distribución de modelos</div>
                    <div className="chart-card-subtitle">Terra vs Luna — consultas y costo</div>
                  </div>
                </div>
                {distribucion && (
                  <>
                    <div className="distribution-bar-container">
                      <div className="distribution-bar">
                        {distribucion.modelos.map(m => (
                          <div
                            key={m.id}
                            className={`distribution-segment ${m.nombre.toLowerCase()}`}
                            style={{ width: `${m.porcentajeConsultas}%` }}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="distribution-legend">
                      {distribucion.modelos.map(m => (
                        <div key={m.id} className="distribution-legend-item">
                          <div className={`distribution-legend-dot ${m.nombre.toLowerCase()}`} />
                          <span>
                            <strong>{m.nombre}</strong> — {m.consultas} consultas ({m.porcentajeConsultas}%) · {formatCurrency(m.costoTotal)}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: 'var(--space-4)', fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>
                      Total: {distribucion.totalConsultas} consultas · {formatCurrency(distribucion.totalCosto)} acumulado
                    </div>
                  </>
                )}
              </div>

              <div className="chart-card" style={{ marginBottom: 0 }}>
                <div className="chart-card-header">
                  <div>
                    <div className="chart-card-title">Alertas recientes</div>
                    <div className="chart-card-subtitle">Últimas notificaciones del sistema</div>
                  </div>
                </div>
                {alertas.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-state-icon">◇</div>
                    <div className="empty-state-text">Sin alertas registradas</div>
                  </div>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Tipo</th>
                        <th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {alertas.slice(0, 5).map(a => (
                        <tr key={a.id}>
                          <td>{formatDate(a.fecha)}</td>
                          <td><span className={`badge ${a.tipo.toLowerCase()}`}>{a.tipo}</span></td>
                          <td><span className={`badge ${a.estado.toLowerCase()}`}>{a.estado}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </>
        )}

        {/* ─── ALERTAS ─── */}
        {activeSection === 'alertas' && (
          <div className="chart-card">
            {alertas.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">◇</div>
                <div className="empty-state-text">No hay alertas registradas</div>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Tipo</th>
                    <th>Umbral</th>
                    <th>Saldo al momento</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {alertas.map(a => (
                    <tr key={a.id}>
                      <td>{formatDateTime(a.fecha)}</td>
                      <td><span className={`badge ${a.tipo.toLowerCase()}`}>{a.tipo}</span></td>
                      <td>{formatCurrency(a.umbralUsd)}</td>
                      <td>{formatCurrency(a.saldo.saldoCt)}</td>
                      <td><span className={`badge ${a.estado.toLowerCase()}`}>{a.estado}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ─── ENRUTAMIENTO ─── */}
        {activeSection === 'enrutamiento' && distribucion && (
          <>
            <div className="chart-card">
              <div className="chart-card-header">
                <div>
                  <div className="chart-card-title">Distribución de consultas por modelo</div>
                  <div className="chart-card-subtitle">Comparación de uso y costo entre Terra (capaz) y Luna (económico)</div>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={distribucion.modelos.map(m => ({
                  nombre: m.nombre,
                  consultas: m.consultas,
                  costo: m.costoTotal,
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="nombre" tick={{ fill: '#9d9daa', fontSize: 13 }} axisLine={{ stroke: 'rgba(255,255,255,0.05)' }} />
                  <YAxis tick={{ fill: '#6b6b78', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.05)' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '13px', color: '#9d9daa' }} />
                  <Bar dataKey="consultas" fill="#8b5cf6" name="Consultas" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="costo" fill="#3b82f6" name="Costo USD" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="chart-card">
              <div className="chart-card-header">
                <div>
                  <div className="chart-card-title">Detalle por modelo</div>
                </div>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Modelo</th>
                    <th>API</th>
                    <th>Consultas</th>
                    <th>% Consultas</th>
                    <th>Costo Total</th>
                    <th>% Costo</th>
                    <th>Tokens Entrada</th>
                    <th>Tokens Salida</th>
                  </tr>
                </thead>
                <tbody>
                  {distribucion.modelos.map(m => (
                    <tr key={m.id}>
                      <td><strong style={{ color: m.nombre === 'Terra' ? 'var(--accent-brand)' : 'var(--accent-info)' }}>{m.nombre}</strong></td>
                      <td style={{ fontFamily: 'monospace', fontSize: 'var(--font-size-xs)' }}>{m.nombreApi}</td>
                      <td>{m.consultas.toLocaleString()}</td>
                      <td>{m.porcentajeConsultas}%</td>
                      <td>{formatCurrency(m.costoTotal)}</td>
                      <td>{m.porcentajeCosto}%</td>
                      <td>{m.tokensEntradaTotal.toLocaleString()}</td>
                      <td>{m.tokensSalidaTotal.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ─── HANDOFFS ─── */}
        {activeSection === 'handoffs' && (
          <div className="chart-card">
            {handoffs.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">◇</div>
                <div className="empty-state-text">No hay handoffs registrados</div>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Usuario</th>
                    <th>Motivo</th>
                    <th>Agente Asignado</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {handoffs.map(h => (
                    <tr key={h.id}>
                      <td>{formatDateTime(h.fecha)}</td>
                      <td>{h.conversacion.usuario.nombre}</td>
                      <td style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {h.motivo}
                      </td>
                      <td>{h.agente?.nombre || '—'}</td>
                      <td><span className={`badge ${h.estado.toLowerCase()}`}>{h.estado}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ─── CONFIGURACIÓN ─── */}
        {activeSection === 'configuracion' && (
          <div className="config-panel">
            <div className="chart-card-header" style={{ marginBottom: 'var(--space-6)' }}>
              <div>
                <div className="chart-card-title">Parámetros del sistema</div>
                <div className="chart-card-subtitle">Modifica el presupuesto mensual y el umbral de alerta</div>
              </div>
            </div>

            <div className="config-field">
              <label className="config-label">Presupuesto mensual (USD)</label>
              <div className="config-input-prefix">
                <span>$</span>
                <input
                  type="number"
                  className="config-input"
                  value={configForm.presupuesto}
                  onChange={(e) => setConfigForm(prev => ({ ...prev, presupuesto: e.target.value }))}
                  id="config-presupuesto"
                />
              </div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', marginTop: 'var(--space-2)' }}>
                Recarga diaria resultante: {formatCurrency(parseFloat(configForm.presupuesto || '0') / 30)}/día
              </div>
            </div>

            <div className="config-field">
              <label className="config-label">Umbral de alerta (USD)</label>
              <div className="config-input-prefix">
                <span>$</span>
                <input
                  type="number"
                  className="config-input"
                  value={configForm.umbral}
                  onChange={(e) => setConfigForm(prev => ({ ...prev, umbral: e.target.value }))}
                  id="config-umbral"
                />
              </div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', marginTop: 'var(--space-2)' }}>
                Se generará alerta cuando el saldo caiga por debajo de este valor
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginTop: 'var(--space-6)' }}>
              <button
                className="config-btn config-btn-primary"
                onClick={handleSaveConfig}
                id="config-save-button"
              >
                Guardar cambios
              </button>
              {configSaved && (
                <div className="config-saved">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Guardado correctamente
                </div>
              )}
            </div>

            {config && (
              <div style={{ marginTop: 'var(--space-8)', padding: 'var(--space-4)', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>
                Última actualización: {formatDateTime(config.fechaActualizacion)}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
