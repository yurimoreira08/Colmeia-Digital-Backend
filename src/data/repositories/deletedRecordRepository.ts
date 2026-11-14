import type { Prisma } from '@prisma/client';
import { prisma } from '../prisma.js';

/** Tabelas sincronizadas com o app, com o mesmo nome das tabelas do SQLite do aparelho. */
export type SyncEntity = 'apiaries' | 'boxes' | 'review_reports' | 'manejos';

export interface DeletedRecordInfo {
  entity: SyncEntity;
  id: number;
  deletedAt: string;
}

/**
 * Registra exclusões feitas no servidor (tombstones), para o pull
 * incremental avisar os outros aparelhos. Chame dentro da mesma transação
 * da exclusão: se ela falhar, o registro também é desfeito.
 */
export async function recordDeletions(
  tx: Prisma.TransactionClient,
  userId: number,
  entity: SyncEntity,
  recordIds: number[],
): Promise<void> {
  for (const recordId of recordIds) {
    await tx.deletedRecord.create({ data: { user_id: userId, entity, record_id: recordId } });
  }
}

/** Exclusões do usuário depois de `since` (todas, se `since` for nulo). */
export async function findDeletionsSince(userId: number, since: Date | null): Promise<DeletedRecordInfo[]> {
  const rows = await prisma.deletedRecord.findMany({
    where: { user_id: userId, ...(since ? { deleted_at: { gt: since } } : {}) },
    orderBy: { deleted_at: 'asc' },
  });
  return rows.map((row) => ({
    entity: row.entity as SyncEntity,
    id: row.record_id,
    deletedAt: row.deleted_at.toISOString(),
  }));
}
