// GET/PUT /api/configuracion — Configuración global del sistema

import { Router, Request, Response } from 'express';
import prisma from '../db/prisma';
import { obtenerConfiguracion } from '../services/configuracion';

const router = Router();

const MAX_MONTO_USD = 10_000_000;

function esMontoValido(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isFinite(valor) && valor >= 0 && valor <= MAX_MONTO_USD;
}

// GET — Obtener configuración actual
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    res.json(await obtenerConfiguracion());
  } catch (error) {
    console.error('Error en GET /api/configuracion:', error);
    res.status(500).json({ error: 'Error al obtener configuración' });
  }
});

// PUT — Actualizar presupuesto mensual y umbral de alerta
router.put('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { presupuestoMensual, umbralAlerta } = (req.body ?? {}) as Record<string, unknown>;

    if (presupuestoMensual === undefined && umbralAlerta === undefined) {
      res.status(400).json({ error: 'Envía presupuestoMensual y/o umbralAlerta' });
      return;
    }
    if (presupuestoMensual !== undefined && !esMontoValido(presupuestoMensual)) {
      res.status(400).json({ error: 'presupuestoMensual debe ser un número entre 0 y 10.000.000' });
      return;
    }
    if (umbralAlerta !== undefined && !esMontoValido(umbralAlerta)) {
      res.status(400).json({ error: 'umbralAlerta debe ser un número entre 0 y 10.000.000' });
      return;
    }

    const config = await obtenerConfiguracion();
    const actualizada = await prisma.configuracion.update({
      where: { id: config.id },
      data: {
        presupuestoMensual: presupuestoMensual as number | undefined,
        umbralAlerta: umbralAlerta as number | undefined,
        fechaActualizacion: new Date(),
      },
    });

    res.json(actualizada);
  } catch (error) {
    console.error('Error en PUT /api/configuracion:', error);
    res.status(500).json({ error: 'Error al actualizar configuración' });
  }
});

export default router;
