import {
  deleteManejo,
  listManejos,
  saveManejo,
  updateManejo,
  archiveManejoRepository,
  unarchiveManejoRepository,
} from '../data/repositories/manejoRepository.js';
import type { ManejoReport, ManejoTask } from '../types/mobile-models.js';

export async function saveManejoService(
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
  return saveManejo(params, userId);
}

export async function listManejoReports(
  params?: {
    tipo?: 'apiario';
    apiaryId?: number;
    caixaId?: number;
    includeArchived?: boolean;
  },
  userId?: number,
): Promise<ManejoReport[]> {
  return listManejos(params, userId);
}

export async function deleteManejoService(id: number, userId?: number): Promise<void> {
  await deleteManejo(id, userId);
}

export async function updateManejoService(
  id: number,
  params: {
    checkedOptions: ManejoTask[];
    observacoes: string;
    indicacoes: string;
    photoUri?: string;
  },
  userId?: number,
): Promise<void> {
  await updateManejo(id, params, userId);
}

export async function archiveManejo(id: number, userId?: number): Promise<void> {
  await archiveManejoRepository(id, userId);
}

export async function unarchiveManejo(id: number, userId?: number): Promise<void> {
  await unarchiveManejoRepository(id, userId);
}
