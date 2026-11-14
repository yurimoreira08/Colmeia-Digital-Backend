import { prisma } from '../prisma.js';

/**
 * Consultas de posse: "este registro pertence a este usuário?".
 *
 * O dono de tudo é o dono do apiário. Caixas, revisões e manejos pertencem a
 * quem é dono do apiário em que estão. Os middlewares de `authorize.ts` e os
 * repositórios usam estas funções para que a regra exista num lugar só.
 */

/** Ids dos apiários do usuário (lista vazia sem usuário). */
export async function findOwnedApiaryIds(userId?: number): Promise<number[]> {
  if (!userId) return [];
  const rows = await prisma.apiary.findMany({ where: { user_id: userId }, select: { id: true } });
  return rows.map((row: { id: number }) => row.id);
}

/** Dono do apiário, ou `null` se ele não existe. */
export async function findApiaryOwnerId(apiaryId: number): Promise<number | null> {
  const row = await prisma.apiary.findFirst({ where: { id: apiaryId }, select: { user_id: true } });
  return row ? row.user_id : null;
}

/** Apiário da caixa e o dono desse apiário, ou `null` se a caixa não existe. */
export async function findBoxOwnership(boxId: number): Promise<{ apiaryId: number; ownerId: number | null } | null> {
  const box = await prisma.box.findUnique({ where: { id: boxId }, select: { apiary_id: true } });
  if (!box) return null;
  return { apiaryId: box.apiary_id, ownerId: await findApiaryOwnerId(box.apiary_id) };
}

/**
 * Dono de uma revisão ou manejo: o dono do apiário do registro; se o registro
 * não tem apiário (dados antigos), quem o criou (`user_id`).
 *
 * @returns o id do dono, ou `null` se o registro não existe.
 */
export async function findFieldRecordOwnerId(kind: 'revision' | 'manejo', recordId: number): Promise<number | null> {
  const select = { apiary_id: true, user_id: true } as const;
  const row =
    kind === 'revision'
      ? await prisma.reviewReport.findUnique({ where: { id: recordId }, select })
      : await prisma.manejo.findUnique({ where: { id: recordId }, select });
  if (!row) return null;
  if (row.apiary_id) {
    const apiaryOwner = await findApiaryOwnerId(row.apiary_id);
    if (apiaryOwner !== null) return apiaryOwner;
  }
  return row.user_id ?? null;
}
