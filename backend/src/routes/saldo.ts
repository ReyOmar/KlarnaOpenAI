// GET /api/saldo — Saldo actual C(t), recarga R, consumo U(t) y proyección
// GET /api/saldo/historial?dias=30 — Serie temporal para gráfico

import { Router, Request, Response } from 'express';
import prisma from '../db/prisma';
import { calcularRecargaDiaria, calcularDiasHastaAgotamiento } from '../services/saldo';

const router = Router();

// GET /api/saldo — Resumen actual
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const config = await prisma.configuracion.findFirst();
    const recargaDiaria = calcularRecargaDiaria(config?.presupuestoMensual || 20000);

    // Obtener saldo más reciente
    const saldoReciente = await prisma.saldoDiario.findFirst({
      orderBy: { fecha: 'desc' },
    });

    if (!saldoReciente) {
      res.json({
        saldoActual: 10000,
        recargaDiaria,
        consumoDiario: 0,
        diasHastaAgotamiento: Infinity,
        presupuestoMensual: config?.presupuestoMensual || 20000,
      });
      return;
    }

    // Calcular consumo promedio de los últimos 7 días
    const hace7Dias = new Date();
    hace7Dias.setDate(hace7Dias.getDate() - 7);

    const saldos7Dias = await prisma.saldoDiario.findMany({
      where: { fecha: { gte: hace7Dias } },
      orderBy: { fecha: 'desc' },
    });

    const consumoPromedio = saldos7Dias.length > 0
      ? saldos7Dias.reduce((sum, s) => sum + s.consumoU, 0) / saldos7Dias.length
      : 0;

    const diasHastaAgotamiento = calcularDiasHastaAgotamiento(
      saldoReciente.saldoCt,
      consumoPromedio,
      recargaDiaria
    );

    res.json({
      saldoActual: saldoReciente.saldoCt,
      recargaDiaria,
      consumoDiario: saldoReciente.consumoU,
      consumoPromedio7d: consumoPromedio,
      diasHastaAgotamiento: diasHastaAgotamiento === Infinity ? '∞' : diasHastaAgotamiento,
      presupuestoMensual: config?.presupuestoMensual || 20000,
      fecha: saldoReciente.fecha,
    });
  } catch (error) {
    console.error('Error en GET /api/saldo:', error);
    res.status(500).json({ error: 'Error al obtener saldo' });
  }
});

// GET /api/saldo/historial?dias=30 — Serie temporal
router.get('/historial', async (req: Request, res: Response): Promise<void> => {
  try {
    const dias = parseInt(req.query.dias as string) || 30;
    const desde = new Date();
    desde.setDate(desde.getDate() - dias);

    const historial = await prisma.saldoDiario.findMany({
      where: { fecha: { gte: desde } },
      orderBy: { fecha: 'asc' },
      select: {
        fecha: true,
        saldoCt: true,
        recargaR: true,
        consumoU: true,
      },
    });

    res.json(historial);
  } catch (error) {
    console.error('Error en GET /api/saldo/historial:', error);
    res.status(500).json({ error: 'Error al obtener historial' });
  }
});

export default router;
