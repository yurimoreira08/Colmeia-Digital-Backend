import { prisma } from '../prisma.js';
import type { ManejoReport, ManejoTask } from '../../types/mobile-models.js';

function mapPrismaManejo(m: any): ManejoReport {
  let parsedOptions: ManejoTask[] = [];
  try {
    const raw = JSON.parse(m.checked_options);
    if (Array.isArray(raw)) {
      parsedOptions = raw.map((item) => (typeof item === 'string' ? { id: item, obs: '', ind: '' } : item));
    }
  } catch {
    parsedOptions = [];
  }

  return {
    id: m.id,
    clientUuid: m.client_uuid || undefined,
    caixaId: m.caixa_id,
    caixaName: m.caixa_name,
    apiaryId: m.apiary_id ?? null,
    apiaryName: m.apiary_name || '',
    tipo: m.tipo as 'apiario',
    revisaoId: m.revisao_id ?? undefined,
    checkedOptions: parsedOptions,
    observacoes: m.observacoes || '',
    indicacoes: m.indicacoes || '',
    photoUri: m.photo_uri ?? undefined,
    createdAt: m.created_at instanceof Date ? m.created_at.toISOString() : String(m.created_at),
    archived: !!m.archived,
  };
}

export async function saveManejo(
  params: {
    clientUuid?: string;
    caixaId: number;
    caixaName: string;
    apiaryId: number | null;
    apiaryName: string;
    tipo: 'apiario';
    revisaoId?: number;
    checkedOptions: ManejoTask[];
    observacoes: string;
    indicacoes: string;
    photoUri?: string;
  },
  userId?: number,
): Promise<ManejoReport> {
  if (params.clientUuid) {
    const existing = await prisma.manejo.findUnique({
      where: { client_uuid: params.clientUuid },
    });
    if (existing) {
      return mapPrismaManejo(existing);
    }
  }

  const created = await prisma.manejo.create({
    data: {
      client_uuid: params.clientUuid || null,
      caixa_id: params.caixaId,
      caixa_name: params.caixaName,
      apiary_id: params.apiaryId ?? null,
      apiary_name: params.apiaryName,
      tipo: params.tipo,
      revisao_id: params.revisaoId ?? null,
      checked_options: JSON.stringify(params.checkedOptions),
      observacoes: params.observacoes,
      indicacoes: params.indicacoes,
      photo_uri: params.photoUri ?? null,
      user_id: userId ?? null,
    },
  });

  return mapPrismaManejo(created);
}

export async function listManejos(
  params?: {
    tipo?: 'apiario';
    apiaryId?: number;
    caixaId?: number;
    includeArchived?: boolean;
  },
  userId?: number,
): Promise<ManejoReport[]> {
  const where: any = {};

  if (userId !== undefined) {
    const userApiaries = await prisma.apiary.findMany({ where: { user_id: userId }, select: { id: true } });
    const userApiaryIds = userApiaries.map((a: { id: number }) => a.id);

    where.OR = [
      { user_id: userId },
      { apiary_id: { in: userApiaryIds } },
    ];
  }

  if (!params?.includeArchived) {
    where.archived = 0;
  }

  if (params?.tipo) {
    where.tipo = params.tipo;
  }

  if (params?.caixaId) {
    where.caixa_id = params.caixaId;
  }

  if (params?.apiaryId !== undefined) {
    where.apiary_id = params.apiaryId;
  }

  const rows = await prisma.manejo.findMany({
    where,
    orderBy: { created_at: 'desc' },
  });

  return rows.map(mapPrismaManejo);
}

export async function deleteManejo(id: number, userId?: number): Promise<void> {
  const where: any = { id };
  if (userId !== undefined) {
    const userApiaries = await prisma.apiary.findMany({ where: { user_id: userId }, select: { id: true } });
    const userApiaryIds = userApiaries.map((a: { id: number }) => a.id);
    where.OR = [
      { user_id: userId },
      { apiary_id: { in: userApiaryIds } },
    ];
  }

  await prisma.manejo.deleteMany({ where });
}

export async function updateManejo(
  id: number,
  params: {
    checkedOptions: ManejoTask[];
    observacoes: string;
    indicacoes: string;
    photoUri?: string;
  },
  userId?: number,
): Promise<void> {
  const where: any = { id };
  if (userId !== undefined) {
    const userApiaries = await prisma.apiary.findMany({ where: { user_id: userId }, select: { id: true } });
    const userApiaryIds = userApiaries.map((a: { id: number }) => a.id);
    where.OR = [
      { user_id: userId },
      { apiary_id: { in: userApiaryIds } },
    ];
  }

  await prisma.manejo.updateMany({
    where,
    data: {
      checked_options: JSON.stringify(params.checkedOptions),
      observacoes: params.observacoes,
      indicacoes: params.indicacoes,
      photo_uri: params.photoUri ?? null,
    },
  });
}

export async function archiveManejoRepository(id: number, userId?: number): Promise<void> {
  const where: any = { id };
  if (userId !== undefined) {
    const userApiaries = await prisma.apiary.findMany({ where: { user_id: userId }, select: { id: true } });
    const userApiaryIds = userApiaries.map((a: { id: number }) => a.id);
    where.OR = [
      { user_id: userId },
      { apiary_id: { in: userApiaryIds } },
    ];
  }

  await prisma.manejo.updateMany({
    where,
    data: { archived: 1 },
  });
}

export async function unarchiveManejoRepository(id: number, userId?: number): Promise<void> {
  const where: any = { id };
  if (userId !== undefined) {
    const userApiaries = await prisma.apiary.findMany({ where: { user_id: userId }, select: { id: true } });
    const userApiaryIds = userApiaries.map((a: { id: number }) => a.id);
    where.OR = [
      { user_id: userId },
      { apiary_id: { in: userApiaryIds } },
    ];
  }

  await prisma.manejo.updateMany({
    where,
    data: { archived: 0 },
  });
}
