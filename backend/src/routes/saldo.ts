// GET /api/saldo — Saldo actual C(t), recarga R, consumo U(t) y proyección
// GET /api/saldo/historial?dias=30 — Serie temporal para gráfico

import { Router, Request, Response } from 'express';
import prisma from '../db/prisma';
import {
  calcularRecargaDiaria,
  calcularDiasHastaAgotamiento,
  inicioDiaUTC,
  sumarDias,
} from '../services/saldo';
import { asegurarSaldoDeHoy } from '../services/saldoDiario';
import { obtenerConfiguracion } from '../services/configuracion';

const router = Router();

// GET /api/saldo — Resumen actual
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const config = await obtenerConfiguracion();
    const recargaDiaria = calcularRecargaDiaria(config.presupuestoMensual);

    // Avanza el modelo hasta hoy (aplica R en los días sin actividad)
    const saldoHoy = await asegurarSaldoDeHoy(recargaDiaria);

    // Consumo promedio de los últimos 7 días (incluye hoy)
    const saldos7Dias = await prisma.saldoDiario.findMany({
      where: { fecha: { gte: sumarDias(inicioDiaUTC(), -6) } },
    });

    const consumoPromedio = saldos7Dias.length > 0
      ? saldos7Dias.reduce((sum, s) => sum + s.consumoU, 0) / saldos7Dias.length
      : 0;

    const diasHastaAgotamiento = calcularDiasHastaAgotamiento(
      saldoHoy.saldoCt,
      consumoPromedio,
      recargaDiaria
    );

    res.json({
      saldoActual: saldoHoy.saldoCt,
      recargaDiaria,
      consumoDiario: saldoHoy.consumoU,
      consumoPromedio7d: consumoPromedio,
      diasHastaAgotamiento: diasHastaAgotamiento === Infinity ? '∞' : diasHastaAgotamiento,
      presupuestoMensual: config.presupuestoMensual,
      umbralAlerta: config.umbralAlerta,
      fecha: saldoHoy.fecha,
    });
  } catch (error) {
    console.error('Error en GET /api/saldo:', error);
    res.status(500).json({ error: 'Error al obtener saldo' });
  }
});

// GET /api/saldo/historial?dias=30 — Serie temporal
router.get('/historial', async (req: Request, res: Response): Promise<void> => {
  try {
    const diasSolicitados = parseInt(String(req.query.dias ?? ''), 10);
    const dias = Number.isFinite(diasSolicitados) ? Math.min(Math.max(diasSolicitados, 1), 365) : 30;

    const historial = await prisma.saldoDiario.findMany({
      where: { fecha: { gte: sumarDias(inicioDiaUTC(), -(dias - 1)) } },
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
