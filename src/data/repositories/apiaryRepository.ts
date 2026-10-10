import { prisma } from '../prisma.js';
import type { Apiary } from '../../types/mobile-models.js';

function mapPrismaApiary(a: any): Apiary {
  const actualCount = a._count?.boxes !== undefined ? a._count.boxes : a.box_count;
  return {
    id: a.id,
    name: a.name,
    location: a.location,
    boxCount: actualCount,
    description: a.description || '',
    createdAt: a.created_at instanceof Date ? a.created_at.toISOString() : String(a.created_at),
    updatedAt: a.updated_at instanceof Date ? a.updated_at.toISOString() : String(a.updated_at),
    role: 'owner',
    user_id: a.user_id,
  };
}

export async function listApiaries(userId?: number): Promise<Apiary[]> {
  const where: any = {};
  if (userId !== undefined) {
    where.user_id = userId;
  }

  const rows = await prisma.apiary.findMany({
    where,
    include: {
      _count: {
        select: {
          boxes: {
            where: { archived: 0 },
          },
        },
      },
    },
    orderBy: [
      { updated_at: 'desc' },
      { id: 'desc' },
    ],
  });

  return rows.map(mapPrismaApiary);
}

export async function getApiaryById(id: number, userId?: number): Promise<Apiary | null> {
  const where: any = { id };
  if (userId !== undefined) {
    where.user_id = userId;
  }

  const row = await prisma.apiary.findFirst({
    where,
    include: {
      _count: {
        select: {
          boxes: {
            where: { archived: 0 },
          },
        },
      },
    },
  });

  return row ? mapPrismaApiary(row) : null;
}

export async function createApiary(
  params: {
    name: string;
    location: string;
    boxCount: number;
    description: string;
  },
  userId?: number,
): Promise<Apiary> {
  const trimmedName = params.name.trim();
  const trimmedLocation = params.location.trim();
  const targetUserId = userId ?? 0;

  // Evita duplicação se o mesmo apiário for enviado repetidamente durante sincronizações
  const existing = await prisma.apiary.findFirst({
    where: {
      user_id: targetUserId,
      name: { equals: trimmedName, mode: 'insensitive' },
    },
  });

  if (existing) {
    const updated = await prisma.apiary.update({
      where: { id: existing.id },
      data: {
        location: trimmedLocation,
        box_count: params.boxCount,
        description: params.description.trim(),
      },
    });
    return mapPrismaApiary(updated);
  }

  const row = await prisma.apiary.create({
    data: {
      name: trimmedName,
      location: trimmedLocation,
      box_count: params.boxCount,
      description: params.description.trim(),
      user_id: targetUserId,
    },
  });

  return mapPrismaApiary(row);
}

export async function updateApiary(
  id: number,
  params: {
    name: string;
    location: string;
    boxCount: number;
    description: string;
  },
  userId?: number,
): Promise<Apiary> {
  const where: any = { id };
  if (userId !== undefined) {
    where.user_id = userId;
  }

  const row = await prisma.apiary.update({
    where: { id },
    data: {
      name: params.name.trim(),
      location: params.location.trim(),
      box_count: params.boxCount,
      description: params.description.trim(),
    },
  });

  return mapPrismaApiary(row);
}

export async function deleteApiary(id: number, userId?: number): Promise<void> {
  const where: any = { id };
  if (userId !== undefined) {
    where.user_id = userId;
  }

  // Deleta revisões e manejos do apiário
  await prisma.reviewReport.deleteMany({
    where: {
      apiary_id: id,
      ...(userId !== undefined ? { user_id: userId } : {}),
    },
  });

  await prisma.manejo.deleteMany({
    where: {
      apiary_id: id,
      ...(userId !== undefined ? { user_id: userId } : {}),
    },
  });

  await prisma.apiary.deleteMany({
    where,
  });
}
