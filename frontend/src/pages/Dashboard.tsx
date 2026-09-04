import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import {
  obtenerSaldo,
  obtenerSaldoHistorial,
  obtenerAlertas,
  obtenerHandoffs,
  obtenerDistribucion,
  obtenerConfiguracion,
  actualizarConfiguracion,
  resolverAlerta,
} from "../services/api";
import type {
  SaldoResponse,
  SaldoHistorial,
  Alerta,
  Handoff,
  DistribucionResponse,
  Configuracion,
} from "../services/api";

// ─── Types ────────────────────────────────────────────────────────────────────

type NavItem = "resumen" | "alertas" | "enrutamiento" | "handoffs" | "configuracion";
type Theme = "dark" | "light";

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconGrid({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <rect x="1" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <rect x="9" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <rect x="1" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <rect x="9" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function IconAlert({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M8 1.5L14.5 13.5H1.5L8 1.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <line x1="8" y1="6" x2="8" y2="9.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="8" cy="11.5" r="0.75" fill="currentColor" />
    </svg>
  );
}

function IconRoute({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <circle cx="3" cy="3" r="1.5" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="13" cy="3" r="1.5" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="8" cy="13" r="1.5" stroke="currentColor" strokeWidth="1.2" />
      <line x1="4.5" y1="3" x2="11.5" y2="3" stroke="currentColor" strokeWidth="1.2" />
      <line x1="3" y1="4.5" x2="7" y2="11.5" stroke="currentColor" strokeWidth="1.2" />
      <line x1="13" y1="4.5" x2="9" y2="11.5" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function IconUsers({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <circle cx="6" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M1 13.5C1 11 3.24 9 6 9s5 2 5 4.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="11.5" cy="5" r="2" stroke="currentColor" strokeWidth="1.2" />
      <path d="M13.5 13.5c0-1.9-1-3.5-2.5-4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function IconSettings({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M8 1v2M8 13v2M1 8h2M13 8h2M2.93 2.93l1.41 1.41M11.66 11.66l1.41 1.41M2.93 13.07l1.41-1.41M11.66 4.34l1.41-1.41"
        stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"
      />
    </svg>
  );
}

function IconBell({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path
        d="M8 1.5a5 5 0 00-5 5v3l-1.5 2h13L13 9.5v-3a5 5 0 00-5-5z"
        stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"
      />
      <path d="M6.5 13.5a1.5 1.5 0 003 0" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function IconSun({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.2" />
      <path d="M8 1v2M8 13v2M1 8h2M13 8h2M2.93 2.93l1.41 1.41M11.66 11.66l1.41 1.41M2.93 13.07l1.41-1.41M11.66 4.34l1.41-1.41" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function IconMoon({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M13.5 10A6 6 0 016 2.5a6 6 0 100 11 6 6 0 007.5-3.5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}

function IconChat({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M14 10a2 2 0 01-2 2H5l-3 3V4a2 2 0 012-2h8a2 2 0 012 2v6z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label, isDark }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: isDark ? "#16161f" : "#ffffff",
        border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
        borderRadius: "8px",
        padding: "10px 14px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
      }}
    >
      <p style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "11px", color: isDark ? "#9c9ba8" : "#6b7280", marginBottom: 4 }}>{label}</p>
      <p style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "14px", fontWeight: 600, color: "#a855f7" }}>
        ${payload[0]?.value?.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
      </p>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const navigate = useNavigate();
  const [activeNav, setActiveNav] = useState<NavItem>("resumen");
  const [theme, setTheme] = useState<Theme>("dark");
  const [alertThreshold, setAlertThreshold] = useState(15000);
  const [monthlyBudget, setMonthlyBudget] = useState(20000);
  const [saved, setSaved] = useState(false);

  // Backend state
  const [saldo, setSaldo] = useState<SaldoResponse | null>(null);
  const [historial, setHistorial] = useState<SaldoHistorial[]>([]);
  const [alertasList, setAlertasList] = useState<Alerta[]>([]);
  const [handoffsList, setHandoffsList] = useState<Handoff[]>([]);
  const [distribucion, setDistribucion] = useState<DistribucionResponse | null>(null);
  const [config, setConfig] = useState<Configuracion | null>(null);
  const [alertaFilter, setAlertaFilter] = useState<"todas" | "activas" | "resueltas">("todas");
  const [resolvingId, setResolvingId] = useState<number | null>(null);

  const isDark = theme === "dark";

  const colors = {
    bg: isDark ? "#08080b" : "#f4f4f8",
    surface: isDark ? "#0c0c11" : "#ffffff",
    surfaceHover: isDark ? "#111118" : "#f9f9fc",
    border: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)",
    text: isDark ? "#ffffff" : "#0f0f14",
    textSec: isDark ? "#9c9ba8" : "#6b6a77",
    textTertiary: isDark ? "#5c5b66" : "#9c9ba8",
    sidebarBg: isDark ? "#09090e" : "#ffffff",
    headerBg: isDark ? "rgba(8,8,11,0.85)" : "rgba(255,255,255,0.9)",
    activeBg: "rgba(168,85,247,0.12)",
    activeBorder: "#a855f7",
    inputBg: isDark ? "#13131a" : "#f1f1f6",
    gridColor: isDark ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0.04)",
  };

  const navItems: { id: NavItem; label: string; icon: React.ReactElement }[] = [
    { id: "resumen", label: "Resumen", icon: <IconGrid size={16} /> },
    { id: "alertas", label: "Alertas", icon: <IconAlert size={16} /> },
    { id: "enrutamiento", label: "Enrutamiento", icon: <IconRoute size={16} /> },
    { id: "handoffs", label: "Handoffs", icon: <IconUsers size={16} /> },
    { id: "configuracion", label: "Configuración", icon: <IconSettings size={16} /> },
  ];

  // Fetch real data from backend
  const fetchData = useCallback(async () => {
    try {
      const [sData, hData, aData, handData, dData, cData] = await Promise.all([
        obtenerSaldo().catch(() => null),
        obtenerSaldoHistorial(30).catch(() => []),
        obtenerAlertas().catch(() => []),
        obtenerHandoffs().catch(() => []),
        obtenerDistribucion().catch(() => null),
        obtenerConfiguracion().catch(() => null),
      ]);

      if (sData) setSaldo(sData);
      if (hData && hData.length > 0) setHistorial(hData);
      if (aData) setAlertasList(aData);
      if (handData) setHandoffsList(handData);
      if (dData) setDistribucion(dData);
      if (cData) {
        setConfig(cData);
        setMonthlyBudget(cData.presupuestoMensual);
        setAlertThreshold(cData.umbralAlerta);
      }
    } catch (err) {
      console.warn("Error fetching dashboard backend data:", err);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 20000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleSave = async () => {
    try {
      await actualizarConfiguracion({
        presupuestoMensual: monthlyBudget,
        umbralAlerta: alertThreshold,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      fetchData();
    } catch (err) {
      console.error("Error saving config:", err);
    }
  };

  const handleResolverAlerta = async (id: number) => {
    try {
      setResolvingId(id);
      await resolverAlerta(id);
      await fetchData();
    } catch (err) {
      console.error("Error resolviendo alerta:", err);
    } finally {
      setResolvingId(null);
    }
  };

  const card = {
    background: colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: "14px",
  };

  // Format chart data from backend history or fallback to sample
  const chartData = historial.length > 0
    ? historial.map((h) => {
        const d = new Date(h.fecha);
        return {
          day: `${d.getDate()} ${d.toLocaleDateString("es-ES", { month: "short" })}`,
          balance: Math.round(h.saldoCt),
        };
      })
    : [
        { day: "1 Ago", balance: 18200 },
        { day: "4 Ago", balance: 17340 },
        { day: "7 Ago", balance: 16800 },
        { day: "10 Ago", balance: 15920 },
        { day: "13 Ago", balance: 15100 },
        { day: "16 Ago", balance: 16400 },
        { day: "19 Ago", balance: 15700 },
        { day: "22 Ago", balance: 14500 },
        { day: "25 Ago", balance: 13800 },
        { day: "28 Ago", balance: 13100 },
        { day: "31 Ago", balance: 12406 },
      ];

  // Distribution models
  const terraModel = distribucion?.modelos.find((m) => m.nombre.toLowerCase().includes("terra")) || {
    nombre: "GPT-5.6 Terra",
    porcentajeConsultas: "62%",
    costoTotal: 7324,
    consultas: 42810,
  };
  const lunaModel = distribucion?.modelos.find((m) => m.nombre.toLowerCase().includes("luna")) || {
    nombre: "GPT-5.6 Luna",
    porcentajeConsultas: "38%",
    costoTotal: 5082,
    consultas: 26230,
  };

  const terraPctNum = parseFloat(String(terraModel.porcentajeConsultas)) || 62;
  const lunaPctNum = parseFloat(String(lunaModel.porcentajeConsultas)) || 38;
  const totalPeriodCost = distribucion?.totalCosto || (terraModel.costoTotal + lunaModel.costoTotal) || 12406;

  // Alerts display list
  const activeAlertsCount = alertasList.filter((a) => a.estado === "ACTIVA").length;
  const pendingHandoffsCount = handoffsList.filter((h) => h.estado === "PENDIENTE").length;

  const displayAlerts = alertasList.length > 0
    ? alertasList.map((a) => ({
        id: a.id,
        date: a.fecha.slice(0, 10),
        type: a.tipo === "CRITICO" ? "Saldo crítico" : a.tipo === "BAJO" ? "Consumo alto" : "Saldo agotado",
        threshold: `< $${a.umbralUsd?.toLocaleString() || "15,000"}`,
        status: a.estado.toLowerCase() as "activa" | "resuelta",
      }))
    : [
        { id: 1, date: "2026-08-31", type: "Saldo crítico", threshold: "< $15,000", status: "activa" as const },
        { id: 2, date: "2026-08-28", type: "Consumo alto", threshold: "> $600/día", status: "resuelta" as const },
        { id: 3, date: "2026-08-21", type: "Saldo crítico", threshold: "< $15,000", status: "resuelta" as const },
        { id: 4, date: "2026-08-14", type: "Tasa de handoff", threshold: "> 8%", status: "resuelta" as const },
      ];

  const displayHandoffs = handoffsList.length > 0
    ? handoffsList.map((h) => ({
        id: h.id,
        date: h.fecha.slice(0, 10),
        reason: h.motivo,
        agent: h.agente?.nombre || "Sin asignar",
        status: h.estado === "PENDIENTE" ? "pendiente" : h.estado === "ASIGNADO" ? "en curso" : "resuelto",
      }))
    : [
        { id: 1, date: "2026-09-03", reason: "Disputa compleja", agent: "María López", status: "pendiente" },
        { id: 2, date: "2026-09-03", reason: "Acceso a cuenta", agent: "Carlos Ruiz", status: "en curso" },
        { id: 3, date: "2026-09-02", reason: "Solicitud directa", agent: "Ana Torres", status: "resuelto" },
        { id: 4, date: "2026-09-01", reason: "Transacción sospechosa", agent: "David Kim", status: "resuelto" },
      ];

  // Filtered alerts for Alertas tab
  const filteredAlertsTab = displayAlerts.filter((a) => {
    if (alertaFilter === "activas") return a.status === "activa";
    if (alertaFilter === "resueltas") return a.status === "resuelta";
    return true;
  });

  return (
    <div
      style={{
        display: "flex",
        height: "100%",
        minHeight: "100vh",
        background: colors.bg,
        backgroundImage: `linear-gradient(${colors.gridColor} 1px, transparent 1px), linear-gradient(90deg, ${colors.gridColor} 1px, transparent 1px)`,
        backgroundSize: "40px 40px",
        fontFamily: "'Inter', system-ui, sans-serif",
        color: colors.text,
        overflow: "hidden",
      }}
    >
      {/* ── Sidebar ── */}
      <aside
        style={{
          width: "220px",
          minWidth: "220px",
          height: "100vh",
          background: colors.sidebarBg,
          borderRight: `1px solid ${colors.border}`,
          display: "flex",
          flexDirection: "column",
          position: "fixed",
          left: 0,
          top: 0,
          zIndex: 100,
        }}
      >
        {/* Logo */}
        <div style={{ padding: "24px 20px 20px", borderBottom: `1px solid ${colors.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "32px",
                height: "32px",
                background: "linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)",
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 2px 8px rgba(168,85,247,0.3)",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 8h10M8 3l5 5-5 5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: "13px", fontWeight: 600, letterSpacing: "-0.01em", color: colors.text }}>Klarna AI</div>
              <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "9px", color: colors.textTertiary, textTransform: "uppercase", letterSpacing: "0.08em" }}>Admin v2.1</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ padding: "12px 12px", flex: 1, overflowY: "auto" }}>
          <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "9px", color: colors.textTertiary, textTransform: "uppercase", letterSpacing: "0.1em", padding: "8px 8px 6px" }}>
            Navegación
          </div>
          {navItems.map((item) => {
            const active = activeNav === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveNav(item.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: "8px",
                  background: active ? colors.activeBg : "transparent",
                  borderLeft: active ? `2px solid ${colors.activeBorder}` : "2px solid transparent",
                  color: active ? "#d8b4fe" : colors.textSec,
                  fontSize: "13px",
                  fontWeight: active ? 500 : 400,
                  cursor: "pointer",
                  border: "none",
                  textAlign: "left",
                  transition: "all 0.15s",
                  marginBottom: "2px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ opacity: active ? 1 : 0.6 }}>{item.icon}</span>
                  {item.label}
                </div>
                {item.id === "alertas" && activeAlertsCount > 0 && (
                  <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "9px", background: "rgba(239,68,68,0.2)", color: "#f87171", padding: "1px 6px", borderRadius: "10px" }}>
                    {activeAlertsCount}
                  </span>
                )}
                {item.id === "handoffs" && pendingHandoffsCount > 0 && (
                  <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "9px", background: "rgba(249,115,22,0.2)", color: "#fb923c", padding: "1px 6px", borderRadius: "10px" }}>
                    {pendingHandoffsCount}
                  </span>
                )}
              </button>
            );
          })}

          <div style={{ margin: "16px 0 8px", height: "1px", background: colors.border }} />

          <button
            onClick={() => navigate("/")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              width: "100%",
              padding: "9px 12px",
              borderRadius: "8px",
              background: "transparent",
              color: colors.textSec,
              fontSize: "13px",
              cursor: "pointer",
              border: "none",
              textAlign: "left",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#a855f7")}
            onMouseLeave={(e) => (e.currentTarget.style.color = colors.textSec)}
          >
            <IconChat size={16} />
            Chat Cliente
          </button>
        </nav>

        {/* Theme toggle & environment */}
        <div style={{ padding: "16px 20px", borderTop: `1px solid ${colors.border}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "12px", color: colors.textSec }}>Apariencia</span>
            <button
              onClick={() => setTheme(isDark ? "light" : "dark")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                background: colors.inputBg,
                border: `1px solid ${colors.border}`,
                borderRadius: "8px",
                padding: "5px 10px",
                cursor: "pointer",
                color: colors.textSec,
                fontSize: "12px",
                transition: "all 0.15s",
              }}
            >
              {isDark ? <IconSun size={13} /> : <IconMoon size={13} />}
              {isDark ? "Claro" : "Oscuro"}
            </button>
          </div>
          <div style={{ marginTop: "12px", padding: "10px 12px", background: colors.inputBg, borderRadius: "8px", border: `1px solid ${colors.border}` }}>
            <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "9px", color: colors.textTertiary, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "4px" }}>Entorno</div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#4ade80", display: "inline-block" }} />
              <span style={{ fontSize: "12px", color: "#4ade80", fontWeight: 500 }}>Producción activa</span>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main Content Area ── */}
      <main style={{ marginLeft: "220px", flex: 1, display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
        {/* Header */}
        <header
          style={{
            position: "sticky",
            top: 0,
            zIndex: 50,
            background: colors.headerBg,
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            borderBottom: `1px solid ${colors.border}`,
            padding: "0 32px",
            height: "60px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <h1 style={{ fontSize: "15px", fontWeight: 600, color: colors.text, margin: 0, letterSpacing: "-0.02em" }}>
              Panel de Administración
            </h1>
            <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "10px", color: colors.textTertiary, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              {navItems.find((n) => n.id === activeNav)?.label}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {/* Date range filter */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                background: colors.inputBg,
                border: `1px solid ${colors.border}`,
                borderRadius: "8px",
                padding: "7px 14px",
                fontSize: "12px",
                color: colors.textSec,
                cursor: "pointer",
              }}
            >
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <rect x="1" y="2" width="11" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.1" />
                <line x1="1" y1="5.5" x2="12" y2="5.5" stroke="currentColor" strokeWidth="1.1" />
                <line x1="4" y1="1" x2="4" y2="3.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
                <line x1="9" y1="1" x2="9" y2="3.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
              </svg>
              Últimos 30 días
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ opacity: 0.5 }}>
                <path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>

            {/* Notification Bell */}
            <div style={{ position: "relative" }}>
              <button
                onClick={() => setActiveNav("alertas")}
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "8px",
                  background: colors.inputBg,
                  border: `1px solid ${colors.border}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: colors.textSec,
                  transition: "all 0.15s",
                }}
              >
                <IconBell size={15} />
              </button>
              {activeAlertsCount > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: "7px",
                    right: "7px",
                    width: "7px",
                    height: "7px",
                    background: "#ef4444",
                    borderRadius: "50%",
                    border: `1.5px solid ${colors.bg}`,
                  }}
                />
              )}
            </div>

            {/* Avatar */}
            <div
              onClick={() => navigate("/")}
              title="Ir al Chat de Cliente"
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "8px",
                background: "linear-gradient(135deg, #7c3aed, #a855f7)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "12px",
                fontWeight: 600,
                color: "white",
                cursor: "pointer",
                boxShadow: "0 2px 6px rgba(124,58,237,0.3)",
              }}
            >
              KL
            </div>
          </div>
        </header>

        {/* ── Scrollable content ── */}
        <div style={{ flex: 1, overflowY: "auto", padding: "28px 32px 40px" }}>
          {activeNav === "resumen" && (
            <>
              {/* ── Metric Cards ── */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "24px" }}>
                {/* Saldo actual */}
                <MetricCard
                  label="Saldo actual C(t)"
                  value={saldo ? `$${Math.round(saldo.saldoActual).toLocaleString()}` : "$12,406"}
                  valueColor="#4ade80"
                  delta="+2.1%"
                  deltaPositive={true}
                  sub="vs. semana anterior"
                  colors={colors}
                  icon={
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M7 1v12M3 4l4-3 4 3M3 10l4 3 4-3" stroke="#4ade80" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  }
                />
                {/* Consumo diario */}
                <MetricCard
                  label="Consumo diario (U)"
                  value={saldo ? `$${Math.round(saldo.consumoDiario).toLocaleString()}` : "$491"}
                  valueColor="#fb923c"
                  delta="-5.3%"
                  deltaPositive={false}
                  sub="promedio últimos 7 días"
                  colors={colors}
                  icon={
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M2 12L7 2l5 10" stroke="#fb923c" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                      <line x1="4" y1="8.5" x2="10" y2="8.5" stroke="#fb923c" strokeWidth="1.2" strokeLinecap="round" />
                    </svg>
                  }
                />
                {/* Recarga diaria */}
                <MetricCard
                  label="Recarga diaria (R)"
                  value={saldo ? `$${Math.round(saldo.recargaDiaria).toLocaleString()}` : "$667"}
                  valueColor="#60a5fa"
                  delta="+0.0%"
                  deltaPositive={true}
                  sub="tarifa fija mensual"
                  colors={colors}
                  icon={
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <circle cx="7" cy="7" r="5.5" stroke="#60a5fa" strokeWidth="1.2" />
                      <path d="M7 4.5v2.5l2 1.5" stroke="#60a5fa" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  }
                />
                {/* Días hasta agotamiento */}
                <MetricCard
                  label="Días hasta agotamiento"
                  value={
                    saldo
                      ? typeof saldo.diasHastaAgotamiento === "number"
                        ? `~${saldo.diasHastaAgotamiento}`
                        : "∞"
                      : "~71"
                  }
                  valueColor="#4ade80"
                  delta="Balance positivo"
                  deltaPositive={true}
                  sub={saldo && typeof saldo.diasHastaAgotamiento !== "number" ? "recarga supera consumo" : "a consumo actual"}
                  colors={colors}
                  icon={
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <rect x="1.5" y="2.5" width="11" height="9" rx="1.5" stroke="#4ade80" strokeWidth="1.2" />
                      <line x1="1.5" y1="5.5" x2="12.5" y2="5.5" stroke="#4ade80" strokeWidth="1.2" />
                      <circle cx="4.5" cy="8.5" r="0.75" fill="#4ade80" />
                      <circle cx="7" cy="8.5" r="0.75" fill="#4ade80" />
                    </svg>
                  }
                />
              </div>

              {/* ── Center Row ── */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "16px", marginBottom: "24px" }}>
                {/* Balance Chart */}
                <div style={{ ...card, padding: "24px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
                    <div>
                      <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "9px", color: colors.textTertiary, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "4px" }}>
                        Evolución del saldo
                      </div>
                      <div style={{ fontSize: "14px", fontWeight: 600, color: colors.text }}>C(t) — Últimos 30 días</div>
                    </div>
                    <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <div style={{ width: "16px", height: "2px", background: "#a855f7", borderRadius: "1px" }} />
                        <span style={{ fontSize: "11px", color: colors.textSec }}>Saldo</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <div style={{ width: "16px", borderTop: "2px dashed #ef4444" }} />
                        <span style={{ fontSize: "11px", color: colors.textSec }}>Umbral crítico</span>
                      </div>
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="balanceGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#a855f7" stopOpacity={0.25} />
                          <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.03} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke={colors.border} strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="day"
                        tick={{ fill: colors.textTertiary, fontSize: 10, fontFamily: "JetBrains Mono, monospace" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: colors.textTertiary, fontSize: 10, fontFamily: "JetBrains Mono, monospace" }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                      />
                      <Tooltip content={<CustomTooltip isDark={isDark} />} />
                      <ReferenceLine y={alertThreshold} stroke="#ef4444" strokeDasharray="4 4" strokeWidth={1.5} />
                      <Area
                        type="monotone"
                        dataKey="balance"
                        stroke="#a855f7"
                        strokeWidth={2}
                        fill="url(#balanceGrad)"
                        dot={false}
                        activeDot={{ r: 4, fill: "#a855f7", strokeWidth: 0 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Model Distribution */}
                <div style={{ ...card, padding: "24px", display: "flex", flexDirection: "column" }}>
                  <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "9px", color: colors.textTertiary, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "4px" }}>
                    Distribución de modelos
                  </div>
                  <div style={{ fontSize: "14px", fontWeight: 600, color: colors.text, marginBottom: "20px" }}>Enrutamiento activo</div>

                  {/* Stacked bar */}
                  <div style={{ marginBottom: "20px" }}>
                    <div style={{ display: "flex", borderRadius: "6px", overflow: "hidden", height: "12px", marginBottom: "10px" }}>
                      <div style={{ width: `${terraPctNum}%`, background: "linear-gradient(90deg, #f97316, #fb923c)" }} />
                      <div style={{ width: `${lunaPctNum}%`, background: "linear-gradient(90deg, #22c55e, #4ade80)" }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "10px", color: "#fb923c" }}>Terra {terraPctNum}%</span>
                      <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "10px", color: "#4ade80" }}>Luna {lunaPctNum}%</span>
                    </div>
                  </div>

                  {/* Terra Card */}
                  <div
                    style={{
                      background: "rgba(249,115,22,0.08)",
                      border: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}`,
                      borderRadius: "10px",
                      padding: "14px",
                      marginBottom: "10px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                      <span style={{ fontSize: "12px", fontWeight: 600, color: "#fb923c" }}>{terraModel.nombre}</span>
                      <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "11px", color: "#fb923c" }}>{terraPctNum}%</span>
                    </div>
                    <div style={{ display: "flex", gap: "16px" }}>
                      <div>
                        <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "9px", color: colors.textTertiary, textTransform: "uppercase", letterSpacing: "0.08em" }}>Costo</div>
                        <div style={{ fontSize: "13px", fontWeight: 600, color: colors.text }}>${Math.round(terraModel.costoTotal).toLocaleString()}</div>
                      </div>
                      <div>
                        <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "9px", color: colors.textTertiary, textTransform: "uppercase", letterSpacing: "0.08em" }}>Consultas</div>
                        <div style={{ fontSize: "13px", fontWeight: 600, color: colors.text }}>{terraModel.consultas.toLocaleString()}</div>
                      </div>
                    </div>
                  </div>

                  {/* Luna Card */}
                  <div
                    style={{
                      background: "rgba(34,197,94,0.08)",
                      border: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}`,
                      borderRadius: "10px",
                      padding: "14px",
                      marginBottom: "10px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                      <span style={{ fontSize: "12px", fontWeight: 600, color: "#4ade80" }}>{lunaModel.nombre}</span>
                      <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "11px", color: "#4ade80" }}>{lunaPctNum}%</span>
                    </div>
                    <div style={{ display: "flex", gap: "16px" }}>
                      <div>
                        <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "9px", color: colors.textTertiary, textTransform: "uppercase", letterSpacing: "0.08em" }}>Costo</div>
                        <div style={{ fontSize: "13px", fontWeight: 600, color: colors.text }}>${Math.round(lunaModel.costoTotal).toLocaleString()}</div>
                      </div>
                      <div>
                        <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "9px", color: colors.textTertiary, textTransform: "uppercase", letterSpacing: "0.08em" }}>Consultas</div>
                        <div style={{ fontSize: "13px", fontWeight: 600, color: colors.text }}>{lunaModel.consultas.toLocaleString()}</div>
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: "auto", padding: "10px 12px", background: colors.inputBg, borderRadius: "8px", border: `1px solid ${colors.border}` }}>
                    <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "9px", color: colors.textTertiary, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "2px" }}>Costo total del período</div>
                    <div style={{ fontSize: "16px", fontWeight: 700, color: colors.text }}>${Math.round(totalPeriodCost).toLocaleString()}</div>
                  </div>
                </div>
              </div>

              {/* ── Bottom Row ── */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "24px" }}>
                {/* Alerts Table */}
                <div style={{ ...card, padding: "20px" }}>
                  <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "9px", color: colors.textTertiary, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "4px" }}>
                    Historial
                  </div>
                  <div style={{ fontSize: "14px", fontWeight: 600, color: colors.text, marginBottom: "16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    Alertas recientes
                    <span style={{ fontSize: "11px", background: activeAlertsCount > 0 ? "rgba(239,68,68,0.12)" : "rgba(74,222,128,0.12)", color: activeAlertsCount > 0 ? "#f87171" : "#4ade80", borderRadius: "5px", padding: "2px 8px", fontFamily: "JetBrains Mono, monospace" }}>
                      {activeAlertsCount} activa{activeAlertsCount === 1 ? "" : "s"}
                    </span>
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        {["Fecha", "Tipo de alerta", "Umbral", "Estado"].map((h) => (
                          <th key={h} style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "9px", color: colors.textTertiary, textTransform: "uppercase", letterSpacing: "0.08em", textAlign: "left", padding: "0 0 10px", fontWeight: 500 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {displayAlerts.slice(0, 4).map((a, i) => (
                        <tr key={i} style={{ borderTop: `1px solid ${colors.border}` }}>
                          <td style={{ padding: "11px 0", fontFamily: "JetBrains Mono, monospace", fontSize: "11px", color: colors.textSec }}>{a.date}</td>
                          <td style={{ padding: "11px 8px", fontSize: "12px", color: colors.text }}>{a.type}</td>
                          <td style={{ padding: "11px 8px", fontFamily: "JetBrains Mono, monospace", fontSize: "11px", color: colors.textSec }}>{a.threshold}</td>
                          <td style={{ padding: "11px 0" }}>
                            <StatusBadge status={a.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Handoffs Table */}
                <div style={{ ...card, padding: "20px" }}>
                  <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "9px", color: colors.textTertiary, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "4px" }}>
                    Escalaciones
                  </div>
                  <div style={{ fontSize: "14px", fontWeight: 600, color: colors.text, marginBottom: "16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    Handoffs a agentes
                    <span style={{ fontSize: "11px", background: pendingHandoffsCount > 0 ? "rgba(239,68,68,0.12)" : "rgba(74,222,128,0.12)", color: pendingHandoffsCount > 0 ? "#f87171" : "#4ade80", borderRadius: "5px", padding: "2px 8px", fontFamily: "JetBrains Mono, monospace" }}>
                      {pendingHandoffsCount} pendiente{pendingHandoffsCount === 1 ? "" : "s"}
                    </span>
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        {["Fecha", "Motivo", "Agente", "Estado"].map((h) => (
                          <th key={h} style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "9px", color: colors.textTertiary, textTransform: "uppercase", letterSpacing: "0.08em", textAlign: "left", padding: "0 0 10px", fontWeight: 500 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {displayHandoffs.slice(0, 4).map((h, i) => (
                        <tr key={i} style={{ borderTop: `1px solid ${colors.border}` }}>
                          <td style={{ padding: "11px 0", fontFamily: "JetBrains Mono, monospace", fontSize: "11px", color: colors.textSec }}>{h.date.slice(5)}</td>
                          <td style={{ padding: "11px 8px", fontSize: "12px", color: colors.text }}>{h.reason}</td>
                          <td style={{ padding: "11px 8px", fontSize: "12px", color: colors.textSec }}>{h.agent}</td>
                          <td style={{ padding: "11px 0" }}>
                            <HandoffBadge status={h.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ── Threshold Config ── */}
              <div style={{ ...card, padding: "24px" }}>
                <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "9px", color: colors.textTertiary, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "4px" }}>
                  Parámetros del sistema
                </div>
                <div style={{ fontSize: "14px", fontWeight: 600, color: colors.text, marginBottom: "20px" }}>Configuración de umbrales</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: "20px", alignItems: "end" }}>
                  {/* Alert threshold */}
                  <div>
                    <label style={{ display: "block", fontFamily: "JetBrains Mono, monospace", fontSize: "9px", color: colors.textTertiary, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "8px" }}>
                      Umbral de alerta de saldo (USD)
                    </label>
                    <div style={{ position: "relative" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                        <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "13px", color: "#f87171", fontWeight: 600 }}>
                          ${alertThreshold.toLocaleString()}
                        </span>
                        <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "10px", color: colors.textTertiary }}>$0 — $30k</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={30000}
                        step={500}
                        value={alertThreshold}
                        onChange={(e) => setAlertThreshold(Number(e.target.value))}
                        style={{
                          width: "100%",
                          accentColor: "#ef4444",
                          height: "4px",
                          cursor: "pointer",
                        }}
                      />
                    </div>
                  </div>
                  {/* Monthly budget */}
                  <div>
                    <label style={{ display: "block", fontFamily: "JetBrains Mono, monospace", fontSize: "9px", color: colors.textTertiary, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "8px" }}>
                      Presupuesto mensual (USD)
                    </label>
                    <div style={{ position: "relative" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                        <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "13px", color: "#60a5fa", fontWeight: 600 }}>
                          ${monthlyBudget.toLocaleString()}
                        </span>
                        <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "10px", color: colors.textTertiary }}>$0 — $50k</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={50000}
                        step={500}
                        value={monthlyBudget}
                        onChange={(e) => setMonthlyBudget(Number(e.target.value))}
                        style={{
                          width: "100%",
                          accentColor: "#3b82f6",
                          height: "4px",
                          cursor: "pointer",
                        }}
                      />
                    </div>
                  </div>
                  {/* Save button */}
                  <button
                    onClick={handleSave}
                    style={{
                      padding: "10px 24px",
                      background: saved ? "rgba(74,222,128,0.15)" : "linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)",
                      border: `1px solid ${saved ? "rgba(74,222,128,0.3)" : "rgba(168,85,247,0.4)"}`,
                      borderRadius: "8px",
                      color: saved ? "#4ade80" : "white",
                      fontSize: "13px",
                      fontWeight: 600,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      transition: "all 0.2s",
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {saved ? "✓ Guardado" : "Guardar cambios"}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* ── View: Alertas ── */}
          {activeNav === "alertas" && (
            <div style={{ ...card, padding: "28px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <div>
                  <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "9px", color: colors.textTertiary, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "4px" }}>
                    Gestión de incidencias
                  </div>
                  <h2 style={{ fontSize: "18px", fontWeight: 600, color: colors.text, margin: 0 }}>Historial de Alertas</h2>
                </div>
                {/* Filter tabs */}
                <div style={{ display: "flex", gap: "6px", background: colors.inputBg, padding: "4px", borderRadius: "8px", border: `1px solid ${colors.border}` }}>
                  {(["todas", "activas", "resueltas"] as const).map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setAlertaFilter(filter)}
                      style={{
                        padding: "6px 14px",
                        borderRadius: "6px",
                        border: "none",
                        fontSize: "12px",
                        cursor: "pointer",
                        textTransform: "capitalize",
                        background: alertaFilter === filter ? colors.surface : "transparent",
                        color: alertaFilter === filter ? colors.text : colors.textSec,
                        fontWeight: alertaFilter === filter ? 600 : 400,
                      }}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
              </div>

              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${colors.border}` }}>
                    {["ID", "Fecha", "Tipo de alerta", "Umbral Configurado", "Estado", "Acción"].map((h) => (
                      <th key={h} style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "10px", color: colors.textTertiary, textTransform: "uppercase", letterSpacing: "0.08em", textAlign: "left", padding: "12px 14px", fontWeight: 500 }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredAlertsTab.map((a) => (
                    <tr key={a.id} style={{ borderBottom: `1px solid ${colors.border}` }}>
                      <td style={{ padding: "14px", fontFamily: "JetBrains Mono, monospace", fontSize: "11px", color: colors.textTertiary }}>#{a.id}</td>
                      <td style={{ padding: "14px", fontFamily: "JetBrains Mono, monospace", fontSize: "12px", color: colors.textSec }}>{a.date}</td>
                      <td style={{ padding: "14px", fontSize: "13px", fontWeight: 500, color: colors.text }}>{a.type}</td>
                      <td style={{ padding: "14px", fontFamily: "JetBrains Mono, monospace", fontSize: "12px", color: colors.textSec }}>{a.threshold}</td>
                      <td style={{ padding: "14px" }}>
                        <StatusBadge status={a.status} />
                      </td>
                      <td style={{ padding: "14px" }}>
                        {a.status === "activa" ? (
                          <button
                            disabled={resolvingId === a.id}
                            onClick={() => handleResolverAlerta(a.id)}
                            style={{
                              background: "rgba(168,85,247,0.15)",
                              border: "1px solid rgba(168,85,247,0.3)",
                              color: "#d8b4fe",
                              padding: "4px 10px",
                              borderRadius: "6px",
                              fontSize: "11px",
                              cursor: "pointer",
                            }}
                          >
                            {resolvingId === a.id ? "Resolviendo..." : "Marcar resuelta"}
                          </button>
                        ) : (
                          <span style={{ color: colors.textTertiary, fontSize: "11px" }}>—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── View: Enrutamiento ── */}
          {activeNav === "enrutamiento" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div style={{ ...card, padding: "28px" }}>
                <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "9px", color: colors.textTertiary, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "4px" }}>
                  Métricas de Enrutamiento Inteligente
                </div>
                <h2 style={{ fontSize: "18px", fontWeight: 600, color: colors.text, margin: "0 0 20px 0" }}>
                  Distribución Dinámica: GPT-5.6 Terra vs GPT-5.6 Luna
                </h2>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "24px" }}>
                  <div style={{ padding: "20px", borderRadius: "12px", background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.2)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                      <h3 style={{ margin: 0, fontSize: "15px", color: "#fb923c" }}>GPT-5.6 Terra (Avanzado)</h3>
                      <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "12px", background: "rgba(249,115,22,0.2)", color: "#fb923c", padding: "2px 8px", borderRadius: "6px" }}>
                        {terraPctNum}% del tráfico
                      </span>
                    </div>
                    <p style={{ fontSize: "13px", color: colors.textSec, lineHeight: 1.5, marginBottom: "16px" }}>
                      Enrutado para consultas complejas: resolución de disputas de transacciones, reestructuración de pagos de cuotas y casos con alta ambigüedad.
                    </p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                      <div>
                        <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "9px", color: colors.textTertiary, textTransform: "uppercase" }}>Costo Total</div>
                        <div style={{ fontSize: "16px", fontWeight: 700, color: colors.text }}>${Math.round(terraModel.costoTotal).toLocaleString()}</div>
                      </div>
                      <div>
                        <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "9px", color: colors.textTertiary, textTransform: "uppercase" }}>Consultas</div>
                        <div style={{ fontSize: "16px", fontWeight: 700, color: colors.text }}>{terraModel.consultas.toLocaleString()}</div>
                      </div>
                    </div>
                  </div>

                  <div style={{ padding: "20px", borderRadius: "12px", background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.2)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                      <h3 style={{ margin: 0, fontSize: "15px", color: "#4ade80" }}>GPT-5.6 Luna (Económico)</h3>
                      <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "12px", background: "rgba(34,197,94,0.2)", color: "#4ade80", padding: "2px 8px", borderRadius: "6px" }}>
                        {lunaPctNum}% del tráfico
                      </span>
                    </div>
                    <p style={{ fontSize: "13px", color: colors.textSec, lineHeight: 1.5, marginBottom: "16px" }}>
                      Enrutado para consultas frecuentes: consulta de saldos, fechas de vencimiento de pago, preguntas frecuentes sobre políticas y confirmaciones rápidas.
                    </p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                      <div>
                        <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "9px", color: colors.textTertiary, textTransform: "uppercase" }}>Costo Total</div>
                        <div style={{ fontSize: "16px", fontWeight: 700, color: colors.text }}>${Math.round(lunaModel.costoTotal).toLocaleString()}</div>
                      </div>
                      <div>
                        <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "9px", color: colors.textTertiary, textTransform: "uppercase" }}>Consultas</div>
                        <div style={{ fontSize: "16px", fontWeight: 700, color: colors.text }}>{lunaModel.consultas.toLocaleString()}</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ padding: "16px 20px", background: colors.inputBg, borderRadius: "10px", border: `1px solid ${colors.border}` }}>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: colors.text, marginBottom: "4px" }}>
                    Regla de Enrutamiento Silencioso (Invisible al Usuario)
                  </div>
                  <div style={{ fontSize: "12px", color: colors.textSec, lineHeight: 1.5 }}>
                    El usuario final nunca conoce cuál modelo procesa su consulta. El router analiza la semántica y complejidad del mensaje en milisegundos y optimiza el consumo de tokens manteniendo la máxima calidad de servicio.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── View: Handoffs ── */}
          {activeNav === "handoffs" && (
            <div style={{ ...card, padding: "28px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <div>
                  <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "9px", color: colors.textTertiary, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "4px" }}>
                    Atención Humana
                  </div>
                  <h2 style={{ fontSize: "18px", fontWeight: 600, color: colors.text, margin: 0 }}>Cola de Escalaciones (Handoffs)</h2>
                </div>
                <span style={{ fontSize: "12px", background: "rgba(249,115,22,0.12)", color: "#fb923c", borderRadius: "6px", padding: "4px 10px", fontFamily: "JetBrains Mono, monospace" }}>
                  {pendingHandoffsCount} casos pendientes
                </span>
              </div>

              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${colors.border}` }}>
                    {["Ticket", "Fecha", "Motivo de escalación", "Agente asignado", "Estado"].map((h) => (
                      <th key={h} style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "10px", color: colors.textTertiary, textTransform: "uppercase", letterSpacing: "0.08em", textAlign: "left", padding: "12px 14px", fontWeight: 500 }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayHandoffs.map((h) => (
                    <tr key={h.id} style={{ borderBottom: `1px solid ${colors.border}` }}>
                      <td style={{ padding: "14px", fontFamily: "JetBrains Mono, monospace", fontSize: "11px", color: colors.textTertiary }}>#TKT-00{h.id}</td>
                      <td style={{ padding: "14px", fontFamily: "JetBrains Mono, monospace", fontSize: "12px", color: colors.textSec }}>{h.date}</td>
                      <td style={{ padding: "14px", fontSize: "13px", fontWeight: 500, color: colors.text }}>{h.reason}</td>
                      <td style={{ padding: "14px", fontSize: "13px", color: colors.textSec }}>{h.agent}</td>
                      <td style={{ padding: "14px" }}>
                        <HandoffBadge status={h.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── View: Configuracion ── */}
          {activeNav === "configuracion" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div style={{ ...card, padding: "28px" }}>
                <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "9px", color: colors.textTertiary, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "4px" }}>
                  FinOps Engine
                </div>
                <h2 style={{ fontSize: "18px", fontWeight: 600, color: colors.text, margin: "0 0 8px 0" }}>
                  Modelo Matemático Stock & Flow
                </h2>
                <div style={{ fontSize: "13px", color: colors.textSec, marginBottom: "24px" }}>
                  Ecuación diferencial discreta que rige la bolsa de créditos prepagada de OpenAI:
                  <div style={{ fontFamily: "JetBrains Mono, monospace", background: colors.inputBg, padding: "12px 16px", borderRadius: "8px", margin: "12px 0", color: "#d8b4fe", fontSize: "13px" }}>
                    C(t) = C(t - 1) + R - U(t)
                  </div>
                  Donde <strong style={{ color: colors.text }}>C(t)</strong> es el saldo al final del día, <strong style={{ color: colors.text }}>R</strong> es la recarga diaria (Presupuesto mensual / 30), y <strong style={{ color: colors.text }}>U(t)</strong> es el consumo acumulado diario de la API.
                  {config?.fechaActualizacion && (
                    <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "11px", color: colors.textTertiary, marginTop: "8px" }}>
                      Última sincronización: {new Date(config.fechaActualizacion).toLocaleString("es-ES")}
                    </div>
                  )}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", marginBottom: "28px" }}>
                  <div style={{ background: colors.inputBg, padding: "20px", borderRadius: "10px", border: `1px solid ${colors.border}` }}>
                    <label style={{ display: "block", fontFamily: "JetBrains Mono, monospace", fontSize: "10px", color: colors.textTertiary, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "8px" }}>
                      Umbral de Alerta Crítica (USD)
                    </label>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "10px" }}>
                      <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "20px", fontWeight: 700, color: "#f87171" }}>
                        ${alertThreshold.toLocaleString()}
                      </span>
                      <span style={{ fontSize: "11px", color: colors.textTertiary }}>Dispara notificación automática</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={30000}
                      step={500}
                      value={alertThreshold}
                      onChange={(e) => setAlertThreshold(Number(e.target.value))}
                      style={{ width: "100%", accentColor: "#ef4444", cursor: "pointer" }}
                    />
                  </div>

                  <div style={{ background: colors.inputBg, padding: "20px", borderRadius: "10px", border: `1px solid ${colors.border}` }}>
                    <label style={{ display: "block", fontFamily: "JetBrains Mono, monospace", fontSize: "10px", color: colors.textTertiary, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "8px" }}>
                      Presupuesto Mensual Asignado (USD)
                    </label>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "10px" }}>
                      <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "20px", fontWeight: 700, color: "#60a5fa" }}>
                        ${monthlyBudget.toLocaleString()}
                      </span>
                      <span style={{ fontSize: "11px", color: colors.textTertiary }}>Recarga: ${(monthlyBudget / 30).toFixed(2)}/día</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={50000}
                      step={500}
                      value={monthlyBudget}
                      onChange={(e) => setMonthlyBudget(Number(e.target.value))}
                      style={{ width: "100%", accentColor: "#3b82f6", cursor: "pointer" }}
                    />
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button
                    onClick={handleSave}
                    style={{
                      padding: "12px 28px",
                      background: saved ? "rgba(74,222,128,0.2)" : "linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)",
                      border: `1px solid ${saved ? "rgba(74,222,128,0.4)" : "rgba(168,85,247,0.4)"}`,
                      borderRadius: "8px",
                      color: saved ? "#4ade80" : "white",
                      fontSize: "14px",
                      fontWeight: 600,
                      cursor: "pointer",
                      boxShadow: "0 4px 12px rgba(168,85,247,0.25)",
                      transition: "all 0.2s",
                    }}
                  >
                    {saved ? "✓ Cambios guardados con éxito" : "Guardar cambios de configuración"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  valueColor,
  delta,
  deltaPositive,
  sub,
  colors,
  icon,
}: {
  label: string;
  value: string;
  valueColor: string;
  delta: string;
  deltaPositive: boolean;
  sub: string;
  colors: any;
  icon: React.ReactElement;
}) {
  return (
    <div
      style={{
        background: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: "14px",
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        transition: "border-color 0.15s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "9px", color: colors.textTertiary, textTransform: "uppercase", letterSpacing: "0.1em" }}>
          {label}
        </div>
        <div style={{ opacity: 0.7 }}>{icon}</div>
      </div>
      <div style={{ fontSize: "28px", fontWeight: 700, color: valueColor, letterSpacing: "-0.03em", lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <span
          style={{
            fontFamily: "JetBrains Mono, monospace",
            fontSize: "10px",
            color: deltaPositive ? "#4ade80" : "#f87171",
            background: deltaPositive ? "rgba(74,222,128,0.1)" : "rgba(248,113,113,0.1)",
            padding: "2px 6px",
            borderRadius: "4px",
          }}
        >
          {delta}
        </span>
        <span style={{ fontSize: "11px", color: colors.textTertiary }}>{sub}</span>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg =
    status === "activa"
      ? { bg: "rgba(239,68,68,0.12)", color: "#f87171", label: "Activa" }
      : { bg: "rgba(100,100,120,0.15)", color: "#9c9ba8", label: "Resuelta" };
  return (
    <span
      style={{
        fontFamily: "JetBrains Mono, monospace",
        fontSize: "10px",
        background: cfg.bg,
        color: cfg.color,
        borderRadius: "5px",
        padding: "3px 8px",
        letterSpacing: "0.04em",
        textTransform: "uppercase",
      }}
    >
      {cfg.label}
    </span>
  );
}

function HandoffBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    pendiente: { bg: "rgba(239,68,68,0.12)", color: "#f87171", label: "Pendiente" },
    "en curso": { bg: "rgba(59,130,246,0.12)", color: "#60a5fa", label: "En curso" },
    resuelto: { bg: "rgba(100,100,120,0.15)", color: "#9c9ba8", label: "Resuelto" },
  };
  const cfg = map[status] ?? map.resuelto;
  return (
    <span
      style={{
        fontFamily: "JetBrains Mono, monospace",
        fontSize: "10px",
        background: cfg.bg,
        color: cfg.color,
        borderRadius: "5px",
        padding: "3px 8px",
        letterSpacing: "0.04em",
        textTransform: "uppercase",
      }}
    >
      {cfg.label}
    </span>
  );
}
