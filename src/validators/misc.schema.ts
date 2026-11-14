import { z } from 'zod';

/** Notificação criada pelo próprio app (ex.: aviso local sincronizado). */
export const createNotificationBodySchema = z.object({
  title: z.string({ error: 'Informe o título da notificação.' }).max(120),
  subtitle: z.string({ error: 'Informe o texto da notificação.' }).max(500),
});

/**
 * Upload de imagem em base64 (foto de perfil). 8 MB de base64 ≈ 6 MB de
 * imagem; o limite real de 5 MB e o tipo são conferidos no storageService.
 */
export const uploadBase64BodySchema = z.object({
  base64Data: z.string({ error: 'Nenhum dado de imagem (base64) enviado.' }).min(1, 'Nenhum dado de imagem (base64) enviado.').max(8 * 1024 * 1024),
  folder: z.string().max(20).optional(),
});

export const reportsStatsBodySchema = z.object({
  fromIso: z.string({ error: 'Informe a data inicial (fromIso).' }).max(40),
  toIso: z.string({ error: 'Informe a data final (toIso).' }).max(40),
  searchTerm: z.string().max(100).nullish().transform((value) => value ?? undefined),
  chartFilter: z.enum(['apiarios', 'caixas', 'revisoes', 'manejos'], { error: 'Filtro de relatório inválido.' }),
});
