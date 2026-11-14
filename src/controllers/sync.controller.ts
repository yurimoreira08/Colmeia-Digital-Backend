import { sendErrorResponse } from '../middlewares/errorHandler.js';
import * as syncPushService from '../services/syncPushService.js';
import * as syncService from '../services/syncService.js';

/** GET /sync/changes: o que mudou desde o último sync (query já validada). */
export async function getSyncChangesController(req: any, res: any): Promise<void> {
  try {
    if (!req.userId) {
      res.status(401).json({ message: 'Não autorizado. Usuário não identificado.' });
      return;
    }
    const changes = await syncService.getChangesSince(req.userId, req.query.since);
    res.status(200).json(changes);
  } catch (error) {
    sendErrorResponse(res, error, 'Erro ao buscar as alterações para sincronizar.', 'getSyncChangesController');
  }
}

/**
 * POST /sync: aplica o lote enviado pelo aparelho (corpo já validado).
 * Responde 200 mesmo com itens recusados: o resultado de cada um vem na lista.
 */
export async function pushSyncController(req: any, res: any): Promise<void> {
  try {
    if (!req.userId) {
      res.status(401).json({ message: 'Não autorizado. Usuário não identificado.' });
      return;
    }
    const result = await syncPushService.pushChanges(req.userId, req.body);
    res.status(200).json(result);
  } catch (error) {
    sendErrorResponse(res, error, 'Erro ao sincronizar.', 'pushSyncController');
  }
}
