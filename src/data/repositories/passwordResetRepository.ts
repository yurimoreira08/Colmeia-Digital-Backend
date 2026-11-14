import { prisma } from '../prisma.js';

/**
 * Códigos de recuperação de senha (tabela `password_resets`).
 * O schema da tabela é gerenciado pelas migrations do Prisma; só o hash
 * SHA-256 do código é guardado.
 */

export interface PasswordResetRecord {
  id: number;
  userId: number;
  codeHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

type PasswordResetRow = {
  id: number;
  user_id: number;
  code_hash: string;
  expires_at: Date;
  used_at: Date | null;
  created_at: Date;
};

function mapPrismaPasswordReset(row: PasswordResetRow): PasswordResetRecord {
  return {
    id: row.id,
    userId: row.user_id,
    codeHash: row.code_hash,
    expiresAt: row.expires_at,
    usedAt: row.used_at,
    createdAt: row.created_at,
  };
}

/** Filtro dos códigos ainda utilizáveis: não usados e dentro da validade. */
function activeResetsWhere(userId: number) {
  return { user_id: userId, used_at: null, expires_at: { gt: new Date() } };
}

/** Registra um novo código (já em hash) para o usuário. */
export async function createPasswordReset(params: {
  userId: number;
  codeHash: string;
  expiresAt: Date;
}): Promise<PasswordResetRecord> {
  const row = await prisma.passwordReset.create({
    data: {
      user_id: params.userId,
      code_hash: params.codeHash,
      expires_at: params.expiresAt,
    },
  });
  return mapPrismaPasswordReset(row);
}

/** Código ativo do usuário com este hash, ou `null` (errado, usado ou expirado). */
export async function findValidResetByCodeHash(userId: number, codeHash: string): Promise<PasswordResetRecord | null> {
  const row = await prisma.passwordReset.findFirst({
    where: { ...activeResetsWhere(userId), code_hash: codeHash },
    orderBy: { id: 'desc' },
  });
  return row ? mapPrismaPasswordReset(row) : null;
}

/** Marca o código como usado (não pode ser reutilizado). */
export async function markResetAsUsed(id: number): Promise<void> {
  await prisma.passwordReset.update({
    where: { id },
    data: { used_at: new Date() },
  });
}

/** Invalida todos os códigos pendentes do usuário. */
export async function invalidatePreviousResets(userId: number): Promise<void> {
  await prisma.passwordReset.updateMany({
    where: { user_id: userId, used_at: null },
    data: { used_at: new Date() },
  });
}

/**
 * Soma uma tentativa errada aos códigos ativos do usuário.
 *
 * @returns o total de tentativas do código ativo mais recente (0 se não houver código ativo).
 */
export async function incrementResetAttempts(userId: number): Promise<number> {
  const activeWhere = activeResetsWhere(userId);

  await prisma.passwordReset.updateMany({
    where: activeWhere,
    data: { attempts: { increment: 1 } },
  });

  const latest = await prisma.passwordReset.findFirst({
    where: activeWhere,
    orderBy: { id: 'desc' },
    select: { attempts: true },
  });
  return latest?.attempts ?? 0;
}
