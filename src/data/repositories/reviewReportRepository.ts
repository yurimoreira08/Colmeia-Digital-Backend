import { prisma } from '../prisma.js';
import { findFieldRecordOwnerId, findOwnedApiaryIds } from './ownershipRepository.js';
import { AppError } from '../../errors/AppError.js';
import { recordDeletions } from './deletedRecordRepository.js';
import type { ReviewReport } from '../../types/mobile-models.js';

function mapPrismaReview(r: any): ReviewReport {
  let checked: string[];
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
    updatedAt: r.updated_at instanceof Date ? r.updated_at.toISOString() : r.updated_at ? String(r.updated_at) : undefined,
    archived: Boolean(r.archived),
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
      // Reenvio do mesmo registro: devolve o já gravado, desde que seja deste usuário (achado S20).
      if (userId !== undefined && (await findFieldRecordOwnerId('revision', existing.id)) !== userId) {
        throw new AppError('Este registro já foi enviado por outra conta.', 409);
      }
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
    /** Só os alterados depois desta data (pull incremental do sync). */
    updatedSince?: Date;
  },
  userId?: number,
): Promise<ReviewReport[]> {
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

  const rows = await prisma.reviewReport.findMany({
    where,
    orderBy: { created_at: 'desc' },
  });

  return rows.map(mapPrismaReview);
}

export async function deleteReviewReport(id: number, userId?: number): Promise<void> {
  const where: any = { id };
  if (userId !== undefined) {
    const userApiaryIds = await findOwnedApiaryIds(userId);
    where.OR = [
      { user_id: userId },
      { apiary_id: { in: userApiaryIds } },
    ];
  }

  await prisma.$transaction(async (tx) => {
    const { count } = await tx.reviewReport.deleteMany({ where });
    if (count > 0 && userId !== undefined) await recordDeletions(tx, userId, 'review_reports', [id]);
  });
}

export async function updateReviewReport(
  id: number,
  params: { observacoes: string; indicacoes: string; checkedOptions: string[] },
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
    const userApiaryIds = await findOwnedApiaryIds(userId);
    where.OR = [
      { user_id: userId },
      { apiary_id: { in: userApiaryIds } },
    ];
  }

  await prisma.reviewReport.updateMany({
    where,
    data: { archived: true },
  });
}

export async function unarchiveReviewReport(id: number, userId?: number): Promise<void> {
  const where: any = { id };
  if (userId !== undefined) {
    const userApiaryIds = await findOwnedApiaryIds(userId);
    where.OR = [
      { user_id: userId },
      { apiary_id: { in: userApiaryIds } },
    ];
  }

  await prisma.reviewReport.updateMany({
    where,
    data: { archived: false },
  });
}

/** Revisão pelo id, sem filtro de dono: quem chama já conferiu a posse. */
export async function findReviewReportById(id: number): Promise<ReviewReport | null> {
  const row = await prisma.reviewReport.findUnique({ where: { id } });
  return row ? mapPrismaReview(row) : null;
}
