import { listApiaries } from '../data/repositories/apiaryRepository.js';
import { listBoxes } from '../data/repositories/boxRepository.js';
import { findDeletionsSince, type DeletedRecordInfo } from '../data/repositories/deletedRecordRepository.js';
import { listManejos } from '../data/repositories/manejoRepository.js';
import { listRecentNotifications, type NotificationRecord } from '../data/repositories/notificationsRepository.js';
import { listReviewReports } from '../data/repositories/reviewReportRepository.js';
import type { Apiary, Box, ManejoReport, ReviewReport } from '../types/mobile-models.js';

/**
 * Margem ao buscar "o que mudou desde o último sync": uma gravação que
 * começou antes do `serverTime` da resposta anterior e terminou depois
 * poderia ficar de fora. Repetir alguns registros é inofensivo (o app
 * substitui pelo id), perder um não é.
 */
export const PULL_OVERLAP_MS = 2 * 60 * 1000;

export interface SyncChanges {
  /** Guarde e envie como `since` no próximo pull. */
  serverTime: string;
  /** `true` quando não veio `since`: a resposta tem tudo, e não só o que mudou. */
  full: boolean;
  apiaries: Apiary[];
  boxes: Box[];
  revisions: ReviewReport[];
  manejos: ManejoReport[];
  /** As 50 mais recentes, sempre (a tabela não tem updated_at). */
  notifications: NotificationRecord[];
  /** Exclusões feitas no servidor desde `since`. Vazio no pull completo. */
  deletions: DeletedRecordInfo[];
}

/**
 * O que mudou no servidor para o usuário desde `since` (pull incremental).
 * Sem `since`, devolve tudo, no mesmo formato das rotas de listagem.
 * Arquivados vêm junto: o app guarda e mostra os dois.
 */
export async function getChangesSince(userId: number, since: Date | null): Promise<SyncChanges> {
  // Antes das consultas: o que for gravado durante elas entra no próximo pull.
  const serverTime = new Date();
  const updatedSince = since ? new Date(since.getTime() - PULL_OVERLAP_MS) : undefined;

  const [apiaries, boxes, revisions, manejos, notifications, deletions] = await Promise.all([
    listApiaries(userId, { updatedSince }),
    listBoxes({ showAll: true, updatedSince }, userId),
    listReviewReports({ tipo: 'apiario', includeArchived: true, updatedSince }, userId),
    listManejos({ tipo: 'apiario', includeArchived: true, updatedSince }, userId),
    listRecentNotifications(userId, 50),
    updatedSince ? findDeletionsSince(userId, updatedSince) : Promise.resolve([]),
  ]);

  return { serverTime: serverTime.toISOString(), full: !since, apiaries, boxes, revisions, manejos, notifications, deletions };
}
