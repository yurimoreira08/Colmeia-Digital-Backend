import type { Request, Response } from 'express';
import { getReportsStats } from '../services/reports.service.js';
import { sendErrorResponse } from '../middlewares/errorHandler.js';

export function healthController(_req: Request, res: Response): void {
  res.status(200).json({
    status: 'ok',
    service: 'colmeia-digital-backend',
    timestamp: new Date().toISOString(),
  });
}

/**
 * Devolve o IP do cliente como a API o enxerga (`req.ip`).
 * Serve para conferir o TRUST_PROXY em produção: se o valor não for o IP
 * público de quem chamou, o rate limit está tratando clientes diferentes
 * como um só. Só expõe o IP do próprio chamador.
 */
export function clientIpController(req: Request, res: Response): void {
  res.status(200).json({ ip: req.ip });
}

export async function getReportsStatsController(req: Request, res: Response): Promise<void> {
  const { fromIso, toIso, searchTerm, chartFilter } = req.body;

  if (!fromIso || !toIso || !chartFilter) {
    res.status(400).json({
      message: 'Campos fromIso, toIso e chartFilter são obrigatórios.',
    });
    return;
  }

  try {
    const stats = await getReportsStats(
      {
        fromIso,
        toIso,
        searchTerm,
        chartFilter,
      },
      req.userId
    );
    res.status(200).json(stats);
  } catch (error) {
    sendErrorResponse(res, error, 'Falha ao buscar estatísticas de relatórios.', 'getReportsStatsController');
  }
}
