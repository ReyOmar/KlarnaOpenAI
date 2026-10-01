import { useEffect, useMemo, useState } from "react";
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { obtenerEscenarios, obtenerComparacion, simular } from "../services/api";
import type {
  ParametrosSimulacion,
  ResultadoSimulacion,
  EscenarioPredefinido,
  ComparacionEscenario,
} from "../services/api";

type Colors = {
  surface: string;
  border: string;
  text: string;
  textSec: string;
  textTertiary: string;
  inputBg: string;
};

type Campo = {
  key: keyof ParametrosSimulacion;
  label: string;
  unidad?: string;
  step: number;
  min: number;
  max: number;
};

// Parámetros editables agrupados por tipo de variable del modelo
const GRUPOS: { grupo: string; campos: Campo[] }[] = [
  {
    grupo: "Demanda",
    campos: [
      { key: "conversacionesDiarias", label: "Conversaciones por día", step: 1000, min: 0, max: 10_000_000 },
      { key: "crecimientoMensualPct", label: "Crecimiento mensual", unidad: "%", step: 1, min: -50, max: 200 },
      { key: "variabilidadPct", label: "Variabilidad diaria (±)", unidad: "%", step: 5, min: 0, max: 100 },
    ],
  },
  {
    grupo: "Enrutamiento",
    campos: [
      { key: "porcentajeHandoff", label: "Escalamiento a humanos", unidad: "%", step: 1, min: 0, max: 100 },
      { key: "porcentajeTerra", label: "Consultas de IA a Terra", unidad: "%", step: 5, min: 0, max: 100 },
    ],
  },
  {
    grupo: "Costos",
    campos: [
      { key: "tokensEntrada", label: "Tokens de entrada / conv.", step: 50, min: 0, max: 100_000 },
      { key: "tokensSalida", label: "Tokens de salida / conv.", step: 50, min: 0, max: 100_000 },
      { key: "factorPrecios", label: "Factor de precios", unidad: "×", step: 0.1, min: 0, max: 100 },
    ],
  },
  {
    grupo: "Presupuesto",
    campos: [
      { key: "presupuestoMensual", label: "Presupuesto mensual", unidad: "USD", step: 500, min: 0, max: 100_000_000 },
      { key: "saldoInicial", label: "Saldo inicial C(0)", unidad: "USD", step: 500, min: 0, max: 100_000_000 },
      { key: "umbralAlerta", label: "Umbral de alerta", unidad: "USD", step: 500, min: 0, max: 100_000_000 },
    ],
  },
  {
    grupo: "Ejecución",
    campos: [
      { key: "dias", label: "Horizonte", unidad: "días", step: 30, min: 1, max: 365 },
      { key: "corridas", label: "Corridas (si hay variabilidad)", step: 10, min: 1, max: 500 },
      { key: "semilla", label: "Semilla aleatoria", step: 1, min: 0, max: 2147483647 },
    ],
  },
];

const ETIQUETAS: Partial<Record<keyof ParametrosSimulacion, string>> = Object.fromEntries(
  GRUPOS.flatMap((g) => g.campos.map((c) => [c.key, c.label]))
);

const usd = (v: number) => `$${Math.round(v).toLocaleString("en-US")}`;
const num = (v: number) => Math.round(v).toLocaleString("en-US");

function interpretar(r: ResultadoSimulacion): string {
  const i = r.indicadores;
  const p = r.parametros;
  if (i.diaAgotamiento !== null) {
    return `El saldo se agota el día ${i.diaAgotamiento} y el servicio de IA queda ${i.diasSinServicio} días sin créditos: unas ${num(i.conversacionesNoAtendidas)} conversaciones no podrían atenderse. Para sostener esta demanda se necesita un presupuesto de al menos ${usd(i.presupuestoMinimoSostenible)}/mes.`;
  }
  if (i.saldoFinal < p.saldoInicial) {
    const caida = (p.saldoInicial - i.saldoFinal) / p.dias;
    return `El saldo no se agota en ${p.dias} días, pero disminuye en promedio ${usd(caida)}/día. ${i.diaAlerta !== null ? `Cruza el umbral de alerta el día ${i.diaAlerta}.` : "A ese ritmo terminaría cruzando el umbral fuera del horizonte simulado."} El presupuesto mínimo sostenible al final del periodo es ${usd(i.presupuestoMinimoSostenible)}/mes.`;
  }
  return `El sistema es sostenible: la recarga (${usd(i.recargaDiaria)}/día) supera el consumo promedio (${usd(i.consumoPromedioDiario)}/día) y el saldo termina en ${usd(i.saldoFinal)}. El presupuesto podría bajar hasta ${usd(i.presupuestoMinimoSostenible)}/mes sin que el saldo disminuya.`;
}

export default function Simulador({ colors, isDark }: { colors: Colors; isDark: boolean }) {
  const [base, setBase] = useState<ParametrosSimulacion | null>(null);
  const [escenarios, setEscenarios] = useState<EscenarioPredefinido[]>([]);
  const [comparacion, setComparacion] = useState<ComparacionEscenario[]>([]);
  const [params, setParams] = useState<ParametrosSimulacion | null>(null);
  const [escenarioId, setEscenarioId] = useState("E0");
  const [resultado, setResultado] = useState<ResultadoSimulacion | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([obtenerEscenarios(), obtenerComparacion()])
      .then(([e, c]) => {
        setBase(e.base);
        setParams(e.base);
        setEscenarios(e.escenarios);
        setComparacion(c);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "No se pudo cargar el simulador"));
  }, []);

  // Recalcula con una pequeña espera para no saturar la API mientras se escribe
  useEffect(() => {
    if (!params) return;
    const id = setTimeout(() => {
      simular(params)
        .then((r) => {
          setResultado(r);
          setError(null);
        })
        .catch((err) => setError(err instanceof Error ? err.message : "Error al simular"));
    }, 300);
    return () => clearTimeout(id);
  }, [params]);

  const cargarEscenario = (e: EscenarioPredefinido) => {
    if (!base) return;
    setEscenarioId(e.id);
    setParams({ ...base, ...e.cambios });
  };

  const cambiarCampo = (campo: Campo, valor: string) => {
    if (!params) return;
    const n = Number(valor);
    if (!Number.isFinite(n)) return;
    setEscenarioId("personalizado");
    setParams({ ...params, [campo.key]: Math.min(Math.max(n, campo.min), campo.max) });
  };

  const datosGrafico = useMemo(() => {
    if (!resultado) return [];
    const serieBase = comparacion.find((c) => c.id === "E0")?.serie ?? [];
    return resultado.serie.map((s) => ({
      dia: s.dia,
      saldo: s.saldo,
      base: serieBase[s.dia - 1]?.saldo,
      banda: s.saldoP5 !== undefined && s.saldoP95 !== undefined ? [s.saldoP5, s.saldoP95] : undefined,
    }));
  }, [resultado, comparacion]);

  const card = { background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: "14px" };
  const label = { fontFamily: "JetBrains Mono, monospace", fontSize: "9px", color: colors.textTertiary, textTransform: "uppercase" as const, letterSpacing: "0.08em" };

  if (error && !params) {
    return <div style={{ ...card, padding: "24px", color: "#f87171", fontSize: "13px" }}>{error}</div>;
  }
  if (!params || !base) {
    return <div style={{ ...card, padding: "24px", color: colors.textSec, fontSize: "13px" }}>Cargando simulador…</div>;
  }

  const ind = resultado?.indicadores;
  const estocastico = params.variabilidadPct > 0 && params.corridas > 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Encabezado y escenarios */}
      <div style={{ ...card, padding: "24px" }}>
        <div style={{ ...label, fontSize: "9px", letterSpacing: "0.1em", marginBottom: "4px" }}>Simulación de escenarios</div>
        <h2 style={{ fontSize: "18px", fontWeight: 600, color: colors.text, margin: "0 0 6px 0" }}>Proyección del saldo de créditos C(t)</h2>
        <p style={{ fontSize: "12.5px", color: colors.textSec, lineHeight: 1.6, margin: "0 0 16px 0" }}>
          Prueba decisiones sin afectar la operación real. Cada escenario predefinido modifica un solo parámetro respecto del base.
          Modelo: C(t) = max(C(t−1) + R − U(t), 0), con R = presupuesto / 30 y U(t) = demanda × (1 − handoff) × costo por conversación.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          {escenarios.map((e) => {
            const activo = escenarioId === e.id;
            return (
              <button
                key={e.id}
                onClick={() => cargarEscenario(e)}
                title={e.descripcion}
                style={{
                  padding: "7px 12px",
                  borderRadius: "8px",
                  fontSize: "12px",
                  cursor: "pointer",
                  border: `1px solid ${activo ? "rgba(168,85,247,0.5)" : colors.border}`,
                  background: activo ? "rgba(168,85,247,0.15)" : colors.inputBg,
                  color: activo ? "#d8b4fe" : colors.textSec,
                  fontWeight: activo ? 600 : 400,
                }}
              >
                {e.id} · {e.nombre}
              </button>
            );
          })}
          {escenarioId === "personalizado" && (
            <span style={{ padding: "7px 12px", fontSize: "12px", color: "#fbbf24" }}>Escenario personalizado</span>
          )}
        </div>
        {escenarioId !== "personalizado" && (
          <div style={{ marginTop: "10px", fontSize: "12px", color: colors.textTertiary }}>
            {escenarios.find((e) => e.id === escenarioId)?.descripcion}
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: "20px", alignItems: "start" }}>
        {/* Parámetros */}
        <div style={{ ...card, padding: "20px", display: "flex", flexDirection: "column", gap: "18px" }}>
          {GRUPOS.map((g) => (
            <div key={g.grupo}>
              <div style={{ ...label, marginBottom: "10px", color: "#a855f7" }}>{g.grupo}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {g.campos.map((c) => {
                  const modificado = params[c.key] !== base[c.key];
                  return (
                    <label key={c.key} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <span style={{ fontSize: "11.5px", color: modificado ? "#d8b4fe" : colors.textSec }}>
                        {c.label}
                        {c.unidad ? ` (${c.unidad})` : ""}
                        {modificado ? " •" : ""}
                      </span>
                      <input
                        type="number"
                        value={params[c.key]}
                        step={c.step}
                        min={c.min}
                        max={c.max}
                        onChange={(e) => cambiarCampo(c, e.target.value)}
                        style={{
                          background: colors.inputBg,
                          border: `1px solid ${modificado ? "rgba(168,85,247,0.5)" : colors.border}`,
                          borderRadius: "7px",
                          padding: "7px 10px",
                          fontSize: "13px",
                          color: colors.text,
                          fontFamily: "JetBrains Mono, monospace",
                          outline: "none",
                        }}
                      />
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
          <button
            onClick={() => cargarEscenario(escenarios[0])}
            style={{ padding: "9px", borderRadius: "8px", border: `1px solid ${colors.border}`, background: colors.inputBg, color: colors.textSec, fontSize: "12px", cursor: "pointer" }}
          >
            Restablecer escenario base
          </button>
        </div>

        {/* Resultados */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px", minWidth: 0 }}>
          {error && (
            <div style={{ padding: "10px 14px", borderRadius: "8px", background: "rgba(239,68,68,0.1)", color: "#f87171", fontSize: "12px" }}>{error}</div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px" }}>
            <Kpi colors={colors} titulo="Saldo final" valor={ind ? usd(ind.saldoFinal) : "—"} color={ind && ind.saldoFinal < params.umbralAlerta ? "#f87171" : "#4ade80"} />
            <Kpi colors={colors} titulo="Día de alerta" valor={ind ? (ind.diaAlerta ?? "—").toString() : "—"} color="#fbbf24" />
            <Kpi colors={colors} titulo="Día de agotamiento" valor={ind ? (ind.diaAgotamiento ?? "No se agota").toString() : "—"} color={ind?.diaAgotamiento ? "#f87171" : "#4ade80"} />
            <Kpi colors={colors} titulo="Conv. no atendidas" valor={ind ? num(ind.conversacionesNoAtendidas) : "—"} color={ind?.conversacionesNoAtendidas ? "#f87171" : colors.text} />
            <Kpi colors={colors} titulo="Consumo prom. U" valor={ind ? `${usd(ind.consumoPromedioDiario)}/día` : "—"} color="#fb923c" />
            <Kpi colors={colors} titulo="Recarga R" valor={ind ? `${usd(ind.recargaDiaria)}/día` : "—"} color="#60a5fa" />
            <Kpi colors={colors} titulo="Presupuesto mínimo" valor={ind ? `${usd(ind.presupuestoMinimoSostenible)}/mes` : "—"} color={colors.text} />
            <Kpi
              colors={colors}
              titulo={estocastico ? "Prob. de agotamiento" : "Gasto del periodo"}
              valor={ind ? (estocastico ? `${(ind.probabilidadAgotamiento * 100).toFixed(1)}%` : usd(ind.costoTotal)) : "—"}
              color={colors.text}
            />
          </div>

          <div style={{ ...card, padding: "20px" }}>
            <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginBottom: "12px", fontSize: "11px", color: colors.textSec }}>
              <Leyenda color="#a855f7" texto={escenarioId === "personalizado" ? "Escenario personalizado" : `Escenario ${escenarioId}`} />
              <Leyenda color={colors.textTertiary} texto="Base (E0)" dashed />
              <Leyenda color="#ef4444" texto="Umbral de alerta" dashed />
              {estocastico && <Leyenda color="rgba(168,85,247,0.35)" texto="Rango 5 %–95 % de las corridas" area />}
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={datosGrafico} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={colors.border} strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="dia"
                  tick={{ fill: colors.textTertiary, fontSize: 10, fontFamily: "JetBrains Mono, monospace" }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={20}
                  label={{ value: "Día", position: "insideBottomRight", offset: -2, fill: colors.textTertiary, fontSize: 10 }}
                />
                <YAxis
                  tick={{ fill: colors.textTertiary, fontSize: 10, fontFamily: "JetBrains Mono, monospace" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  contentStyle={{ background: isDark ? "#16161f" : "#fff", border: `1px solid ${colors.border}`, borderRadius: 8, fontSize: 12 }}
                  labelFormatter={(d) => `Día ${d}`}
                  formatter={(v, name) => [
                    Array.isArray(v) ? `${usd(Number(v[0]))} – ${usd(Number(v[1]))}` : usd(Number(v)),
                    name === "saldo" ? "Saldo" : name === "base" ? "Base" : "Rango 5–95 %",
                  ]}
                />
                <ReferenceLine y={params.umbralAlerta} stroke="#ef4444" strokeDasharray="4 4" />
                {estocastico && <Area type="monotone" dataKey="banda" stroke="none" fill="rgba(168,85,247,0.18)" isAnimationActive={false} />}
                <Line type="monotone" dataKey="base" stroke={colors.textTertiary} strokeDasharray="5 4" dot={false} strokeWidth={1.5} isAnimationActive={false} />
                <Line type="monotone" dataKey="saldo" stroke="#a855f7" dot={false} strokeWidth={2.2} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
            {resultado && (
              <div style={{ marginTop: "14px", padding: "12px 14px", background: colors.inputBg, borderRadius: "8px", border: `1px solid ${colors.border}`, fontSize: "12.5px", color: colors.textSec, lineHeight: 1.6 }}>
                <strong style={{ color: colors.text }}>Interpretación: </strong>
                {interpretar(resultado)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Comparación de escenarios predefinidos */}
      <div style={{ ...card, padding: "24px" }}>
        <div style={{ ...label, letterSpacing: "0.1em", marginBottom: "4px" }}>Comparación</div>
        <h3 style={{ fontSize: "15px", fontWeight: 600, color: colors.text, margin: "0 0 14px 0" }}>Resultados de los escenarios predefinidos</h3>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "760px" }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${colors.border}` }}>
                {["Escenario", "Parámetro modificado", "Saldo final", "Día alerta", "Día agotamiento", "Conv. no atendidas", "Gasto", "Presupuesto mínimo"].map((h) => (
                  <th key={h} style={{ ...label, textAlign: "left", padding: "10px 10px", fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comparacion.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => cargarEscenario(c)}
                  style={{ borderBottom: `1px solid ${colors.border}`, cursor: "pointer", background: escenarioId === c.id ? "rgba(168,85,247,0.08)" : "transparent" }}
                >
                  <td style={{ padding: "11px 10px", fontSize: "12.5px", color: colors.text, fontWeight: 500 }}>{c.id} · {c.nombre}</td>
                  <td style={{ padding: "11px 10px", fontSize: "12px", color: colors.textSec }}>
                    {c.parametro ? `${ETIQUETAS[c.parametro] ?? c.parametro}: ${base[c.parametro]} → ${c.cambios[c.parametro]}` : "—"}
                  </td>
                  <td style={{ padding: "11px 10px", fontSize: "12px", fontFamily: "JetBrains Mono, monospace", color: c.indicadores.saldoFinal === 0 ? "#f87171" : colors.text }}>{usd(c.indicadores.saldoFinal)}</td>
                  <td style={{ padding: "11px 10px", fontSize: "12px", fontFamily: "JetBrains Mono, monospace", color: colors.textSec }}>{c.indicadores.diaAlerta ?? "—"}</td>
                  <td style={{ padding: "11px 10px", fontSize: "12px", fontFamily: "JetBrains Mono, monospace", color: c.indicadores.diaAgotamiento ? "#f87171" : colors.textSec }}>{c.indicadores.diaAgotamiento ?? "—"}</td>
                  <td style={{ padding: "11px 10px", fontSize: "12px", fontFamily: "JetBrains Mono, monospace", color: colors.textSec }}>{num(c.indicadores.conversacionesNoAtendidas)}</td>
                  <td style={{ padding: "11px 10px", fontSize: "12px", fontFamily: "JetBrains Mono, monospace", color: colors.textSec }}>{usd(c.indicadores.costoTotal)}</td>
                  <td style={{ padding: "11px 10px", fontSize: "12px", fontFamily: "JetBrains Mono, monospace", color: colors.textSec }}>{usd(c.indicadores.presupuestoMinimoSostenible)}/mes</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: "11px", color: colors.textTertiary, margin: "12px 0 0 0", lineHeight: 1.5 }}>
          Supuestos: 2,3 millones de conversaciones/mes (Klarna, 2024) → 76.667/día; 800 tokens de entrada y 400 de salida por conversación;
          precios de referencia Terra USD 2/12 y Luna USD 0,20/1,20 por millón de tokens; saldo inicial USD 10.000. Haz clic en una fila para cargar el escenario.
        </p>
      </div>
    </div>
  );
}

function Kpi({ titulo, valor, color, colors }: { titulo: string; valor: string; color: string; colors: Colors }) {
  return (
    <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: "12px", padding: "14px" }}>
      <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "9px", color: colors.textTertiary, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "6px" }}>
        {titulo}
      </div>
      <div style={{ fontSize: "18px", fontWeight: 700, color, letterSpacing: "-0.02em" }}>{valor}</div>
    </div>
  );
}

function Leyenda({ color, texto, dashed, area }: { color: string; texto: string; dashed?: boolean; area?: boolean }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
      <span
        style={{
          width: "16px",
          height: area ? "10px" : 0,
          borderTop: area ? "none" : `2px ${dashed ? "dashed" : "solid"} ${color}`,
          background: area ? color : "transparent",
          borderRadius: area ? "2px" : 0,
        }}
      />
      {texto}
    </span>
  );
}
