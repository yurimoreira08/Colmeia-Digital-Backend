import {
  countBoxesByApiary,
  createBox,
  deleteBoxesAfterPosition,
  getMaxBoxPosition,
  listBoxes,
  renameBox,
  removeBox,
  archiveBoxRepository,
  unarchiveBoxRepository,
  getBoxById,
} from '../data/repositories/boxRepository.js';
import { getApiaryById, updateApiary } from '../data/repositories/apiaryRepository.js';
import type { Apiary, Box } from '../types/mobile-models.js';
import { normalizeBoxName } from '../utils/boxNameNormalizer.js';

function getDefaultBoxName(position: number): string {
  return `Caixa ${String(position).padStart(2, '0')}`;
}

export async function syncApiaryBoxes(apiaryId: number, targetCount: number, userId?: number): Promise<void> {
  const currentBoxes = await listBoxes({ apiaryId, showAll: true }, userId);
  let currentTotal = currentBoxes.length;

  if (currentTotal >= targetCount) {
    return;
  }

  let nextPos = Math.max(...currentBoxes.map(b => b.position), 0) + 1;

  while (currentTotal < targetCount) {
    await createBox({
      apiaryId,
      name: getDefaultBoxName(nextPos),
      position: nextPos,
    }, userId);
    currentTotal++;
    nextPos++;
  }
}

export async function archiveBox(boxId: number, userId?: number): Promise<void> {
  await archiveBoxRepository(boxId, userId);
}

export async function unarchiveBox(boxId: number, userId?: number): Promise<void> {
  await unarchiveBoxRepository(boxId, userId);
}

export async function syncBoxesFromApiaries(apiaries: Apiary[], userId?: number): Promise<void> {
  await Promise.all(apiaries.map((apiary) => syncApiaryBoxes(apiary.id, apiary.boxCount, userId)));
}

export async function listRegisteredBoxes(
  params?: { apiaryId?: number; search?: string; includeArchived?: boolean; showAll?: boolean },
  userId?: number,
): Promise<Box[]> {
  return listBoxes(params, userId);
}

export async function createRegisteredBox(
  params: { apiaryId: number; name: string; position?: number },
  userId?: number,
): Promise<Box> {
  const normalized = params.name.trim();
  if (normalized.length < 2) {
    throw new Error('Informe um nome valido para a caixa.');
  }

  let position = params.position;
  if (!position) {
    const maxPos = await getMaxBoxPosition(params.apiaryId);
    position = maxPos + 1;
  }

  const box = await createBox({
    apiaryId: params.apiaryId,
    name: normalizeBoxName(normalized),
    position,
  }, userId);

  const apiary = await getApiaryById(params.apiaryId, userId);
  if (apiary) {
    const currentTotal = await countBoxesByApiary(params.apiaryId);
    if (currentTotal > apiary.boxCount) {
      await updateApiary(params.apiaryId, {
        name: apiary.name,
        location: apiary.location,
        boxCount: currentTotal,
        description: apiary.description,
      }, userId);
    }
  }

  return box;
}

export async function renameRegisteredBox(boxId: number, name: string, userId?: number): Promise<void> {
  const normalized = name.trim();

  if (normalized.length < 2) {
    throw new Error('Informe um nome valido para a caixa.');
  }

  await renameBox(boxId, normalizeBoxName(normalized), userId);
}

export async function deleteRegisteredBox(boxId: number, userId?: number): Promise<void> {
  const box = await getBoxById(boxId, userId);
  
  await removeBox(boxId, userId);

  if (box) {
    const apiary = await getApiaryById(box.apiaryId, userId);
    if (apiary) {
      const newCount = Math.max(0, apiary.boxCount - 1);
      await updateApiary(box.apiaryId, {
        name: apiary.name,
        location: apiary.location,
        boxCount: newCount,
        description: apiary.description,
      }, userId);
    }
  }
}
