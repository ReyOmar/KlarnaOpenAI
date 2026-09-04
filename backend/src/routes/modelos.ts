// GET /api/modelos/distribucion — % de consultas y costo acumulado por modelo

import { Router, Request, Response } from 'express';
import prisma from '../db/prisma';

const router = Router();

router.get('/distribucion', async (_req: Request, res: Response): Promise<void> => {
  try {
    const modelos = await prisma.modeloIA.findMany();

    const distribucion = await Promise.all(
      modelos.map(async (modelo) => {
        const consumos = await prisma.consumoAPI.aggregate({
          where: { idModelo: modelo.id },
          _count: true,
          _sum: {
            costoUsd: true,
            tokensEntrada: true,
            tokensSalida: true,
          },
        });

        return {
          id: modelo.id,
          nombre: modelo.nombre,
          nombreApi: modelo.nombreApi,
          consultas: consumos._count,
          costoTotal: consumos._sum.costoUsd || 0,
          tokensEntradaTotal: consumos._sum.tokensEntrada || 0,
          tokensSalidaTotal: consumos._sum.tokensSalida || 0,
        };
      })
    );

    const totalConsultas = distribucion.reduce((sum, d) => sum + d.consultas, 0);
    const totalCosto = distribucion.reduce((sum, d) => sum + d.costoTotal, 0);

    res.json({
      modelos: distribucion.map(d => ({
        ...d,
        porcentajeConsultas: totalConsultas > 0 ? ((d.consultas / totalConsultas) * 100).toFixed(1) : '0',
        porcentajeCosto: totalCosto > 0 ? ((d.costoTotal / totalCosto) * 100).toFixed(1) : '0',
      })),
      totalConsultas,
      totalCosto,
    });
  } catch (error) {
    console.error('Error en GET /api/modelos/distribucion:', error);
    res.status(500).json({ error: 'Error al obtener distribución de modelos' });
  }
});

export default router;
