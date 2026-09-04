// GET/PUT /api/configuracion — Configuración global del sistema

import { Router, Request, Response } from 'express';
import prisma from '../db/prisma';

const router = Router();

// GET — Obtener configuración actual
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    let config = await prisma.configuracion.findFirst();

    if (!config) {
      config = await prisma.configuracion.create({
        data: {
          presupuestoMensual: 20000,
          umbralAlerta: 2000,
        },
      });
    }

    res.json(config);
  } catch (error) {
    console.error('Error en GET /api/configuracion:', error);
    res.status(500).json({ error: 'Error al obtener configuración' });
  }
});

// PUT — Actualizar presupuesto mensual y umbral de alerta
router.put('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { presupuestoMensual, umbralAlerta } = req.body;

    const config = await prisma.configuracion.findFirst();
    if (!config) {
      res.status(404).json({ error: 'Configuración no encontrada' });
      return;
    }

    const actualizada = await prisma.configuracion.update({
      where: { id: config.id },
      data: {
        ...(presupuestoMensual !== undefined && { presupuestoMensual }),
        ...(umbralAlerta !== undefined && { umbralAlerta }),
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
