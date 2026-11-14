import { prisma } from '../prisma.js';
import { findFieldRecordOwnerId, findOwnedApiaryIds } from './ownershipRepository.js';
import { AppError } from '../../errors/AppError.js';
import { recordDeletions } from './deletedRecordRepository.js';
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
    archived: Boolean(m.archived),
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
      // Reenvio do mesmo registro: devolve o já gravado, desde que seja deste usuário (achado S20).
      if (userId !== undefined && (await findFieldRecordOwnerId('manejo', existing.id)) !== userId) {
        throw new AppError('Este registro já foi enviado por outra conta.', 409);
      }
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
    /** Só os alterados depois desta data (pull incremental do sync). */
    updatedSince?: Date;
  },
  userId?: number,
): Promise<ManejoReport[]> {
  if (!userId || typeof userId !== 'number') {
    return [];
  }

  const userApiaryIds = await findOwnedApiaryIds(userId);

  const where: any = {
    OR: [
      { user_id: userId },
      { apiary_id: { in: userApiaryIds } },
    ],
  };

  if (!params?.includeArchived) {
    where.archived = false;
  }

  if (params?.updatedSince) {
    where.updated_at = { gt: params.updatedSince };
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
    const userApiaryIds = await findOwnedApiaryIds(userId);
    where.OR = [
      { user_id: userId },
      { apiary_id: { in: userApiaryIds } },
    ];
  }

  await prisma.$transaction(async (tx) => {
    const { count } = await tx.manejo.deleteMany({ where });
    if (count > 0 && userId !== undefined) await recordDeletions(tx, userId, 'manejos', [id]);
  });
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
    const userApiaryIds = await findOwnedApiaryIds(userId);
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
    const userApiaryIds = await findOwnedApiaryIds(userId);
    where.OR = [
      { user_id: userId },
      { apiary_id: { in: userApiaryIds } },
    ];
  }

  await prisma.manejo.updateMany({
    where,
    data: { archived: true },
  });
}

export async function unarchiveManejoRepository(id: number, userId?: number): Promise<void> {
  const where: any = { id };
  if (userId !== undefined) {
    const userApiaryIds = await findOwnedApiaryIds(userId);
    where.OR = [
      { user_id: userId },
      { apiary_id: { in: userApiaryIds } },
    ];
  }

  await prisma.manejo.updateMany({
    where,
    data: { archived: false },
  });
}

/** Manejo pelo id, sem filtro de dono: quem chama já conferiu a posse. */
export async function findManejoById(id: number): Promise<ManejoReport | null> {
  const row = await prisma.manejo.findUnique({ where: { id } });
  return row ? mapPrismaManejo(row) : null;
}
