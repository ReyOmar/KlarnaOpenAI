// Chat — Pantalla de usuario final (spec §7.1)
// El usuario NO ve qué modelo respondió — la complejidad del router es invisible

import { useState, useRef, useEffect } from 'react';
import { enviarMensaje } from '../services/api';
import type { MensajeResponse } from '../services/api';
import '../styles/chat.css';

interface ChatMessage {
  id: number | string;
  remitente: 'USUARIO' | 'ASISTENTE' | 'AGENTE_HUMANO';
  contenido: string;
  timestamp: string;
}

const SUGGESTIONS = [
  '¿Cuál es el estado de mi pedido?',
  '¿Puedo extender mi plazo de pago?',
  'Necesito hacer una devolución',
  '¿Cuáles son las políticas de reembolso?',
];

export default function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [conversacionId, setConversacionId] = useState<number | null>(null);
  const [isHandoff, setIsHandoff] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // User ID hardcoded for demo (user ID 1 = "Usuario Demo")
  const userId = 1;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = async (text?: string) => {
    const contenido = (text || input).trim();
    if (!contenido || isTyping) return;

    // Add user message
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      remitente: 'USUARIO',
      contenido,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const response: MensajeResponse = await enviarMensaje(
        userId,
        contenido,
        conversacionId || undefined
      );

      setConversacionId(response.conversacionId);

      const assistantMsg: ChatMessage = {
        id: response.mensaje.id,
        remitente: response.mensaje.remitente,
        contenido: response.mensaje.contenido,
        timestamp: response.mensaje.timestamp,
      };

      setMessages(prev => [...prev, assistantMsg]);

      if (response.tipo === 'handoff') {
        setIsHandoff(true);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          remitente: 'ASISTENTE',
          contenido: 'Lo siento, hubo un problema al procesar tu mensaje. Por favor intenta de nuevo.',
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleHandoffRequest = () => {
    handleSend('Quiero hablar con un representante');
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('es-MX', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="chat-container">
      {/* Header */}
      <header className="chat-header">
        <div className="chat-header-brand">
          <div className="chat-header-logo">KL</div>
          <div>
            <div className="chat-header-title">Klarna</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="chat-header-status">
            <span className="status-dot"></span>
            Asistente en línea
          </div>
          <a
            href="/admin"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '8px',
              background: 'rgba(168, 85, 247, 0.12)',
              border: '1px solid rgba(168, 85, 247, 0.3)',
              color: '#d8b4fe',
              fontSize: '12px',
              fontWeight: 500,
              textDecoration: 'none',
              transition: 'all 0.15s',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <rect x="1" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.2" />
              <rect x="9" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.2" />
              <rect x="1" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.2" />
              <rect x="9" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.2" />
            </svg>
            Admin Dashboard
          </a>
        </div>
      </header>

      {/* Messages */}
      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="chat-welcome">
            <div className="chat-welcome-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <h2>¿En qué puedo ayudarte?</h2>
            <p>Soy tu asistente virtual. Puedo ayudarte con pagos, pedidos, devoluciones y más.</p>
            <div className="chat-suggestions">
              {SUGGESTIONS.map((suggestion, i) => (
                <button
                  key={i}
                  className="chat-suggestion-chip"
                  onClick={() => handleSend(suggestion)}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`message-wrapper ${msg.remitente === 'USUARIO'
                    ? 'user'
                    : msg.remitente === 'AGENTE_HUMANO'
                      ? 'agent'
                      : 'assistant'
                  }`}
              >
                {msg.remitente !== 'USUARIO' && (
                  <div
                    className={`message-avatar ${msg.remitente === 'AGENTE_HUMANO' ? 'agent' : 'assistant'
                      }`}
                  >
                    {msg.remitente === 'AGENTE_HUMANO' ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                      </svg>
                    )}
                  </div>
                )}
                <div>
                  <div
                    className={`message-bubble ${msg.remitente === 'USUARIO'
                        ? 'user'
                        : msg.remitente === 'AGENTE_HUMANO'
                          ? 'agent'
                          : 'assistant'
                      }`}
                  >
                    {msg.remitente === 'AGENTE_HUMANO' && (
                      <div className="agent-label">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                          <circle cx="12" cy="7" r="4" />
                        </svg>
                        Agente humano
                      </div>
                    )}
                    {msg.contenido}
                  </div>
                  <div className="message-time">{formatTime(msg.timestamp)}</div>
                </div>
              </div>
            ))}

            {isHandoff && (
              <div className="handoff-banner">
                <div className="handoff-banner-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </div>
                <div className="handoff-banner-text">
                  <strong>Transferido a soporte</strong> — Un agente humano te atenderá en breve
                </div>
              </div>
            )}
          </>
        )}

        {isTyping && (
          <div className="typing-indicator">
            <div className="message-avatar assistant">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </div>
            <div className="typing-dots">
              <div className="typing-dot" />
              <div className="typing-dot" />
              <div className="typing-dot" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="chat-input-area">
        <div className="chat-input-wrapper">
          <textarea
            ref={inputRef}
            className="chat-input"
            placeholder={isHandoff ? 'Un agente te atenderá pronto...' : 'Escribe tu mensaje...'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isHandoff}
            rows={1}
          />
          <button
            className="chat-send-btn"
            onClick={() => handleSend()}
            disabled={!input.trim() || isTyping || isHandoff}
            id="chat-send-button"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
        {!isHandoff && (
          <div className="chat-handoff-link">
            <button onClick={handleHandoffRequest} id="chat-handoff-button">
              Prefiero hablar con un representante
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
