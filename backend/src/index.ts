// Entry point — Express server
// Prompt Maestro: Chat con Enrutamiento de IA + Sistema de Alertas

import 'dotenv/config';
import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';

import prisma from './db/prisma';
import { clerk, clerkConfigurado, requiereAdmin, requiereSesion } from './middleware/auth';
import mensajesRouter from './routes/mensajes';
import saldoRouter from './routes/saldo';
import alertasRouter from './routes/alertas';
import handoffsRouter from './routes/handoffs';
import modelosRouter from './routes/modelos';
import configuracionRouter from './routes/configuracion';
import simulacionRouter from './routes/simulacion';
import { asegurarDatosBase } from './services/datosBase';
import { infoIA } from './services/ia';

const app = express();
const PORT = Number(process.env.PORT) || 3001;

// Middleware
// CORS_ORIGIN permite restringir el origen si el frontend se despliega aparte
// (ej: "https://mi-front.vercel.app"). Sin definir, se aceptan todos (modo pruebas).
app.use(cors(process.env.CORS_ORIGIN ? { origin: process.env.CORS_ORIGIN.split(',') } : undefined));
app.use(express.json({ limit: '100kb' }));

// Health check (público, lo usa Render): estado del servidor, la base de datos, el proveedor
// de IA y el login. Va antes de Clerk para que no dependa de que sus llaves estén configuradas.
app.get('/api/health', async (_req, res) => {
  let baseDatos = true;
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    baseDatos = false;
  }

  res.status(baseDatos ? 200 : 503).json({
    status: baseDatos ? 'ok' : 'degradado',
    baseDatos,
    ia: infoIA(),
    login: clerkConfigurado() ? 'ok' : 'faltan CLERK_PUBLISHABLE_KEY / CLERK_SECRET_KEY',
    timestamp: new Date().toISOString(),
  });
});

// Clerk solo en /api: los archivos del frontend se sirven sin pasar por la autenticación
app.use('/api', clerk);

// API Routes — el chat es para cualquier usuario con sesión (cliente);
// las rutas del panel requieren el rol admin
app.use('/api/mensajes', requiereSesion, mensajesRouter);
app.use('/api/saldo', requiereAdmin, saldoRouter);
app.use('/api/alertas', requiereAdmin, alertasRouter);
app.use('/api/handoffs', requiereAdmin, handoffsRouter);
app.use('/api/modelos', requiereAdmin, modelosRouter);
app.use('/api/configuracion', requiereAdmin, configuracionRouter);
app.use('/api/simulacion', requiereAdmin, simulacionRouter);

// Rutas /api inexistentes → 404 en JSON
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Endpoint no encontrado' });
});

// Servir el frontend compilado (npm run build en la raíz) desde el mismo servidor.
// En desarrollo se usa el servidor de Vite (puerto 5173) con proxy a /api.
const frontendDist = path.join(__dirname, '../../frontend/dist');
if (fs.existsSync(path.join(frontendDist, 'index.html'))) {
  app.use(express.static(frontendDist));
  // Express 5 no acepta '*': se usa una regex para el fallback de la SPA
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// Manejador de errores (JSON inválido, errores no controlados)
app.use((err: Error & { status?: number; type?: string }, _req: Request, res: Response, _next: NextFunction) => {
  if (err.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'JSON inválido en el cuerpo de la petición' });
    return;
  }
  console.error('Error no controlado:', err);
  res.status(err.status || 500).json({ error: 'Error interno del servidor' });
});

async function iniciar() {
  try {
    await asegurarDatosBase();
  } catch (error) {
    console.error('⚠️  No se pudo preparar la base de datos. ¿Está PostgreSQL activo y DATABASE_URL bien configurada?');
    console.error(error instanceof Error ? error.message : error);
  }

  const ia = infoIA();
  const servidor = app.listen(PORT, () => {
    console.log(`\n🚀 Prompt Maestro — Backend corriendo en http://localhost:${PORT}`);
    console.log(`   API: http://localhost:${PORT}/api/health`);
    console.log(`   IA: ${ia.proveedor} (Terra: ${ia.modelos.terra}, Luna: ${ia.modelos.luna})`);
    if (ia.advertencia) console.warn(`   ⚠️  ${ia.advertencia}`);
    if (!clerkConfigurado()) {
      console.warn('   ⚠️  Faltan CLERK_PUBLISHABLE_KEY y/o CLERK_SECRET_KEY: el login y la API no funcionarán.');
    }
    console.log('');
  });

  servidor.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`❌ El puerto ${PORT} ya está en uso. Cierra el otro proceso o cambia PORT en .env.`);
    } else {
      console.error('❌ Error del servidor:', error);
    }
    process.exit(1);
  });

  const cerrar = () => {
    servidor.close(() => {
      prisma.$disconnect().finally(() => process.exit(0));
    });
  };
  process.on('SIGINT', cerrar);
  process.on('SIGTERM', cerrar);
}

iniciar();
