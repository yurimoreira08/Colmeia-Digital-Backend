import { getApiaryById } from '../data/repositories/apiaryRepository.js';
import { getBoxById } from '../data/repositories/boxRepository.js';
import type { SyncEntity } from '../data/repositories/deletedRecordRepository.js';
import { findManejoById } from '../data/repositories/manejoRepository.js';
import { findApiaryOwnerId, findBoxOwnership, findFieldRecordOwnerId } from '../data/repositories/ownershipRepository.js';
import { findReviewReportById } from '../data/repositories/reviewReportRepository.js';
import { findIdByClientUuid, findUpdatedAt, setClientUuid } from '../data/repositories/syncRepository.js';
import { AppError } from '../errors/AppError.js';
import type { SyncPushBody } from '../validators/sync.schema.js';
import * as apiaryService from './apiaryService.js';
import * as boxService from './boxService.js';
import * as manejoService from './manejoService.js';
import * as reviewReportService from './reviewReportService.js';

/**
 * - `created`/`updated`: gravado; `id` é o id no servidor.
 * - `conflict`: o registro mudou no servidor depois que o aparelho o baixou.
 *   Nada foi gravado; `server` traz a versão atual, que prevalece.
 * - `rejected`: não gravado e reenviar não resolve (não encontrado, de outro
 *   usuário, pai não enviado, dado inválido). `message` explica.
 * - `error`: falha inesperada; o aparelho pode tentar de novo depois.
 */
export type SyncItemStatus = 'created' | 'updated' | 'conflict' | 'rejected' | 'error';

export interface SyncItemResult {
  localId: number;
  status: SyncItemStatus;
  id?: number;
  message?: string;
  server?: unknown;
}

export interface SyncDeletionResult {
  entity: SyncEntity;
  id: number;
  status: 'deleted' | 'rejected' | 'error';
  message?: string;
}

export interface SyncPushResult {
  serverTime: string;
  deletions: SyncDeletionResult[];
  apiaries: SyncItemResult[];
  boxes: SyncItemResult[];
  revisions: SyncItemResult[];
  manejos: SyncItemResult[];
}

/** Recusa que encerra só o item atual (não o lote). */
class ItemRejected extends Error {}

const NOT_FOUND = 'Registro não encontrado no servidor.';
const FORBIDDEN = 'Este registro pertence a outro usuário.';
const PARENT_MISSING = 'O registro pai não foi enviado ou foi recusado.';

/** Confere o dono; `null` = não existe. */
function assertOwner(ownerId: number | null, userId: number): void {
  if (ownerId === null) throw new ItemRejected(NOT_FOUND);
  if (ownerId !== userId) throw new ItemRejected(FORBIDDEN);
}

/**
 * Houve alteração no servidor depois que o aparelho baixou o registro?
 * Sem `baseUpdatedAt` (versões antigas do app) não há como saber: a
 * alteração do aparelho é aplicada, como nas rotas antigas.
 */
async function hasConflict(entity: SyncEntity, id: number, baseUpdatedAt?: Date): Promise<boolean> {
  if (!baseUpdatedAt) return false;
  const current = await findUpdatedAt(entity, id);
  return current !== null && current.getTime() > baseUpdatedAt.getTime();
}

/** Resolve a referência a um pai: id do servidor (positivo) ou item deste lote (negativo). */
function resolveReference(reference: number, createdInBatch: Map<number, number>): number {
  if (reference > 0) return reference;
  const id = createdInBatch.get(reference);
  if (id === undefined) throw new ItemRejected(PARENT_MISSING);
  return id;
}

/** Executa um item isolando a falha: um item recusado não impede os outros. */
async function runItem(localId: number, context: string, work: () => Promise<Omit<SyncItemResult, 'localId'>>): Promise<SyncItemResult> {
  try {
    return { localId, ...(await work()) };
  } catch (error) {
    if (error instanceof ItemRejected) return { localId, status: 'rejected', message: error.message };
    if (error instanceof AppError) return { localId, status: 'rejected', message: error.message };
    console.error(`[sync] Falha inesperada em ${context}:`, error);
    return { localId, status: 'error', message: 'Falha ao gravar este registro. Ele será reenviado.' };
  }
}

/** Cria (ou reencontra, no reenvio) um apiário ou caixa pelo id gerado no aparelho. */
async function existingByClientUuid(entity: 'apiaries' | 'boxes', clientUuid: string | undefined, userId: number): Promise<number | null> {
  if (!clientUuid) return null;
  const id = await findIdByClientUuid(entity, clientUuid);
  if (id === null) return null;
  const owner = entity === 'apiaries' ? await findApiaryOwnerId(id) : (await findBoxOwnership(id))?.ownerId ?? null;
  assertOwner(owner, userId);
  return id;
}

/**
 * Aplica no servidor o lote enviado pelo aparelho (POST /sync).
 *
 * Ordem: exclusões, apiários, caixas, revisões e manejos, para que os pais
 * criados no lote existam quando os filhos chegarem. Cada item é gravado
 * pelos mesmos services das rotas antigas (mesmas regras e deduplicação) e
 * a posse é conferida como nos middlewares de authorize.ts.
 */
export async function pushChanges(userId: number, body: SyncPushBody): Promise<SyncPushResult> {
  const apiaryIds = new Map<number, number>();
  const boxIds = new Map<number, number>();
  const revisionIds = new Map<number, number>();

  const deletions: SyncDeletionResult[] = [];
  for (const deletion of body.deletions) {
    deletions.push(await deleteItem(userId, deletion.entity, deletion.id));
  }

  const apiaries: SyncItemResult[] = [];
  for (const item of body.apiaries) {
    const result = await runItem(item.localId, 'apiário', async () => {
      const fields = { name: item.name, location: item.location, boxCount: item.boxCount, description: item.description };
      if (item.id) {
        assertOwner(await findApiaryOwnerId(item.id), userId);
        if (await hasConflict('apiaries', item.id, item.baseUpdatedAt)) {
          return { status: 'conflict', id: item.id, server: await getApiaryById(item.id, userId) };
        }
        const saved = await apiaryService.saveApiary({ id: item.id, ...fields }, userId);
        return { status: 'updated', id: saved.id };
      }
      const existingId = await existingByClientUuid('apiaries', item.clientUuid, userId);
      if (existingId !== null) return { status: 'created', id: existingId };
      const created = await apiaryService.saveApiary(fields, userId);
      if (item.clientUuid) await setClientUuid('apiaries', created.id, item.clientUuid);
      return { status: 'created', id: created.id };
    });
    if (result.id && (result.status === 'created' || result.status === 'updated')) apiaryIds.set(item.localId, result.id);
    apiaries.push(result);
  }

  const boxes: SyncItemResult[] = [];
  for (const item of body.boxes) {
    const result = await runItem(item.localId, 'caixa', async () => {
      if (item.id) {
        assertOwner((await findBoxOwnership(item.id))?.ownerId ?? null, userId);
        if (await hasConflict('boxes', item.id, item.baseUpdatedAt)) {
          return { status: 'conflict', id: item.id, server: await getBoxById(item.id, userId) };
        }
        await boxService.renameRegisteredBox(item.id, item.name, userId);
        await (item.archived ? boxService.archiveBox(item.id, userId) : boxService.unarchiveBox(item.id, userId));
        return { status: 'updated', id: item.id };
      }
      const apiaryId = resolveReference(item.apiaryId, apiaryIds);
      assertOwner(await findApiaryOwnerId(apiaryId), userId);
      const existingId = await existingByClientUuid('boxes', item.clientUuid, userId);
      if (existingId !== null) return { status: 'created', id: existingId };
      const created = await boxService.createRegisteredBox({ apiaryId, name: item.name, position: item.position }, userId);
      if (item.clientUuid) await setClientUuid('boxes', created.id, item.clientUuid);
      if (item.archived) await boxService.archiveBox(created.id, userId);
      return { status: 'created', id: created.id };
    });
    if (result.id && (result.status === 'created' || result.status === 'updated')) boxIds.set(item.localId, result.id);
    boxes.push(result);
  }

  /** Caixa do registro: do usuário e, se o apiário veio, do mesmo apiário (achado S19). */
  async function resolveRecordTarget(item: { caixaId: number; apiaryId: number | null }) {
    const caixaId = resolveReference(item.caixaId, boxIds);
    const box = await findBoxOwnership(caixaId);
    assertOwner(box?.ownerId ?? null, userId);
    const apiaryId = item.apiaryId === null ? null : resolveReference(item.apiaryId, apiaryIds);
    if (apiaryId !== null && apiaryId !== box!.apiaryId) throw new ItemRejected('A caixa informada não pertence a este apiário.');
    return { caixaId, apiaryId };
  }

  const revisions: SyncItemResult[] = [];
  for (const item of body.revisions) {
    const result = await runItem(item.localId, 'revisão', async () => {
      const notes = { checkedOptions: item.checkedOptions, observacoes: item.observacoes, indicacoes: item.indicacoes };
      if (item.id) {
        assertOwner(await findFieldRecordOwnerId('revision', item.id), userId);
        if (await hasConflict('review_reports', item.id, item.baseUpdatedAt)) {
          return { status: 'conflict', id: item.id, server: await findReviewReportById(item.id) };
        }
        await reviewReportService.updateRevision(item.id, notes, userId);
        await (item.archived ? reviewReportService.archiveRevision(item.id, userId) : reviewReportService.unarchiveRevision(item.id, userId));
        return { status: 'updated', id: item.id };
      }
      const target = await resolveRecordTarget(item);
      const saved = await reviewReportService.saveRevision(
        { clientUuid: item.clientUuid, ...target, caixaName: item.caixaName, apiaryName: item.apiaryName, tipo: 'apiario', ...notes },
        userId,
      );
      // Reenvio com o mesmo client_uuid devolve o registro já gravado: confere que é deste usuário.
      assertOwner(await findFieldRecordOwnerId('revision', saved.id), userId);
      if (item.archived) await reviewReportService.archiveRevision(saved.id, userId);
      return { status: 'created', id: saved.id };
    });
    if (result.id && (result.status === 'created' || result.status === 'updated')) revisionIds.set(item.localId, result.id);
    revisions.push(result);
  }

  const manejos: SyncItemResult[] = [];
  for (const item of body.manejos) {
    manejos.push(
      await runItem(item.localId, 'manejo', async () => {
        const notes = { checkedOptions: item.checkedOptions, observacoes: item.observacoes, indicacoes: item.indicacoes, photoUri: item.photoUri };
        if (item.id) {
          assertOwner(await findFieldRecordOwnerId('manejo', item.id), userId);
          if (await hasConflict('manejos', item.id, item.baseUpdatedAt)) {
            return { status: 'conflict', id: item.id, server: await findManejoById(item.id) };
          }
          await manejoService.updateManejoService(item.id, notes, userId);
          await (item.archived ? manejoService.archiveManejo(item.id, userId) : manejoService.unarchiveManejo(item.id, userId));
          return { status: 'updated', id: item.id };
        }
        const target = await resolveRecordTarget(item);
        // Revisão de origem que não foi gravada: o manejo fica, sem o vínculo.
        const revisaoId = item.revisaoId === undefined ? undefined : item.revisaoId > 0 ? item.revisaoId : revisionIds.get(item.revisaoId);
        const saved = await manejoService.saveManejoService(
          { clientUuid: item.clientUuid, ...target, caixaName: item.caixaName, apiaryName: item.apiaryName, tipo: 'apiario', revisaoId, ...notes },
          userId,
        );
        assertOwner(await findFieldRecordOwnerId('manejo', saved.id), userId);
        if (item.archived) await manejoService.archiveManejo(saved.id, userId);
        return { status: 'created', id: saved.id };
      }),
    );
  }

  return { serverTime: new Date().toISOString(), deletions, apiaries, boxes, revisions, manejos };
}

/** Exclui um registro do usuário. Já excluído conta como sucesso (o aparelho para de reenviar). */
async function deleteItem(userId: number, entity: SyncEntity, id: number): Promise<SyncDeletionResult> {
  try {
    const ownerId =
      entity === 'apiaries'
        ? await findApiaryOwnerId(id)
        : entity === 'boxes'
          ? (await findBoxOwnership(id))?.ownerId ?? null
          : await findFieldRecordOwnerId(entity === 'review_reports' ? 'revision' : 'manejo', id);
    if (ownerId === null) return { entity, id, status: 'deleted' };
    if (ownerId !== userId) return { entity, id, status: 'rejected', message: FORBIDDEN };

    if (entity === 'apiaries') await apiaryService.removeApiary(id, userId);
    else if (entity === 'boxes') await boxService.deleteRegisteredBox(id, userId);
    else if (entity === 'review_reports') await reviewReportService.deleteRevision(id, userId);
    else await manejoService.deleteManejoService(id, userId);
    return { entity, id, status: 'deleted' };
  } catch (error) {
    console.error('[sync] Falha inesperada ao excluir:', error);
    return { entity, id, status: 'error', message: 'Falha ao excluir. A exclusão será reenviada.' };
  }
}
