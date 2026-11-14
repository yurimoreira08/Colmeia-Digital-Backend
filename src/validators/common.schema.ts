import { z } from 'zod';

/**
 * Peças reutilizadas pelos schemas de entrada.
 *
 * Os schemas validam **formato** (tipos, tamanhos, enums). Regras de negócio
 * (ex.: nome com pelo menos 2 letras, senha forte) continuam nos services.
 */

/** Id numérico positivo vindo de texto (rota ou query) ou número (JSON). */
export const positiveId = z.coerce.number({ error: 'Informe um id válido.' }).int().positive();

/** `:id` das rotas. */
export const idParamsSchema = z.object({ id: positiveId });

/**
 * Texto opcional: o app envia `null` em campos vazios vindos do SQLite;
 * vira string vazia para os services.
 */
export function optionalText(max: number) {
  return z.string().max(max).nullish().transform((value) => value ?? '');
}

/** Id opcional em query string (`?apiaryId=10`). */
export const optionalQueryId = z.string().regex(/^\d+$/, 'Informe um id válido.').optional();

/** Flag booleana em query string: só "true" ou "false". */
export const optionalQueryBoolean = z.enum(['true', 'false']).optional();

/** E-mail como texto; o formato é conferido no authService. */
export const emailField = z.string({ error: 'Informe o e-mail.' }).max(254, 'E-mail muito longo.');
