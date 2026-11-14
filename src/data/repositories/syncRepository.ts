import { prisma } from '../prisma.js';
import type { SyncEntity } from './deletedRecordRepository.js';

/**
 * Consultas auxiliares do POST /sync: versão atual de um registro (para
 * detectar conflito) e o id gerado no aparelho de apiários e caixas.
 */

/** `updated_at` atual do registro, ou `null` se ele não existe. */
export async function findUpdatedAt(entity: SyncEntity, id: number): Promise<Date | null> {
  const args = { where: { id }, select: { updated_at: true } } as const;
  const row =
    entity === 'apiaries'
      ? await prisma.apiary.findUnique(args)
      : entity === 'boxes'
        ? await prisma.box.findUnique(args)
        : entity === 'review_reports'
          ? await prisma.reviewReport.findUnique(args)
          : await prisma.manejo.findUnique(args);
  return row ? row.updated_at : null;
}

/** Apiário ou caixa já criado com este id do aparelho (reenvio do mesmo lote). */
export async function findIdByClientUuid(entity: 'apiaries' | 'boxes', clientUuid: string): Promise<number | null> {
  const args = { where: { client_uuid: clientUuid }, select: { id: true } } as const;
  const row = entity === 'apiaries' ? await prisma.apiary.findUnique(args) : await prisma.box.findUnique(args);
  return row ? row.id : null;
}

/** Grava o id do aparelho num apiário ou caixa que ainda não tem um. */
export async function setClientUuid(entity: 'apiaries' | 'boxes', id: number, clientUuid: string): Promise<void> {
  const args = { where: { id, client_uuid: null }, data: { client_uuid: clientUuid } };
  if (entity === 'apiaries') await prisma.apiary.updateMany(args);
  else await prisma.box.updateMany(args);
}
