// Datos mínimos para que el sistema funcione (modelos, configuración, agentes y
// usuario demo). Se ejecuta al iniciar el servidor y desde el seed; es idempotente.
// NOTA: Los nombres "Terra" y "Luna" son decisiones de diseño de este proyecto,
// NO datos confirmados por Klarna.

import prisma from '../db/prisma';
import { obtenerConfiguracion } from './configuracion';
import { obtenerConfigIA } from './ia';

export const EMAIL_USUARIO_DEMO = 'demo@usuario.com';

// Pricing de referencia (agosto 2026) usado para simular el consumo en USD,
// independientemente del proveedor real configurado (Ollama es gratis, por ejemplo).
const MODELOS_REFERENCIA = [
  { nombre: 'Terra', nivel: 'terra', costoEntradaMusd: 2.0, costoSalidaMusd: 12.0 },
  { nombre: 'Luna', nivel: 'luna', costoEntradaMusd: 0.2, costoSalidaMusd: 1.2 },
] as const;

const AGENTES_DEMO = [
  { nombre: 'María García', email: 'maria.garcia@klarna-demo.com' },
  { nombre: 'Carlos López', email: 'carlos.lopez@klarna-demo.com' },
];

export async function asegurarDatosBase() {
  const { modelos } = obtenerConfigIA();

  // nombreApi se sincroniza con el modelo configurado para que el dashboard
  // muestre qué modelo real atiende cada nivel. El pricing no se toca.
  for (const m of MODELOS_REFERENCIA) {
    await prisma.modeloIA.upsert({
      where: { nombre: m.nombre },
      update: { nombreApi: modelos[m.nivel] },
      create: {
        nombre: m.nombre,
        nombreApi: modelos[m.nivel],
        costoEntradaMusd: m.costoEntradaMusd,
        costoSalidaMusd: m.costoSalidaMusd,
      },
    });
  }

  await obtenerConfiguracion();

  for (const agente of AGENTES_DEMO) {
    await prisma.agente.upsert({
      where: { email: agente.email },
      update: {},
      create: { ...agente, disponible: true },
    });
  }

  return obtenerUsuarioDemo();
}

export function obtenerUsuarioDemo() {
  return prisma.usuario.upsert({
    where: { email: EMAIL_USUARIO_DEMO },
    update: {},
    create: { nombre: 'Usuario Demo', email: EMAIL_USUARIO_DEMO },
  });
}
