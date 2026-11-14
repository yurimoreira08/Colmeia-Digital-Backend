import { z } from 'zod';

/** GET /sync/changes?since=<serverTime da resposta anterior> */
export const syncChangesQuerySchema = z.object({
  since: z.iso
    .datetime({ offset: true, error: 'Informe a data do último sync (since) no formato ISO.' })
    .optional()
    .transform((value) => (value ? new Date(value) : null)),
});

/**
 * POST /sync: envio em lote do que o aparelho alterou.
 *
 * Cada item leva o `localId` (id no SQLite do aparelho; negativo para
 * registros criados offline) e, se já existe no servidor, o `id` e o
 * `baseUpdatedAt` (o updated_at do servidor quando o aparelho baixou o
 * registro), usado para detectar conflito. Referências a pais (apiaryId,
 * caixaId, revisaoId) podem ser negativas: apontam para um item do mesmo lote.
 *
 * Até 100 itens por lista: o app divide envios maiores.
 */
const MAX_ITEMS = 100;
const MAX_NOTES = 5000;
const text = (max: number) => z.string().max(max).nullish().transform((value) => value ?? '');
const localId = z.number().int().refine((value) => value !== 0, 'Informe o id local.');
const serverId = z.number().int().positive().nullish().transform((value) => value ?? undefined);
/** Id de um pai: positivo (servidor) ou negativo (item deste lote). */
const reference = z.number().int().refine((value) => value !== 0, 'Referência inválida.');
const clientUuid = z.string().max(100).nullish().transform((value) => value ?? undefined);
const baseUpdatedAt = z.iso.datetime({ offset: true }).nullish().transform((value) => (value ? new Date(value) : undefined));

const syncApiary = z.object({
  localId,
  id: serverId,
  clientUuid,
  baseUpdatedAt,
  name: z.string().max(120),
  location: z.string().max(200),
  boxCount: z.union([z.string().max(10), z.number()]).transform(String),
  description: text(2000),
});

const syncBox = z.object({
  localId,
  id: serverId,
  clientUuid,
  baseUpdatedAt,
  apiaryId: reference,
  name: z.string().max(80),
  position: z.number().int().positive().nullish().transform((value) => value ?? undefined),
  archived: z.boolean().default(false),
});

const recordFields = {
  localId,
  id: serverId,
  clientUuid,
  baseUpdatedAt,
  caixaId: reference,
  caixaName: text(120),
  apiaryId: reference.nullish().transform((value) => value ?? null),
  apiaryName: text(120),
  observacoes: text(MAX_NOTES),
  indicacoes: text(MAX_NOTES),
  archived: z.boolean().default(false),
};

const syncRevision = z.object({ ...recordFields, checkedOptions: z.array(z.string().max(100)).max(100) });

const syncManejo = z.object({
  ...recordFields,
  revisaoId: reference.nullish().transform((value) => value ?? undefined),
  checkedOptions: z
    .array(
      z.looseObject({
        id: z.string().max(100),
        obs: text(MAX_NOTES),
        ind: text(MAX_NOTES),
        customName: z.string().max(120).optional(),
      }),
    )
    .max(100),
  /** Só URL já enviada ao storage: a foto sobe antes, pelo /upload/manejo-photo. */
  photoUri: z.string().max(2048).nullish().transform((value) => value ?? undefined),
});

const syncDeletion = z.object({
  entity: z.enum(['apiaries', 'boxes', 'review_reports', 'manejos']),
  id: z.number().int().positive(),
});

export const syncPushBodySchema = z.object({
  deletions: z.array(syncDeletion).max(MAX_ITEMS).default([]),
  apiaries: z.array(syncApiary).max(MAX_ITEMS).default([]),
  boxes: z.array(syncBox).max(MAX_ITEMS).default([]),
  revisions: z.array(syncRevision).max(MAX_ITEMS).default([]),
  manejos: z.array(syncManejo).max(MAX_ITEMS).default([]),
});

export type SyncPushBody = z.infer<typeof syncPushBodySchema>;
