import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { createUser, findUserByEmail, findUserById, updateUser, findUserByName, updateUserPassword } from '../data/repositories/userRepository.js';
import { createSession, deleteSessionByTokenHash, clearActiveSession, findSessionByTokenHash, deleteSessionsByUserId } from '../data/repositories/sessionRepository.js';
import { createPasswordReset, findValidResetByCodeHash, markResetAsUsed, invalidatePreviousResets } from '../data/repositories/passwordResetRepository.js';
import { sendPasswordResetEmail } from './emailService.js';
import type { User } from '../types/mobile-models.js';

export interface AuthResult {
  token: string;
  user: User;
}

function assertEmail(email: string): void {
  const normalized = email.trim();

  if (!normalized) {
    throw new Error('Informe o e-mail.');
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(normalized)) {
    throw new Error('Informe um e-mail valido.');
  }
}

function assertPassword(password: string): void {
  if (!password || password.trim().length < 4) {
    throw new Error('A senha deve ter pelo menos 4 caracteres.');
  }
}

function assertName(name: string): void {
  if (!name || name.trim().length < 2) {
    throw new Error('Informe seu nome completo.');
  }
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function hashPassword(rawPassword: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(rawPassword.trim(), salt);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password.trim(), hash);
}

export async function createSessionForUser(userId: number, deviceInfo?: string): Promise<string> {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000); // 30 dias

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
  assertPassword(params.password);

  const existing = await findUserByEmail(params.email);
  if (existing) {
    throw new Error('Este e-mail ja esta cadastrado.');
  }

  const existingName = await findUserByName(params.name);
  if (existingName) {
    throw new Error('Este nome de usuário já está em uso.');
  }

  const passwordHash = await hashPassword(params.password);
  const user = await createUser({
    name: params.name,
    email: params.email,
    passwordHash,
    termsAcceptedVersion: params.termsAcceptedVersion || 'v1',
  });

  const token = await createSessionForUser(user.id, params.deviceInfo);

  return { token, user };
}

export async function acceptTerms(userId: number, version: string = 'v1'): Promise<User> {
  return updateUser(userId, { termsAcceptedVersion: version });
}

export async function login(params: {
  email: string;
  password: string;
  deviceInfo?: string;
}): Promise<AuthResult> {
  assertEmail(params.email);
  assertPassword(params.password);

  const user = await findUserByEmail(params.email);
  if (!user) {
    throw new Error('Usuario nao encontrado.');
  }

  const isValid = await verifyPassword(params.password, user.passwordHash);
  if (!isValid) {
    throw new Error('Senha incorreta.');
  }

  const token = await createSessionForUser(user.id, params.deviceInfo);

  return { token, user };
}

export async function getCurrentUser(userId?: number): Promise<User | null> {
  if (!userId) {
    return null;
  }

  return findUserById(userId);
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
): Promise<User> {
  assertName(params.name);
  assertEmail(params.email);

  const existing = await findUserByEmail(params.email);
  if (existing && existing.id !== userId) {
    throw new Error('Este e-mail ja esta em uso por outro usuario.');
  }

  const existingName = await findUserByName(params.name);
  if (existingName && existingName.id !== userId) {
    throw new Error('Este nome de usuário já está em uso.');
  }

  return updateUser(userId, params);
}

export async function authenticateToken(token: string): Promise<number | null> {
  const tokenHash = hashToken(token);
  const session = await findSessionByTokenHash(tokenHash);
  return session ? session.userId : null;
}

export async function requestPasswordReset(email: string): Promise<{ success: boolean; message: string }> {
  assertEmail(email);

  const user = await findUserByEmail(email);

  // Prevenção de user enumeration: se o usuário não existir, responde mensagem de sucesso genérica
  if (!user) {
    return {
      success: true,
      message: 'Se este e-mail estiver cadastrado, o código de recuperação foi enviado.',
    };
  }

  // Invalida solicitações anteriores pendentes
  await invalidatePreviousResets(user.id);

  // Gera código numérico de 6 dígitos (ex: "481923")
  const rawCode = crypto.randomInt(100000, 1000000).toString();
  const codeHash = crypto.createHash('sha256').update(rawCode).digest('hex');
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos

  await createPasswordReset({
    userId: user.id,
    codeHash,
    expiresAt,
  });

  // Dispara o envio do e-mail com o código
  await sendPasswordResetEmail(user.email, rawCode, user.name);

  return {
    success: true,
    message: 'Código de recuperação enviado para o e-mail cadastrado.',
  };
}

export async function resetPasswordWithCode(params: {
  email: string;
  code: string;
  newPassword: string;
}): Promise<{ success: boolean; message: string }> {
  assertEmail(params.email);
  assertPassword(params.newPassword);

  const normalizedCode = (params.code || '').trim();
  if (!normalizedCode || normalizedCode.length !== 6) {
    throw new Error('Informe o código de verificação de 6 dígitos.');
  }

  const user = await findUserByEmail(params.email);
  if (!user) {
    throw new Error('Código de verificação inválido ou expirado.');
  }

  const codeHash = crypto.createHash('sha256').update(normalizedCode).digest('hex');
  const resetRecord = await findValidResetByCodeHash(user.id, codeHash);

  if (!resetRecord) {
    throw new Error('Código de verificação inválido ou expirado.');
  }

  // Marca o código como utilizado
  await markResetAsUsed(resetRecord.id);

  // Atualiza o hash da nova senha
  const newPasswordHash = await hashPassword(params.newPassword);
  await updateUserPassword(user.id, newPasswordHash);

  // Invalida todas as sessões ativas do usuário para exigir novo login com a nova senha
  await deleteSessionsByUserId(user.id);

  return {
    success: true,
    message: 'Senha redefinida com sucesso. Faça login com sua nova senha.',
  };
}
