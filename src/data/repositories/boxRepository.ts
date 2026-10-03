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
  const where: any = {};

  if (userId !== undefined) {
    where.apiary = {
      user_id: userId,
    };
  }

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
  const row = await prisma.box.create({
    data: {
      apiary_id: params.apiaryId,
      name: params.name.trim(),
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

export async function removeBox(boxId: number, userId?: number): Promise<void> {
  const whereReview: any = { caixa_id: boxId };
  const whereManejo: any = { caixa_id: boxId };
  const whereBox: any = { id: boxId };

  if (userId !== undefined) {
    whereReview.OR = [
      { user_id: userId },
      { apiary_id: { in: (await prisma.apiary.findMany({ where: { user_id: userId }, select: { id: true } })).map((a: { id: number }) => a.id) } },
    ];
    whereManejo.OR = [
      { user_id: userId },
      { apiary_id: { in: (await prisma.apiary.findMany({ where: { user_id: userId }, select: { id: true } })).map((a: { id: number }) => a.id) } },
    ];
    whereBox.OR = [
      { user_id: userId },
      { apiary: { user_id: userId } },
    ];
  }

  await prisma.reviewReport.deleteMany({ where: whereReview });
  await prisma.manejo.deleteMany({ where: whereManejo });
  await prisma.box.deleteMany({ where: whereBox });
}

export async function archiveBoxRepository(boxId: number, userId?: number): Promise<void> {
  const whereReview: any = { caixa_id: boxId };
  const whereManejo: any = { caixa_id: boxId };
  const whereBox: any = { id: boxId };

  if (userId !== undefined) {
    const userApiaryIds = (await prisma.apiary.findMany({ where: { user_id: userId }, select: { id: true } })).map((a: { id: number }) => a.id);
    whereReview.OR = [{ user_id: userId }, { apiary_id: { in: userApiaryIds } }];
    whereManejo.OR = [{ user_id: userId }, { apiary_id: { in: userApiaryIds } }];
    whereBox.OR = [{ user_id: userId }, { apiary: { user_id: userId } }];
  }

  await prisma.box.updateMany({ where: whereBox, data: { archived: 1 } });
  await prisma.reviewReport.updateMany({ where: whereReview, data: { archived: 1 } });
  await prisma.manejo.updateMany({ where: whereManejo, data: { archived: 1 } });
}

export async function unarchiveBoxRepository(boxId: number, userId?: number): Promise<void> {
  const whereReview: any = { caixa_id: boxId };
  const whereManejo: any = { caixa_id: boxId };
  const whereBox: any = { id: boxId };

  if (userId !== undefined) {
    const userApiaryIds = (await prisma.apiary.findMany({ where: { user_id: userId }, select: { id: true } })).map((a: { id: number }) => a.id);
    whereReview.OR = [{ user_id: userId }, { apiary_id: { in: userApiaryIds } }];
    whereManejo.OR = [{ user_id: userId }, { apiary_id: { in: userApiaryIds } }];
    whereBox.OR = [{ user_id: userId }, { apiary: { user_id: userId } }];
  }

  await prisma.box.updateMany({ where: whereBox, data: { archived: 0 } });
  await prisma.reviewReport.updateMany({ where: whereReview, data: { archived: 0 } });
  await prisma.manejo.updateMany({ where: whereManejo, data: { archived: 0 } });
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
