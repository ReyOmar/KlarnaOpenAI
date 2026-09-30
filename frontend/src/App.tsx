import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Chat from './pages/Chat';
import './index.css';

// El dashboard (con Recharts) se carga solo al entrar a /admin
const Dashboard = lazy(() => import('./pages/Dashboard'));

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Chat />} />
        <Route
          path="/admin"
          element={
            <Suspense fallback={<div style={{ padding: 32, color: '#9c9ba8' }}>Cargando panel…</div>}>
              <Dashboard />
            </Suspense>
          }
        />
        <Route path="*" element={<Chat />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
