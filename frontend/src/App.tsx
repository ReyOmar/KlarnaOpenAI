import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ClerkLoading, Show, useAuth } from '@clerk/react';
import Chat from './pages/Chat';
import Login from './pages/Login';
import { configurarToken } from './services/api';
import './index.css';

// El dashboard (con Recharts) se carga solo al entrar a /admin
const Dashboard = lazy(() => import('./pages/Dashboard'));

const cargando = (texto: string) => (
  <div style={{ padding: 32, color: '#9c9ba8', fontFamily: "'Inter', system-ui, sans-serif" }}>{texto}</div>
);

// Entrega al cliente de la API la función que obtiene el token de sesión de Clerk
function TokenDeSesion() {
  const { getToken } = useAuth();
  useEffect(() => {
    configurarToken(() => getToken());
  }, [getToken]);
  return null;
}

function App() {
  return (
    <>
      <ClerkLoading>{cargando('Cargando…')}</ClerkLoading>

      {/* Toda la app requiere iniciar sesión */}
      <Show when="signed-out">
        <Login />
      </Show>

      <Show when="signed-in">
        <TokenDeSesion />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Chat />} />
            <Route
              path="/admin"
              element={<Suspense fallback={cargando('Cargando panel…')}><Dashboard /></Suspense>}
            />
            <Route path="*" element={<Chat />} />
          </Routes>
        </BrowserRouter>
      </Show>
    </>
  );
}

export default App;
