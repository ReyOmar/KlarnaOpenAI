// GET  /api/simulacion/escenarios — Parámetros base y escenarios predefinidos
// GET  /api/simulacion/comparacion — Resultados de todos los escenarios predefinidos
// POST /api/simulacion — Simula con parámetros personalizados (se combinan con el base)

import { Router, Request, Response } from 'express';
import {
  PARAMETROS_BASE,
  ESCENARIOS,
  normalizarParametros,
  simular,
  compararEscenarios,
} from '../services/simulacion';

const router = Router();

router.get('/escenarios', (_req: Request, res: Response) => {
  res.json({ base: PARAMETROS_BASE, escenarios: ESCENARIOS });
});

router.get('/comparacion', (_req: Request, res: Response) => {
  const comparacion = compararEscenarios().map(({ resultado, ...escenario }) => ({
    ...escenario,
    indicadores: resultado.indicadores,
    serie: resultado.serie.map(({ dia, saldo }) => ({ dia, saldo })),
  }));
  res.json(comparacion);
});

router.post('/', (req: Request, res: Response) => {
  let parametros;
  try {
    parametros = normalizarParametros((req.body ?? {}) as Record<string, unknown>);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Parámetros inválidos' });
    return;
  }
  res.json(simular(parametros));
});

export default router;
