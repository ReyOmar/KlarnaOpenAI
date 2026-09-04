// GET /api/alertas — Alertas activas e históricas

import { Router, Request, Response } from 'express';
import prisma from '../db/prisma';

const router = Router();

router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const alertas = await prisma.alerta.findMany({
      orderBy: { fecha: 'desc' },
      take: 50,
      include: {
        saldo: {
          select: {
            fecha: true,
            saldoCt: true,
          },
        },
      },
    });

    res.json(alertas);
  } catch (error) {
    console.error('Error en GET /api/alertas:', error);
    res.status(500).json({ error: 'Error al obtener alertas' });
  }
});

export default router;
