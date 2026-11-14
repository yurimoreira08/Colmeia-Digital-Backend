import type { Prisma } from '@prisma/client';
import { prisma } from '../prisma.js';
import type { Box } from '../../types/mobile-models.js';

function mapPrismaBox(b: any): Box {
  return {
    id: b.id,
    apiaryId: b.apiary_id,
    apiaryName: b.apiary?.name || '',
    name: b.name,
    position: b.position,
    createdAt: b.created_at instanceof Date ? b.created_at.toISOString() : String(b.created_at),
    updatedAt: b.updated_at instanceof Date ? b.updated_at.toISOString() : String(b.updated_at),
    archived: !!b.archived,
  };
}

export async function listBoxes(
  params?: { apiaryId?: number; search?: string; includeArchived?: boolean; showAll?: boolean },
  userId?: number,
): Promise<Box[]> {
  if (!userId || typeof userId !== 'number') {
    return [];
  }

  const where: any = {
    apiary: {
      user_id: userId,
    },
  };

  if (params?.showAll) {
    // Não filtra por arquivado
  } else if (!params?.includeArchived) {
    where.archived = 0;
  }

  if (params?.apiaryId) {
    where.apiary_id = params.apiaryId;
  }

  if (params?.search && params.search.trim().length > 0) {
    where.name = {
      contains: params.search.trim(),
      mode: 'insensitive',
    };
  }

  const rows = await prisma.box.findMany({
    where,
    include: {
      apiary: {
        select: { name: true },
      },
    },
    orderBy: [
      { apiary: { name: 'asc' } },
      { position: 'asc' },
      { id: 'asc' },
    ],
  });

  return rows.map(mapPrismaBox);
}

export async function countBoxesByApiary(apiaryId: number): Promise<number> {
  return prisma.box.count({
    where: { apiary_id: apiaryId },
  });
}

export async function getMaxBoxPosition(apiaryId: number): Promise<number> {
  const agg = await prisma.box.aggregate({
    where: { apiary_id: apiaryId },
    _max: { position: true },
  });

  return agg._max.position ?? 0;
}

export async function createBox(
  params: {
    apiaryId: number;
    name: string;
    position: number;
  },
  userId?: number,
): Promise<Box> {
  const trimmedName = params.name.trim();

  // Verifica se já existe uma caixa com mesmo nome ou mesma posição neste apiário (evita duplicatas ao sincronizar)
  const existingBox = await prisma.box.findFirst({
    where: {
      apiary_id: params.apiaryId,
      archived: 0,
      OR: [
        { name: { equals: trimmedName, mode: 'insensitive' } },
        { position: params.position },
      ],
    },
    include: {
      apiary: {
        select: { name: true },
      },
    },
  });

  if (existingBox) {
    // Se encontrou pela posição mas o nome for diferente, ou se é a mesma caixa, atualiza o nome
    if (existingBox.name.toLowerCase() !== trimmedName.toLowerCase()) {
      const updated = await prisma.box.update({
        where: { id: existingBox.id },
        data: { name: trimmedName },
        include: {
          apiary: {
            select: { name: true },
          },
        },
      });
      return mapPrismaBox(updated);
    }
    return mapPrismaBox(existingBox);
  }

  const row = await prisma.box.create({
    data: {
      apiary_id: params.apiaryId,
      name: trimmedName,
      position: params.position,
      user_id: userId ?? null,
    },
    include: {
      apiary: {
        select: { name: true },
      },
    },
  });

  return mapPrismaBox(row);
}

export async function deleteBoxesAfterPosition(apiaryId: number, maxPositionToKeep: number): Promise<void> {
  await prisma.box.deleteMany({
    where: {
      apiary_id: apiaryId,
      position: { gt: maxPositionToKeep },
    },
  });
}

export async function renameBox(boxId: number, newName: string, userId?: number): Promise<void> {
  const where: any = { id: boxId };
  if (userId !== undefined) {
    where.OR = [
      { user_id: userId },
      { apiary: { user_id: userId } },
    ];
  }

  await prisma.box.updateMany({
    where,
    data: {
      name: newName.trim(),
    },
  });
}

/**
 * Verdadeiro se a caixa existe e está num apiário do usuário.
 * Usado pelas operações em cascata antes de mexer nos registros da caixa.
 */
async function isBoxOwnedBy(tx: Prisma.TransactionClient, boxId: number, userId?: number): Promise<boolean> {
  if (!userId) return false;
  const box = await tx.box.findFirst({ where: { id: boxId, apiary: { user_id: userId } }, select: { id: true } });
  return Boolean(box);
}

/**
 * Exclui a caixa do usuário com as revisões e manejos dela, numa transação.
 * Registros são apagados por `caixa_id`, sem filtrar por `user_id` (o dono do
 * apiário é dono de tudo que está nele).
 */
export async function removeBox(boxId: number, userId?: number): Promise<void> {
  await prisma.$transaction(async (tx) => {
    if (!(await isBoxOwnedBy(tx, boxId, userId))) return;

    await tx.manejo.deleteMany({ where: { caixa_id: boxId } });
    await tx.reviewReport.deleteMany({ where: { caixa_id: boxId } });
    await tx.box.deleteMany({ where: { id: boxId } });
  });
}

/** Arquiva a caixa do usuário e todas as revisões e manejos dela, numa transação. */
export async function archiveBoxRepository(boxId: number, userId?: number): Promise<void> {
  await prisma.$transaction(async (tx) => {
    if (!(await isBoxOwnedBy(tx, boxId, userId))) return;

    await tx.box.updateMany({ where: { id: boxId }, data: { archived: 1 } });
    await tx.reviewReport.updateMany({ where: { caixa_id: boxId }, data: { archived: 1 } });
    await tx.manejo.updateMany({ where: { caixa_id: boxId }, data: { archived: 1 } });
  });
}

/** Desarquiva a caixa do usuário e todas as revisões e manejos dela, numa transação. */
export async function unarchiveBoxRepository(boxId: number, userId?: number): Promise<void> {
  await prisma.$transaction(async (tx) => {
    if (!(await isBoxOwnedBy(tx, boxId, userId))) return;

    await tx.box.updateMany({ where: { id: boxId }, data: { archived: 0 } });
    await tx.reviewReport.updateMany({ where: { caixa_id: boxId }, data: { archived: 0 } });
    await tx.manejo.updateMany({ where: { caixa_id: boxId }, data: { archived: 0 } });
  });
}

export async function getBoxById(id: number, userId?: number): Promise<Box | null> {
  const where: any = { id };
  if (userId !== undefined) {
    where.apiary = { user_id: userId };
  }

  const row = await prisma.box.findFirst({
    where,
    include: {
      apiary: { select: { name: true } },
    },
  });

  return row ? mapPrismaBox(row) : null;
}
