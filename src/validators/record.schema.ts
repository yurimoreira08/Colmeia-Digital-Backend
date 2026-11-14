import { z } from 'zod';
import { optionalQueryBoolean, optionalQueryId, optionalText, positiveId } from './common.schema.js';

/**
 * Revisões e manejos ("registros de campo") têm o mesmo cabeçalho: caixa,
 * apiário, observações e indicações. Os limites de tamanho protegem o banco
 * de textos gigantes; os valores `null` vêm do SQLite do app.
 */
const MAX_NOTES = 5000;

const recordHeader = {
  clientUuid: z.string().max(100).nullish().transform((value) => value ?? undefined),
  caixaId: positiveId,
  caixaName: optionalText(120),
  apiaryId: positiveId.nullable(),
  apiaryName: optionalText(120),
  tipo: z.literal('apiario').default('apiario'),
  observacoes: optionalText(MAX_NOTES),
  indicacoes: optionalText(MAX_NOTES),
};

const revisionOptions = z.array(z.string().max(100)).max(100);

/** Tarefa de manejo marcada no app. Campos extras de versões antigas são preservados. */
const manejoTask = z.looseObject({
  id: z.string().max(100),
  obs: optionalText(MAX_NOTES),
  ind: optionalText(MAX_NOTES),
  customName: z.string().max(120).optional(),
});
const manejoOptions = z.array(manejoTask).max(100);

const photoUri = z.string().max(2048).nullish().transform((value) => value ?? undefined);

export const saveRevisionBodySchema = z.object({ ...recordHeader, checkedOptions: revisionOptions });

export const updateRevisionBodySchema = z.object({
  checkedOptions: revisionOptions,
  observacoes: optionalText(MAX_NOTES),
  indicacoes: optionalText(MAX_NOTES),
});

export const saveManejoBodySchema = z.object({
  ...recordHeader,
  revisaoId: positiveId.nullish().transform((value) => value ?? undefined),
  checkedOptions: manejoOptions,
  photoUri,
});

export const updateManejoBodySchema = z.object({
  checkedOptions: manejoOptions,
  observacoes: optionalText(MAX_NOTES),
  indicacoes: optionalText(MAX_NOTES),
  photoUri,
});

export const listRecordsQuerySchema = z.object({
  apiaryId: optionalQueryId,
  caixaId: optionalQueryId,
  includeArchived: optionalQueryBoolean,
});
