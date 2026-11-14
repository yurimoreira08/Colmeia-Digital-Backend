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
  if (!userId || typeof userId !== 'number') {
    return [];
  }

  const where: any = {
    user_id: userId,
  };

  const rows = await prisma.apiary.findMany({
    where,
    include: {
      _count: {
        select: {
          boxes: {
            where: { archived: false },
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
            where: { archived: false },
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

/**
 * Atualiza um apiário **somente se ele pertencer ao usuário informado**.
 *
 * O filtro por `user_id` fica dentro do próprio `where` da escrita (e não numa
 * checagem prévia) para que não exista caminho em que um usuário altere o
 * apiário de outro, mesmo que a rota deixe passar (defesa em profundidade).
 *
 * @returns o apiário atualizado, ou `null` se ele não existir ou não for do usuário.
 */
export async function updateApiary(
  id: number,
  params: {
    name: string;
    location: string;
    boxCount: number;
    description: string;
  },
  userId?: number,
): Promise<Apiary | null> {
  // Sem usuário autenticado não há dono a verificar: recusa (fail-closed).
  if (!userId) {
    return null;
  }

  const result = await prisma.apiary.updateMany({
    where: { id, user_id: userId },
    data: {
      name: params.name.trim(),
      location: params.location.trim(),
      box_count: params.boxCount,
      description: params.description.trim(),
    },
  });

  if (result.count === 0) {
    return null;
  }

  return getApiaryById(id, userId);
}

/**
 * Exclui o apiário do usuário com as caixas, revisões e manejos dele, numa
 * transação (tudo ou nada).
 *
 * Os registros são apagados por `apiary_id`, sem filtrar por `user_id`: o
 * dono do apiário é dono de tudo que está nele (registros antigos podem ter
 * `user_id` nulo e, antes, sobravam como órfãos). Sem usuário ou se o
 * apiário não for dele, não apaga nada.
 */
export async function deleteApiary(id: number, userId?: number): Promise<void> {
  if (!userId) return;

  await prisma.$transaction(async (tx) => {
    const owned = await tx.apiary.findFirst({ where: { id, user_id: userId }, select: { id: true } });
    if (!owned) return;

    await tx.manejo.deleteMany({ where: { apiary_id: id } });
    await tx.reviewReport.deleteMany({ where: { apiary_id: id } });
    await tx.box.deleteMany({ where: { apiary_id: id } });
    await tx.apiary.deleteMany({ where: { id, user_id: userId } });
  });
}
