// Pantalla de inicio de sesión (Clerk). Se muestra cuando no hay sesión activa.

import { SignIn } from '@clerk/react';

export default function Login() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0c0c11',
        backgroundImage:
          'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '24px',
        padding: '24px 16px',
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div style={{ color: '#f0eaff', fontSize: '22px', fontWeight: 700, letterSpacing: '-0.02em' }}>
          Klarna <span style={{ color: '#FFB3C7' }}>×</span> IA
        </div>
        <div style={{ color: '#9c9ba8', fontSize: '13px', marginTop: '4px' }}>
          Inicia sesión para usar el asistente y el panel
        </div>
      </div>
      {/* routing="hash": el formulario no depende de las rutas de React Router */}
      <SignIn routing="hash" />
    </div>
  );
}
