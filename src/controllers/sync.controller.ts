import type { Request, Response } from 'express';
import { authenticatedUserId } from '../middlewares/auth.js';
import { sendErrorResponse } from '../middlewares/errorHandler.js';
import * as syncPushService from '../services/syncPushService.js';
import * as syncService from '../services/syncService.js';
import type { SyncPushBody } from '../validators/sync.schema.js';

/** GET /sync/changes: o que mudou desde o último sync. */
export async function getSyncChangesController(req: Request, res: Response): Promise<void> {
  try {
    // O validate() já trocou a query pelo valor convertido (Date ou null).
    const since = (req.query as unknown as { since: Date | null }).since;
    const changes = await syncService.getChangesSince(authenticatedUserId(req), since);
    res.status(200).json(changes);
  } catch (error) {
    sendErrorResponse(res, error, 'Erro ao buscar as alterações para sincronizar.', 'getSyncChangesController');
  }
}

/**
 * POST /sync: aplica o lote enviado pelo aparelho (corpo já validado).
 * Responde 200 mesmo com itens recusados: o resultado de cada um vem na lista.
 */
export async function pushSyncController(req: Request, res: Response): Promise<void> {
  try {
    const result = await syncPushService.pushChanges(authenticatedUserId(req), req.body as SyncPushBody);
    res.status(200).json(result);
  } catch (error) {
    sendErrorResponse(res, error, 'Erro ao sincronizar.', 'pushSyncController');
  }
}
