// Entry point — Express server
// Prompt Maestro: Chat con Enrutamiento de IA + Sistema de Alertas

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';

import mensajesRouter from './routes/mensajes';
import saldoRouter from './routes/saldo';
import alertasRouter from './routes/alertas';
import handoffsRouter from './routes/handoffs';
import modelosRouter from './routes/modelos';
import configuracionRouter from './routes/configuracion';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/mensajes', mensajesRouter);
app.use('/api/saldo', saldoRouter);
app.use('/api/alertas', alertasRouter);
app.use('/api/handoffs', handoffsRouter);
app.use('/api/modelos', modelosRouter);
app.use('/api/configuracion', configuracionRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../../frontend/dist')));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, '../../frontend/dist/index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`\n🚀 Prompt Maestro — Backend corriendo en http://localhost:${PORT}`);
  console.log(`   API: http://localhost:${PORT}/api/health\n`);
});
