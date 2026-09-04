// GET /api/handoffs — Historial de handoffs con motivo y agente

import { Router, Request, Response } from 'express';
import prisma from '../db/prisma';

const router = Router();

router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const handoffs = await prisma.handoff.findMany({
      orderBy: { fecha: 'desc' },
      take: 50,
      include: {
        agente: {
          select: {
            nombre: true,
            email: true,
          },
        },
        conversacion: {
          select: {
            id: true,
            usuario: {
              select: {
                nombre: true,
              },
            },
          },
        },
      },
    });

    res.json(handoffs);
  } catch (error) {
    console.error('Error en GET /api/handoffs:', error);
    res.status(500).json({ error: 'Error al obtener handoffs' });
  }
});

export default router;
