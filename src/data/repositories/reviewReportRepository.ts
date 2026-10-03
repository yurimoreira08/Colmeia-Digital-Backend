import { prisma } from '../prisma.js';
import type { ReviewReport } from '../../types/mobile-models.js';

function mapPrismaReview(r: any): ReviewReport {
  let checked: string[] = [];
  try {
    checked = JSON.parse(r.checked_options);
  } catch {
    checked = [];
  }

  return {
    id: r.id,
    clientUuid: r.client_uuid || undefined,
    caixaId: r.caixa_id,
    caixaName: r.caixa_name,
    apiaryId: r.apiary_id ?? null,
    apiaryName: r.apiary_name || '',
    tipo: r.tipo as 'apiario',
    checkedOptions: checked,
    observacoes: r.observacoes || '',
    indicacoes: r.indicacoes || '',
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    archived: !!r.archived,
  };
}

export async function saveReviewReport(
  params: {
    clientUuid?: string;
    caixaId: number;
    caixaName: string;
    apiaryId: number | null;
    apiaryName: string;
    tipo: 'apiario';
    checkedOptions: string[];
    observacoes: string;
    indicacoes: string;
  },
  userId?: number,
): Promise<ReviewReport> {
  if (params.clientUuid) {
    const existing = await prisma.reviewReport.findUnique({
      where: { client_uuid: params.clientUuid },
    });
    if (existing) {
      return mapPrismaReview(existing);
    }
  }

  const created = await prisma.reviewReport.create({
    data: {
      client_uuid: params.clientUuid || null,
      caixa_id: params.caixaId,
      caixa_name: params.caixaName,
      apiary_id: params.apiaryId ?? null,
      apiary_name: params.apiaryName,
      tipo: params.tipo,
      checked_options: JSON.stringify(params.checkedOptions),
      observacoes: params.observacoes,
      indicacoes: params.indicacoes,
      user_id: userId ?? null,
    },
  });

  return mapPrismaReview(created);
}

export async function listReviewReports(
  params?: {
    tipo?: 'apiario';
    apiaryId?: number;
    caixaId?: number;
    includeArchived?: boolean;
  },
  userId?: number,
): Promise<ReviewReport[]> {
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

  const rows = await prisma.reviewReport.findMany({
    where,
    orderBy: { created_at: 'desc' },
  });

  return rows.map(mapPrismaReview);
}

export async function deleteReviewReport(id: number, userId?: number): Promise<void> {
  const where: any = { id };
  if (userId !== undefined) {
    const userApiaries = await prisma.apiary.findMany({ where: { user_id: userId }, select: { id: true } });
    const userApiaryIds = userApiaries.map((a: { id: number }) => a.id);
    where.OR = [
      { user_id: userId },
      { apiary_id: { in: userApiaryIds } },
    ];
  }

  await prisma.reviewReport.deleteMany({ where });
}

export async function updateReviewReport(
  id: number,
  params: { observacoes: string; indicacoes: string; checkedOptions: string[] },
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

  await prisma.reviewReport.updateMany({
    where,
    data: {
      observacoes: params.observacoes,
      indicacoes: params.indicacoes,
      checked_options: JSON.stringify(params.checkedOptions),
    },
  });
}

export async function archiveReviewReport(id: number, userId?: number): Promise<void> {
  const where: any = { id };
  if (userId !== undefined) {
    const userApiaries = await prisma.apiary.findMany({ where: { user_id: userId }, select: { id: true } });
    const userApiaryIds = userApiaries.map((a: { id: number }) => a.id);
    where.OR = [
      { user_id: userId },
      { apiary_id: { in: userApiaryIds } },
    ];
  }

  await prisma.reviewReport.updateMany({
    where,
    data: { archived: 1 },
  });
}

export async function unarchiveReviewReport(id: number, userId?: number): Promise<void> {
  const where: any = { id };
  if (userId !== undefined) {
    const userApiaries = await prisma.apiary.findMany({ where: { user_id: userId }, select: { id: true } });
    const userApiaryIds = userApiaries.map((a: { id: number }) => a.id);
    where.OR = [
      { user_id: userId },
      { apiary_id: { in: userApiaryIds } },
    ];
  }

  await prisma.reviewReport.updateMany({
    where,
    data: { archived: 0 },
  });
}
