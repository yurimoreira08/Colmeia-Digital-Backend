import {
  deleteReviewReport,
  listReviewReports,
  saveReviewReport,
  updateReviewReport,
  archiveReviewReport,
  unarchiveReviewReport,
} from '../data/repositories/reviewReportRepository.js';
import type { ReviewReport } from '../types/mobile-models.js';

export async function saveRevision(
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
  return saveReviewReport(params, userId);
}

export async function listRevisions(
  params?: {
    tipo?: 'apiario';
    apiaryId?: number;
    caixaId?: number;
    includeArchived?: boolean;
  },
  userId?: number,
): Promise<ReviewReport[]> {
  return listReviewReports(params, userId);
}

export const listRevisionReports = listRevisions;

export async function deleteRevision(id: number, userId?: number): Promise<void> {
  await deleteReviewReport(id, userId);
}

export async function updateRevision(
  id: number,
  params: { observacoes: string; indicacoes: string; checkedOptions: string[] },
  userId?: number,
): Promise<void> {
  await updateReviewReport(id, params, userId);
}

export async function archiveRevision(id: number, userId?: number): Promise<void> {
  await archiveReviewReport(id, userId);
}

export async function unarchiveRevision(id: number, userId?: number): Promise<void> {
  await unarchiveReviewReport(id, userId);
}
