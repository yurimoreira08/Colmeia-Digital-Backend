import { prisma } from '../prisma.js';
import type { Apiary } from '../../types/mobile-models.js';

function mapPrismaApiary(a: any): Apiary {
  return {
    id: a.id,
    name: a.name,
    location: a.location,
    boxCount: a.box_count,
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
  const row = await prisma.apiary.create({
    data: {
      name: params.name.trim(),
      location: params.location.trim(),
      box_count: params.boxCount,
      description: params.description.trim(),
      user_id: userId ?? 0,
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
