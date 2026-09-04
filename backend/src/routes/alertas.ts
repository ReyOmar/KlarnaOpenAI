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

router.patch('/:id/resolver', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    const alerta = await prisma.alerta.update({
      where: { id },
      data: { estado: 'RESUELTA' },
    });
    res.json(alerta);
  } catch (error) {
    console.error('Error al resolver alerta:', error);
    res.status(500).json({ error: 'Error al resolver la alerta' });
  }
});

export default router;
