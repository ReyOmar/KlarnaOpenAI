import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { enviarMensaje } from "../services/api";
import type { MensajeResponse } from "../services/api";

// ─── Types ────────────────────────────────────────────────────────────────────

type SenderRole = "user" | "assistant" | "agent" | "system";

interface MessageAction {
  label: string;
  variant: "primary" | "secondary";
}

interface ChatMessage {
  id: number | string;
  role: SenderRole;
  text: string;
  agentName?: string;
  actions?: MessageAction[];
  timestamp?: string;
}

// ─── Themes (Exact tokens from ChatKlarna) ────────────────────────────────────

const dark = {
  pageBg: "#08080b",
  gridLine: "rgba(255,255,255,0.035)",
  headerBg: "rgba(12,12,17,0.92)",
  headerBorder: "rgba(255,255,255,0.07)",
  headerTitle: "#f0eaff",
  headerSub: "#9c9ba8",
  inputBar: "rgba(12,12,17,0.95)",
  inputBarBorder: "rgba(255,255,255,0.07)",
  inputField: "#0f0f16",
  inputBorder: "rgba(255,255,255,0.1)",
  inputFocusBorder: "rgba(168,85,247,0.4)",
  inputText: "#f0eaff",
  inputPlaceholder: "#4a4958",
  caretColor: "#a855f7",
  userBubbleBg: "rgba(168,85,247,0.15)",
  userBubbleBorder: "rgba(168,85,247,0.25)",
  userBubbleText: "#f0eaff",
  aiBubbleBg: "#0f0f16",
  aiBubbleBorder: "rgba(255,255,255,0.08)",
  aiBubbleText: "#e8e7f0",
  aiAvatarBg: "#1a1a24",
  aiAvatarBorder: "rgba(255,255,255,0.08)",
  aiAvatarColor: "#a855f7",
  agentAvatarBg: "#1a1a20",
  agentAvatarBorder: "rgba(239,68,68,0.3)",
  agentAvatarColor: "#f87171",
  agentLabelColor: "#f87171",
  agentBubbleBg: "#100e0e",
  agentBubbleBorder: "rgba(239,68,68,0.18)",
  agentBubbleText: "#e8e7f0",
  systemText: "#9c9ba8",
  actionPrimaryBg: "rgba(168,85,247,0.18)",
  actionPrimaryBorder: "rgba(168,85,247,0.4)",
  actionPrimaryText: "#d4b0ff",
  actionPrimaryHover: "rgba(168,85,247,0.28)",
  actionSecondaryBg: "rgba(255,255,255,0.04)",
  actionSecondaryBorder: "rgba(255,255,255,0.1)",
  actionSecondaryText: "#9c9ba8",
  sendActiveBg: "#a855f7",
  sendInactiveBg: "#1a1a24",
  sendInactiveBorder: "rgba(255,255,255,0.08)",
  sendInactiveColor: "#4a4958",
  representativeText: "#4a4958",
  toggleBg: "rgba(255,255,255,0.07)",
  toggleBorder: "rgba(255,255,255,0.1)",
  toggleColor: "#9c9ba8",
  // Welcome suggestions styling
  cardBg: "rgba(15,15,22,0.7)",
  cardBorder: "rgba(255,255,255,0.08)",
  chipBg: "rgba(255,255,255,0.04)",
  chipBorder: "rgba(255,255,255,0.1)",
  chipText: "#d1d0db",
  chipHoverBg: "rgba(168,85,247,0.15)",
  chipHoverBorder: "rgba(168,85,247,0.35)",
  chipHoverText: "#f0eaff",
};

const light = {
  pageBg: "#f5f5f7",
  gridLine: "rgba(0,0,0,0.045)",
  headerBg: "rgba(255,255,255,0.92)",
  headerBorder: "rgba(0,0,0,0.07)",
  headerTitle: "#111118",
  headerSub: "#6b6a7a",
  inputBar: "rgba(255,255,255,0.96)",
  inputBarBorder: "rgba(0,0,0,0.07)",
  inputField: "#ffffff",
  inputBorder: "rgba(0,0,0,0.12)",
  inputFocusBorder: "rgba(168,85,247,0.5)",
  inputText: "#111118",
  inputPlaceholder: "#a5a4b0",
  caretColor: "#a855f7",
  userBubbleBg: "#e2e2e8",
  userBubbleBorder: "rgba(0,0,0,0.07)",
  userBubbleText: "#111118",
  aiBubbleBg: "#ffffff",
  aiBubbleBorder: "rgba(0,0,0,0.1)",
  aiBubbleText: "#111118",
  aiAvatarBg: "#ede9f6",
  aiAvatarBorder: "rgba(168,85,247,0.15)",
  aiAvatarColor: "#a855f7",
  agentAvatarBg: "#fde8e8",
  agentAvatarBorder: "rgba(239,68,68,0.25)",
  agentAvatarColor: "#ef4444",
  agentLabelColor: "#ef4444",
  agentBubbleBg: "#ffffff",
  agentBubbleBorder: "rgba(239,68,68,0.15)",
  agentBubbleText: "#111118",
  systemText: "#9c9ba8",
  actionPrimaryBg: "#000000",
  actionPrimaryBorder: "#000000",
  actionPrimaryText: "#ffffff",
  actionPrimaryHover: "#1a1a1a",
  actionSecondaryBg: "#f0f0f4",
  actionSecondaryBorder: "rgba(0,0,0,0.1)",
  actionSecondaryText: "#4a4a55",
  sendActiveBg: "#a855f7",
  sendInactiveBg: "#e8e7ee",
  sendInactiveBorder: "rgba(0,0,0,0.1)",
  sendInactiveColor: "#a5a4b0",
  representativeText: "#a5a4b0",
  toggleBg: "rgba(0,0,0,0.05)",
  toggleBorder: "rgba(0,0,0,0.1)",
  toggleColor: "#6b6a7a",
  // Welcome suggestions styling
  cardBg: "rgba(255,255,255,0.85)",
  cardBorder: "rgba(0,0,0,0.08)",
  chipBg: "#ffffff",
  chipBorder: "rgba(0,0,0,0.1)",
  chipText: "#4a4a55",
  chipHoverBg: "#f3e8ff",
  chipHoverBorder: "#d8b4fe",
  chipHoverText: "#6b21a8",
};

type ThemeTokens = typeof dark;

// ─── SVG Icons ────────────────────────────────────────────────────────────────

function IconAI() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="2" width="5" height="5" rx="1" fill="currentColor" opacity="0.7" />
      <rect x="9" y="2" width="5" height="5" rx="1" fill="currentColor" />
      <rect x="2" y="9" width="5" height="5" rx="1" fill="currentColor" />
      <rect x="9" y="9" width="5" height="5" rx="1" fill="currentColor" opacity="0.7" />
    </svg>
  );
}

function IconAgent() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="5.5" r="2.5" fill="currentColor" />
      <path d="M2 13.5c0-3.314 2.686-5 6-5s6 1.686 6 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    </svg>
  );
}

function IconSend() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M14 8L2 2l3 6-3 6 12-6z" fill="currentColor" />
    </svg>
  );
}

function IconMoon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <path d="M7.5 1a6.5 6.5 0 1 0 6.5 6.5A5 5 0 0 1 7.5 1z" fill="currentColor" />
    </svg>
  );
}

function IconSun() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <circle cx="7.5" cy="7.5" r="3" fill="currentColor" />
      <path d="M7.5 1v1.5M7.5 12.5V14M1 7.5h1.5M12.5 7.5H14M3.1 3.1l1.06 1.06M10.84 10.84l1.06 1.06M10.84 4.16l1.06-1.06M3.1 11.9l1.06-1.06" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function IconKlarna() {
  return (
    <svg width="72" height="22" viewBox="0 0 72 22" fill="none">
      <rect width="22" height="22" rx="6" fill="#FFB3C7" />
      <text x="11" y="15.5" textAnchor="middle" fontFamily="'Inter', sans-serif" fontWeight="700" fontSize="11" fill="#1a0010">K</text>
      <text x="30" y="15.5" fontFamily="'Inter', sans-serif" fontWeight="700" fontSize="14" fill="currentColor">larna</text>
    </svg>
  );
}

function IconDashboard({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect x="1" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <rect x="9" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <rect x="1" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <rect x="9" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

// ─── Suggestion Prompts ────────────────────────────────────────────────────────

const SUGGESTIONS = [
  "¿Cuál es el estado de mi pedido?",
  "¿Puedo extender mi plazo de pago?",
  "Necesito hacer una devolución",
  "¿Cuáles son las políticas de reembolso?",
];

// ─── Sub-Components ───────────────────────────────────────────────────────────

function TypingIndicator({ t }: { t: ThemeTokens }) {
  return (
    <div className="msg-in" style={{ display: "flex", alignItems: "flex-end", gap: "10px", margin: "4px 0" }}>
      <div
        style={{
          background: t.aiAvatarBg,
          border: `1px solid ${t.aiAvatarBorder}`,
          color: t.aiAvatarColor,
          width: "32px",
          height: "32px",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <IconAI />
      </div>
      <div
        style={{
          background: t.aiBubbleBg,
          border: `1px solid ${t.aiBubbleBorder}`,
          borderRadius: "16px",
          borderBottomLeftRadius: "4px",
          padding: "10px 16px",
          display: "flex",
          alignItems: "center",
          gap: "6px",
        }}
      >
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
      </div>
    </div>
  );
}

function SystemMessage({ text, t }: { text: string; t: ThemeTokens }) {
  return (
    <div style={{ display: "flex", justifyContent: "center", margin: "8px 0" }}>
      <span
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          color: t.systemText,
          fontSize: "11px",
          letterSpacing: "0.01em",
          background: "rgba(255,255,255,0.03)",
          padding: "4px 12px",
          borderRadius: "20px",
          border: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        {text}
      </span>
    </div>
  );
}

function UserBubble({ text, t }: { text: string; t: ThemeTokens }) {
  return (
    <div className="msg-in" style={{ display: "flex", justifyContent: "flex-end", margin: "4px 0" }}>
      <div
        style={{
          background: t.userBubbleBg,
          border: `1px solid ${t.userBubbleBorder}`,
          color: t.userBubbleText,
          fontSize: "14px",
          lineHeight: "1.6",
          maxWidth: "460px",
          borderRadius: "16px",
          borderBottomRightRadius: "4px",
          padding: "12px 18px",
          wordBreak: "break-word",
        }}
      >
        {text}
      </div>
    </div>
  );
}

function AssistantBubble({
  text,
  actions,
  onAction,
  t,
}: {
  text: string;
  actions?: MessageAction[];
  onAction?: (label: string) => void;
  t: ThemeTokens;
}) {
  return (
    <div className="msg-in" style={{ display: "flex", alignItems: "flex-end", gap: "10px", margin: "4px 0" }}>
      <div
        style={{
          background: t.aiAvatarBg,
          border: `1px solid ${t.aiAvatarBorder}`,
          color: t.aiAvatarColor,
          width: "32px",
          height: "32px",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <IconAI />
      </div>
      <div style={{ maxWidth: "500px", display: "flex", flexDirection: "column", gap: "10px" }}>
        <div
          style={{
            background: t.aiBubbleBg,
            border: `1px solid ${t.aiBubbleBorder}`,
            color: t.aiBubbleText,
            fontSize: "14px",
            lineHeight: "1.65",
            borderRadius: "16px",
            borderBottomLeftRadius: "4px",
            padding: "14px 18px",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {text}
        </div>
        {actions && actions.length > 0 && (
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", paddingLeft: "2px" }}>
            {actions.map((a) => (
              <button
                key={a.label}
                onClick={() => onAction?.(a.label)}
                style={{
                  background: a.variant === "primary" ? t.actionPrimaryBg : t.actionSecondaryBg,
                  border: `1px solid ${a.variant === "primary" ? t.actionPrimaryBorder : t.actionSecondaryBorder}`,
                  color: a.variant === "primary" ? t.actionPrimaryText : t.actionSecondaryText,
                  fontSize: "12.5px",
                  fontWeight: 500,
                  cursor: "pointer",
                  padding: "6px 14px",
                  borderRadius: "10px",
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => {
                  if (a.variant === "primary") e.currentTarget.style.background = t.actionPrimaryHover;
                }}
                onMouseLeave={(e) => {
                  if (a.variant === "primary") e.currentTarget.style.background = t.actionPrimaryBg;
                }}
              >
                {a.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AgentBubble({
  text,
  agentName,
  t,
}: {
  text: string;
  agentName?: string;
  t: ThemeTokens;
}) {
  return (
    <div className="msg-in" style={{ display: "flex", alignItems: "flex-end", gap: "10px", margin: "4px 0" }}>
      <div
        style={{
          background: t.agentAvatarBg,
          border: `1px solid ${t.agentAvatarBorder}`,
          color: t.agentAvatarColor,
          width: "32px",
          height: "32px",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <IconAgent />
      </div>
      <div style={{ maxWidth: "500px" }}>
        <div
          style={{
            color: t.agentLabelColor,
            fontSize: "10px",
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            marginBottom: "5px",
            paddingLeft: "2px",
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          {agentName ? `Agente humano — ${agentName}` : "Agente humano"}
        </div>
        <div
          style={{
            background: t.agentBubbleBg,
            border: `1px solid ${t.agentBubbleBorder}`,
            color: t.agentBubbleText,
            fontSize: "14px",
            lineHeight: "1.65",
            borderRadius: "16px",
            borderBottomLeftRadius: "4px",
            padding: "14px 18px",
            wordBreak: "break-word",
          }}
        >
          {text}
        </div>
      </div>
    </div>
  );
}

// ─── Main Chat Component ──────────────────────────────────────────────────────

export default function Chat() {
  const navigate = useNavigate();
  const [isDark, setIsDark] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "sys-welcome",
      role: "system",
      text: "Puedes solicitar un agente humano si lo necesitas.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [conversacionId, setConversacionId] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const t = isDark ? dark : light;
  const userId = 1;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend ?? input).trim();
    if (!query || isTyping) return;
    setInput("");

    // Add user message
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: query,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);

    try {
      const response: MensajeResponse = await enviarMensaje(userId, query, conversacionId || undefined);

      setConversacionId(response.conversacionId);

      if (response.tipo === "handoff") {
        // Human escalation
        const systemNotice: ChatMessage = {
          id: `sys-handoff-${Date.now()}`,
          role: "system",
          text: "Derivando tu consulta con un agente especializado de soporte...",
        };
        const agentMsg: ChatMessage = {
          id: response.mensaje.id,
          role: "agent",
          text: response.mensaje.contenido,
          agentName: response.agente,
          timestamp: response.mensaje.timestamp,
        };
        setMessages((prev) => [...prev, systemNotice, agentMsg]);
      } else {
        // AI Assistant response with contextual actions
        const actions: MessageAction[] = [
          { label: "Ver estado de cuenta", variant: "primary" },
          { label: "Hablar con un agente", variant: "secondary" },
        ];

        const assistantMsg: ChatMessage = {
          id: response.mensaje.id,
          role: "assistant",
          text: response.mensaje.contenido,
          actions,
          timestamp: response.mensaje.timestamp,
        };
        setMessages((prev) => [...prev, assistantMsg]);
      }
    } catch (error) {
      console.error("Error enviando mensaje:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          text: "Disculpa las molestias, ocurrió un inconveniente temporal al conectar con el asistente. Por favor, intenta enviar tu mensaje nuevamente.",
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleAction = (label: string) => {
    if (label === "Hablar con un agente") {
      handleSend("Quiero hablar con un representante humano");
    } else {
      handleSend(label);
    }
  };

  // Has the conversation started? (i.e. more than initial system message)
  const hasUserMessages = messages.some((m) => m.role === "user");

  return (
    <div
      style={{
        minHeight: "100vh",
        background: t.pageBg,
        backgroundImage: `linear-gradient(${t.gridLine} 1px, transparent 1px), linear-gradient(90deg, ${t.gridLine} 1px, transparent 1px)`,
        backgroundSize: "40px 40px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        transition: "background-color 0.25s",
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      <div style={{ width: "100%", maxWidth: "760px", height: "100vh", display: "flex", flexDirection: "column" }}>
        {/* ── Header ── */}
        <header
          style={{
            background: t.headerBg,
            borderBottom: `1px solid ${t.headerBorder}`,
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            flexShrink: 0,
            padding: "14px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            transition: "background 0.25s, border-color 0.25s",
            zIndex: 10,
          }}
        >
          {/* Brand Left */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ color: t.headerTitle, display: "flex", alignItems: "center" }}>
              <IconKlarna />
            </div>
            <span
              style={{
                color: t.headerSub,
                fontSize: "12px",
                borderLeft: `1px solid ${t.headerBorder}`,
                paddingLeft: "10px",
                fontWeight: 500,
              }}
            >
              Soporte
            </span>
          </div>

          {/* Controls Right */}
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span className="pulse-dot" style={{ display: "inline-block", width: "7px", height: "7px", borderRadius: "50%", background: "#4ade80" }} />
              <span style={{ color: t.headerSub, fontSize: "12px", fontWeight: 500 }}>Asistente en línea</span>
            </div>

            {/* Dark / Light Toggle */}
            <button
              onClick={() => setIsDark((d) => !d)}
              style={{
                background: t.toggleBg,
                border: `1px solid ${t.toggleBorder}`,
                color: t.toggleColor,
                width: "32px",
                height: "32px",
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                transition: "all 0.2s",
                flexShrink: 0,
              }}
              title={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
            >
              {isDark ? <IconSun /> : <IconMoon />}
            </button>

            {/* Admin Dashboard Link */}
            <button
              onClick={() => navigate("/admin")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 12px",
                borderRadius: "8px",
                background: "rgba(168,85,247,0.12)",
                border: "1px solid rgba(168,85,247,0.3)",
                color: "#d8b4fe",
                fontSize: "12px",
                fontWeight: 500,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              <IconDashboard size={13} />
              Dashboard Admin
            </button>
          </div>
        </header>

        {/* ── Conversation & Suggestions Area ── */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "24px 24px 10px",
            display: "flex",
            flexDirection: "column",
            gap: "14px",
            transition: "background 0.25s",
          }}
        >
          {/* Initial System Notice */}
          {messages.length > 0 && messages[0].role === "system" && (
            <SystemMessage text={messages[0].text} t={t} />
          )}

          {/* ── Center Suggestions Card (Preserved in the Center when no active messages) ── */}
          {!hasUserMessages && (
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                padding: "20px 10px",
                animation: "fade-in-up 0.4s ease both",
              }}
            >
              {/* Central Klarna Icon */}
              <div
                style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: "16px",
                  background: "linear-gradient(135deg, #FFB3C7 0%, #aa73f9 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "18px",
                  boxShadow: "0 4px 20px rgba(168,85,247,0.3)",
                }}
              >
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>

              <h2
                style={{
                  fontSize: "20px",
                  fontWeight: 700,
                  color: t.headerTitle,
                  margin: "0 0 8px 0",
                  letterSpacing: "-0.02em",
                }}
              >
                ¿En qué puedo ayudarte?
              </h2>

              <p
                style={{
                  fontSize: "13.5px",
                  color: t.headerSub,
                  maxWidth: "420px",
                  lineHeight: 1.6,
                  margin: "0 0 24px 0",
                }}
              >
                Soy tu asistente virtual de Klarna. Puedo ayudarte con lo que necesites.
              </p>

              {/* Suggestions Grid */}
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "10px",
                  justifyContent: "center",
                  maxWidth: "520px",
                }}
              >
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => handleSend(suggestion)}
                    style={{
                      padding: "9px 18px",
                      background: t.chipBg,
                      border: `1px solid ${t.chipBorder}`,
                      borderRadius: "24px",
                      fontSize: "13px",
                      color: t.chipText,
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                      textAlign: "center",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = t.chipHoverBg;
                      e.currentTarget.style.borderColor = t.chipHoverBorder;
                      e.currentTarget.style.color = t.chipHoverText;
                      e.currentTarget.style.transform = "translateY(-1px)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = t.chipBg;
                      e.currentTarget.style.borderColor = t.chipBorder;
                      e.currentTarget.style.color = t.chipText;
                      e.currentTarget.style.transform = "translateY(0)";
                    }}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Active Messages List */}
          {messages.slice(1).map((m) => {
            if (m.role === "system") return <SystemMessage key={m.id} text={m.text} t={t} />;
            if (m.role === "user") return <UserBubble key={m.id} text={m.text} t={t} />;
            if (m.role === "agent") return <AgentBubble key={m.id} text={m.text} agentName={m.agentName} t={t} />;
            return <AssistantBubble key={m.id} text={m.text} actions={m.actions} onAction={handleAction} t={t} />;
          })}

          {isTyping && <TypingIndicator t={t} />}
          <div ref={bottomRef} style={{ height: "12px" }} />
        </div>

        {/* ── Input Bar ── */}
        <div
          style={{
            background: t.inputBar,
            borderTop: `1px solid ${t.inputBarBorder}`,
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            flexShrink: 0,
            padding: "16px 24px 20px",
            transition: "background 0.25s, border-color 0.25s",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                flex: 1,
                background: t.inputField,
                border: `1px solid ${t.inputBorder}`,
                borderRadius: "14px",
                display: "flex",
                alignItems: "center",
                padding: "0 16px",
                transition: "border-color 0.15s, background 0.25s",
              }}
              onFocusCapture={(e) => (e.currentTarget.style.borderColor = t.inputFocusBorder)}
              onBlurCapture={(e) => (e.currentTarget.style.borderColor = t.inputBorder)}
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                placeholder="Escribe tu mensaje a Klarna..."
                style={{
                  flex: 1,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  color: t.inputText,
                  fontSize: "14px",
                  padding: "13px 0",
                  caretColor: t.caretColor,
                  fontFamily: "'Inter', sans-serif",
                }}
              />
            </div>

            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || isTyping}
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "12px",
                background: input.trim() && !isTyping ? t.sendActiveBg : t.sendInactiveBg,
                border: input.trim() && !isTyping ? "none" : `1px solid ${t.sendInactiveBorder}`,
                color: input.trim() && !isTyping ? "white" : t.sendInactiveColor,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: input.trim() && !isTyping ? "pointer" : "default",
                transition: "all 0.15s",
                flexShrink: 0,
              }}
            >
              <IconSend />
            </button>
          </div>

          <div style={{ display: "flex", justifyContent: "center", marginTop: "10px" }}>
            <button
              onClick={() => handleSend("Quiero hablar con un representante")}
              style={{
                background: "none",
                border: "none",
                color: t.representativeText,
                fontSize: "11.5px",
                cursor: "pointer",
                textDecoration: "underline",
                textDecorationColor: "rgba(165,164,176,0.4)",
                textUnderlineOffset: "3px",
                letterSpacing: "0.01em",
                fontFamily: "'Inter', sans-serif",
              }}
            >
              Prefiero hablar con un representante
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
