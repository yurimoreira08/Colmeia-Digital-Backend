import crypto from 'crypto';
import { signPhotoUrl, toStoredPhotoUrl } from './storageService.js';
import bcrypt from 'bcryptjs';
import { createUser, findUserByEmail, findUserById, updateUser, findUserByName, updateUserPassword, acceptUserTerms } from '../data/repositories/userRepository.js';
import { createSession, deleteSessionByTokenHash, clearActiveSession, findSessionByTokenHash, deleteSessionsByUserId, extendSession } from '../data/repositories/sessionRepository.js';
import { createPasswordReset, findValidResetByCodeHash, incrementResetAttempts, markResetAsUsed, invalidatePreviousResets } from '../data/repositories/passwordResetRepository.js';
import { AppError } from '../errors/AppError.js';
import { sendPasswordResetEmail } from './emailService.js';
import type { PublicUser, User } from '../types/mobile-models.js';
import { logger } from '../lib/logger.js';

export interface AuthResult {
  token: string;
  user: PublicUser;
}

/** Custo do bcrypt para novas senhas. Hashes mais fracos são regravados no login. */
export const BCRYPT_COST = 12;

/** Tamanho mínimo de senhas novas (cadastro e redefinição). */
export const MIN_PASSWORD_LENGTH = 8;

/** O bcrypt só considera os primeiros 72 bytes; limitar evita senhas truncadas sem aviso. */
const MAX_PASSWORD_LENGTH = 72;

/** Tentativas erradas de código antes de invalidá-lo (contra força bruta dos 6 dígitos). */
const MAX_RESET_CODE_ATTEMPTS = 5;

/** Mensagem única para falha de login: não revela se o e-mail existe. */
const INVALID_CREDENTIALS_MESSAGE = 'E-mail ou senha inválidos.';

/** Mensagem única do pedido de recuperação: não revela se o e-mail existe. */
const PASSWORD_RESET_REQUESTED_MESSAGE = 'Se este e-mail estiver cadastrado, o código de recuperação foi enviado.';

const INVALID_RESET_CODE_MESSAGE = 'Código de verificação inválido ou expirado.';

/**
 * Remove os campos sensíveis do usuário antes de enviá-lo ao cliente.
 * Toda função deste service que devolve usuário para a API passa por aqui,
 * para que o hash da senha nunca saia do servidor.
 */
export function toPublicUser(user: User): PublicUser {
  const { passwordHash: _passwordHash, ...publicUser } = user;
  return publicUser;
}

function assertEmail(email: unknown): asserts email is string {
  const normalized = typeof email === 'string' ? email.trim() : '';

  if (!normalized) {
    throw new AppError('Informe o e-mail.');
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(normalized)) {
    throw new AppError('Informe um e-mail valido.');
  }
}

/**
 * Valida uma senha **nova** (cadastro ou redefinição).
 * A senha é usada exatamente como digitada: espaços contam.
 */
function assertNewPassword(password: unknown): asserts password is string {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    throw new AppError(`A senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
  }
  if (Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_LENGTH) {
    throw new AppError(`A senha deve ter no máximo ${MAX_PASSWORD_LENGTH} caracteres.`);
  }
}

function assertName(name: unknown): asserts name is string {
  if (typeof name !== 'string' || name.trim().length < 2) {
    throw new AppError('Informe seu nome completo.');
  }
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/** Gera o hash de uma senha nova, sem alterar o texto digitado. */
export async function hashPassword(rawPassword: string): Promise<string> {
  return bcrypt.hash(rawPassword, BCRYPT_COST);
}

/**
 * Confere a senha digitada com o hash salvo.
 *
 * Até a Fase 1 o backend aplicava `trim()` antes de gerar o hash, então quem
 * digitou espaços nas pontas tem o hash da senha "aparada". Por isso, se a
 * senha exata não bater, tenta a versão sem espaços. Nesse caso, ou quando o
 * custo do hash é menor que o atual, `needsRehash` indica que o hash deve ser
 * regravado a partir da senha exata.
 */
export async function verifyPassword(password: string, hash: string): Promise<{ valid: boolean; needsRehash: boolean }> {
  const isWeakHash = bcrypt.getRounds(hash) < BCRYPT_COST;

  if (await bcrypt.compare(password, hash)) {
    return { valid: true, needsRehash: isWeakHash };
  }

  const trimmed = password.trim();
  if (trimmed !== password && (await bcrypt.compare(trimmed, hash))) {
    return { valid: true, needsRehash: true };
  }

  return { valid: false, needsRehash: false };
}

/** Validade da sessão: 30 dias desde o último uso (renovação deslizante). */
const SESSION_TTL_MS = 30 * 24 * 3600 * 1000;
/** A sessão é renovada no máximo uma vez por dia, para não gravar no banco a cada requisição. */
const SESSION_RENEW_AFTER_MS = 24 * 3600 * 1000;

export async function createSessionForUser(userId: number, deviceInfo?: string): Promise<string> {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await createSession({
    userId,
    tokenHash,
    deviceInfo,
    expiresAt,
  });

  return rawToken;
}

export async function register(params: {
  name: string;
  email: string;
  password: string;
  deviceInfo?: string;
  termsAcceptedVersion?: string;
}): Promise<AuthResult> {
  assertName(params.name);
  assertEmail(params.email);
  assertNewPassword(params.password);

  const existing = await findUserByEmail(params.email);
  if (existing) {
    throw new AppError('Este e-mail ja esta cadastrado.');
  }

  const existingName = await findUserByName(params.name);
  if (existingName) {
    throw new AppError('Este nome de usuário já está em uso.');
  }

  const passwordHash = await hashPassword(params.password);
  const user = await createUser({
    name: params.name,
    email: params.email,
    passwordHash,
    termsAcceptedVersion: params.termsAcceptedVersion || 'v1',
  });

  const token = await createSessionForUser(user.id, params.deviceInfo);

  return { token, user: toPublicUser(user) };
}

export async function acceptTerms(userId: number, version: string = 'v1'): Promise<{ success: boolean; terms_accepted_at: string; terms_version: string; user: PublicUser }> {
  const result = await acceptUserTerms(userId, version);
  return { ...result, user: toPublicUser(result.user) };
}

/**
 * Autentica por e-mail e senha.
 * Não aplica a política de tamanho (contas antigas podem ter senhas curtas)
 * e regrava o hash quando ele está com custo antigo ou veio do trim legado.
 */
export async function login(params: {
  email: string;
  password: string;
  deviceInfo?: string;
}): Promise<AuthResult> {
  assertEmail(params.email);
  if (typeof params.password !== 'string' || params.password.length === 0) {
    throw new AppError('Informe a senha.');
  }

  const user = await findUserByEmail(params.email);
  if (!user) {
    throw new AppError(INVALID_CREDENTIALS_MESSAGE);
  }

  const { valid, needsRehash } = await verifyPassword(params.password, user.passwordHash);
  if (!valid) {
    throw new AppError(INVALID_CREDENTIALS_MESSAGE);
  }

  if (needsRehash) {
    try {
      await updateUserPassword(user.id, await hashPassword(params.password));
    } catch (error) {
      // Falhar a migração do hash não deve impedir o login; tenta de novo no próximo.
      logger.warn({ err: error }, 'Falha ao regravar o hash da senha no login');
    }
  }

  const token = await createSessionForUser(user.id, params.deviceInfo);

  return { token, user: toPublicUser(user) };
}

export async function getCurrentUser(userId?: number): Promise<PublicUser | null> {
  if (!userId) {
    return null;
  }

  const user = await findUserById(userId);
  return user ? toPublicUser(user) : null;
}

export async function logout(token?: string, userId?: number): Promise<void> {
  if (token) {
    const tokenHash = hashToken(token);
    await deleteSessionByTokenHash(tokenHash);
  } else if (userId) {
    await clearActiveSession(undefined, userId);
  }
}

export async function updateProfile(
  userId: number,
  params: { name: string; email: string; photo?: string | null }
): Promise<PublicUser> {
  assertName(params.name);
  assertEmail(params.email);

  const existing = await findUserByEmail(params.email);
  if (existing && existing.id !== userId) {
    throw new AppError('Este e-mail ja esta em uso por outro usuario.');
  }

  const existingName = await findUserByName(params.name);
  if (existingName && existingName.id !== userId) {
    throw new AppError('Este nome de usuário já está em uso.');
  }

  // A foto pode chegar como URL assinada (bucket privado): guarda a forma sem prazo.
  const updated = await updateUser(userId, { ...params, photo: toStoredPhotoUrl(params.photo) });
  return toPublicUser(updated);
}

/**
 * Confere o token e renova a sessão em uso: quem abre o app pelo menos uma
 * vez a cada 30 dias nunca perde a sessão. Antes a validade contava só do
 * login, e depois de 30 dias o sync recebia 401 sem que o apicultor percebesse.
 */
export async function authenticateToken(token: string): Promise<number | null> {
  const tokenHash = hashToken(token);
  const session = await findSessionByTokenHash(tokenHash);
  if (!session) return null;

  const renewedExpiry = Date.now() + SESSION_TTL_MS;
  if (renewedExpiry - session.expiresAt.getTime() >= SESSION_RENEW_AFTER_MS) {
    await extendSession(session.id, new Date(renewedExpiry));
  }
  return session.userId;
}

/**
 * Gera e envia um código de recuperação de 6 dígitos (válido por 15 min).
 * A resposta é sempre a mesma, exista o e-mail ou não (evita enumeração).
 */
export async function requestPasswordReset(email: string): Promise<{ success: boolean; message: string }> {
  assertEmail(email);

  const genericResponse = { success: true, message: PASSWORD_RESET_REQUESTED_MESSAGE };

  const user = await findUserByEmail(email);
  if (!user) {
    return genericResponse;
  }

  // Um código novo substitui os anteriores (e começa com 0 tentativas).
  await invalidatePreviousResets(user.id);

  const rawCode = crypto.randomInt(100000, 1000000).toString();
  const codeHash = crypto.createHash('sha256').update(rawCode).digest('hex');
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  await createPasswordReset({
    userId: user.id,
    codeHash,
    expiresAt,
  });

  const sent = await sendPasswordResetEmail(user.email, rawCode, user.name);
  if (!sent) {
    // Sem detalhes do usuário no log; a resposta continua genérica.
    logger.error('Código de recuperação gerado, mas o e-mail não foi enviado');
  }

  return genericResponse;
}

/**
 * Registra uma tentativa errada de código. Na 5ª, invalida o código ativo:
 * a pessoa precisa pedir outro, o que limita a força bruta dos 6 dígitos.
 * O contador fica no banco, então vale mesmo se o servidor reiniciar.
 */
async function registerFailedResetAttempt(userId: number): Promise<void> {
  const attempts = await incrementResetAttempts(userId);
  if (attempts >= MAX_RESET_CODE_ATTEMPTS) {
    await invalidatePreviousResets(userId);
  }
}

export async function resetPasswordWithCode(params: {
  email: string;
  code: string;
  newPassword: string;
}): Promise<{ success: boolean; message: string }> {
  assertEmail(params.email);
  assertNewPassword(params.newPassword);

  const normalizedCode = typeof params.code === 'string' ? params.code.trim() : '';
  if (normalizedCode.length !== 6) {
    throw new AppError('Informe o código de verificação de 6 dígitos.');
  }

  const user = await findUserByEmail(params.email);
  if (!user) {
    throw new AppError(INVALID_RESET_CODE_MESSAGE);
  }

  const codeHash = crypto.createHash('sha256').update(normalizedCode).digest('hex');
  const resetRecord = await findValidResetByCodeHash(user.id, codeHash);

  if (!resetRecord) {
    await registerFailedResetAttempt(user.id);
    throw new AppError(INVALID_RESET_CODE_MESSAGE);
  }

  await markResetAsUsed(resetRecord.id);

  const newPasswordHash = await hashPassword(params.newPassword);
  await updateUserPassword(user.id, newPasswordHash);

  // Encerra todas as sessões: quem estava logado com a senha antiga precisa entrar de novo.
  await deleteSessionsByUserId(user.id);

  return {
    success: true,
    message: 'Senha redefinida com sucesso. Faça login com sua nova senha.',
  };
}

/** Usuário com a foto de perfil em URL assinada, quando o bucket é privado. */
export async function withSignedUserPhoto<T extends { photo?: string | null }>(user: T): Promise<T> {
  if (!user?.photo) return user;
  return { ...user, photo: await signPhotoUrl(user.photo) };
}
