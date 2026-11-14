import { z } from 'zod';
import { optionalQueryBoolean, optionalQueryId, optionalText, positiveId } from './common.schema.js';

/**
 * Criação (sem `id`) ou edição (com `id`) de apiário.
 * O app envia `boxCount` como texto; aceita número também e normaliza para texto.
 */
export const saveApiaryBodySchema = z.object({
  id: positiveId.nullish().transform((value) => value ?? undefined),
  name: z.string({ error: 'Informe o nome do apiário.' }).max(120, 'Nome do apiário muito longo.'),
  location: z.string({ error: 'Informe o local do apiário.' }).max(200, 'Local muito longo.'),
  boxCount: z.union([z.string().max(10), z.number()], { error: 'Informe uma quantidade de caixas válida.' }).transform(String),
  description: optionalText(2000),
});

export const createBoxBodySchema = z.object({
  apiaryId: positiveId,
  name: z.string({ error: 'Informe um nome valido para a caixa.' }).max(80, 'Nome da caixa muito longo.'),
  position: z.number().int().positive().nullish().transform((value) => value ?? undefined),
});

export const renameBoxBodySchema = z.object({
  name: z.string({ error: 'Informe um nome valido para a caixa.' }).max(80, 'Nome da caixa muito longo.'),
});

export const listBoxesQuerySchema = z.object({
  apiaryId: optionalQueryId,
  search: z.string().max(100).optional(),
  includeArchived: optionalQueryBoolean,
});
