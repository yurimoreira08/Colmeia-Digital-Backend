import { getReportsStats } from '../services/reports.service.js';

export function healthController(_: any, res: any): void {
  res.status(200).json({
    status: 'ok',
    service: 'colmeia-digital-backend',
    timestamp: new Date().toISOString(),
  });
}

export async function getReportsStatsController(req: any, res: any): Promise<void> {
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
    const message = error instanceof Error ? error.message : 'Falha ao buscar estatísticas de relatórios.';
    res.status(500).json({ message });
  }
}
