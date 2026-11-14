import { deleteUserAndData } from '../data/repositories/accountRepository.js';
import { listApiaries } from '../data/repositories/apiaryRepository.js';
import { listBoxes } from '../data/repositories/boxRepository.js';
import { listManejos } from '../data/repositories/manejoRepository.js';
import { listRecentNotifications } from '../data/repositories/notificationsRepository.js';
import { listReviewReports } from '../data/repositories/reviewReportRepository.js';
import { findUserById } from '../data/repositories/userRepository.js';
import { AppError, NotFoundError } from '../errors/AppError.js';
import { logger } from '../lib/logger.js';
import { toPublicUser, verifyPassword } from './authService.js';
import { deleteUserFiles, withSignedPhotos } from './storageService.js';

/**
 * Exclusão da conta (LGPD): confere a senha, apaga do banco a conta e todos
 * os dados dela e, depois, as fotos no storage.
 *
 * O banco vem primeiro: se o storage falhar, os dados pessoais já saíram e
 * as fotos que sobrarem ficam registradas no log para limpeza manual. O
 * contrário deixaria a conta viva sem as fotos.
 *
 * @throws AppError 401 se a senha estiver errada.
 */
export async function deleteAccount(userId: number, password: string): Promise<void> {
  const user = await findUserById(userId);
  if (!user) throw new NotFoundError('Conta não encontrada.');

  const { valid } = await verifyPassword(password, user.passwordHash);
  if (!valid) throw new AppError('Senha incorreta.', 401);

  await deleteUserAndData(userId);
  logger.info({ userId }, 'Conta excluída');

  try {
    const removed = await deleteUserFiles(userId);
    logger.info({ userId, removed }, 'Fotos da conta excluída apagadas do storage');
  } catch (err) {
    logger.error({ err, userId }, 'Conta excluída, mas as fotos não foram apagadas do storage: limpar manualmente');
  }
}

/**
 * Exportação dos dados do usuário (LGPD): perfil e tudo o que ele cadastrou,
 * inclusive arquivados, num JSON só. Sem senha, hash nem sessões.
 */
export async function exportAccountData(userId: number) {
  const user = await findUserById(userId);
  if (!user) throw new NotFoundError('Conta não encontrada.');

  const [apiaries, boxes, revisions, manejos, notifications] = await Promise.all([
    listApiaries(userId),
    listBoxes({ showAll: true }, userId),
    listReviewReports({ includeArchived: true }, userId),
    listManejos({ includeArchived: true }, userId),
    listRecentNotifications(userId, 1000),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    app: 'Colmeia Digital',
    user: toPublicUser(user),
    apiaries,
    boxes,
    revisions,
    manejos: await withSignedPhotos(manejos, 'photoUri'),
    notifications,
  };
}
