import {
  createApiary,
  deleteApiary,
  getApiaryById,
  listApiaries,
  updateApiary,
} from '../data/repositories/apiaryRepository.js';
import { createNotification } from '../data/repositories/notificationsRepository.js';
import type { Apiary } from '../types/mobile-models.js';
import { AppError, NotFoundError } from '../errors/AppError.js';

function parseBoxCount(value: string): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0 || !Number.isInteger(parsed)) {
    throw new AppError('Informe uma quantidade de caixas válida.');
  }

  return parsed;
}

function assertRequired(value: string, fieldLabel: string): void {
  if (!value || value.trim().length < 2) {
    throw new AppError(`Informe ${fieldLabel}.`);
  }
}

export async function listAllApiaries(userId?: number): Promise<Apiary[]> {
  return listApiaries(userId);
}

export async function loadApiary(id: number, userId?: number): Promise<Apiary | null> {
  return getApiaryById(id, userId);
}

export async function saveApiary(
  params: {
    id?: number;
    name: string;
    location: string;
    boxCount: string;
    description?: string;
  },
  userId?: number,
): Promise<Apiary> {
  assertRequired(params.name, 'o nome do apiário');
  assertRequired(params.location, 'o local do apiário');

  const parsedBoxCount = parseBoxCount(params.boxCount);
  const finalDescription = params.description || '';

  if (params.id) {
    const updated = await updateApiary(params.id, {
      name: params.name,
      location: params.location,
      boxCount: parsedBoxCount,
      description: finalDescription,
    }, userId);

    // null = apiário inexistente ou de outro usuário; a mensagem é a mesma nos
    // dois casos para não revelar se o id existe.
    if (!updated) {
      throw new NotFoundError('Apiário não encontrado.');
    }

    await createNotification({
      title: 'Apiário atualizado',
      subtitle: `O apiário ${updated.name} foi atualizado com sucesso.`,
    }, userId);

    return updated;
  }

  const created = await createApiary({
    name: params.name,
    location: params.location,
    boxCount: parsedBoxCount,
    description: finalDescription,
  }, userId);

  await createNotification({
    title: 'Novo apiário cadastrado',
    subtitle: `Apiário ${created.name} criado com ${created.boxCount} caixas.`,
  }, userId);

  return created;
}

export async function removeApiary(id: number, userId?: number): Promise<void> {
  const apiary = await loadApiary(id, userId);
  const name = apiary?.name ?? 'Apiário';
  
  await deleteApiary(id, userId);
  
  await createNotification({
    title: 'Apiário excluído',
    subtitle: `O apiário ${name} e todas as suas caixas e registros foram removidos com sucesso.`,
  }, userId);
}
