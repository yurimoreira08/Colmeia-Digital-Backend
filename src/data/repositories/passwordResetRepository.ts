import { prisma } from '../prisma.js';

export interface PasswordResetRecord {
  id: number;
  userId: number;
  codeHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

let isTableInitialized = false;

export async function ensurePasswordResetsTable(): Promise<void> {
  if (isTableInitialized) return;
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS password_resets (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        code_hash TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        used_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_password_resets_user_id ON password_resets(user_id)
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_password_resets_code_hash ON password_resets(code_hash)
    `);
    isTableInitialized = true;
  } catch (err) {
    console.error('[passwordResetRepository] Falha ao verificar/criar tabela password_resets:', err);
    throw err;
  }
}

export async function createPasswordReset(params: {
  userId: number;
  codeHash: string;
  expiresAt: Date;
}): Promise<PasswordResetRecord> {
  await ensurePasswordResetsTable();

  const prismaModel = (prisma as any).passwordReset;
  if (prismaModel && typeof prismaModel.create === 'function') {
    const row = await prismaModel.create({
      data: {
        user_id: params.userId,
        code_hash: params.codeHash,
        expires_at: params.expiresAt,
      },
    });

    return {
      id: row.id,
      userId: row.user_id,
      codeHash: row.code_hash,
      expiresAt: row.expires_at,
      usedAt: row.used_at,
      createdAt: row.created_at,
    };
  }

  // Fallback resiliente via SQL nativo
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `INSERT INTO password_resets (user_id, code_hash, expires_at, created_at)
     VALUES ($1, $2, $3, NOW())
     RETURNING id, user_id, code_hash, expires_at, used_at, created_at`,
    params.userId,
    params.codeHash,
    params.expiresAt
  );

  const row = rows[0];
  return {
    id: row.id,
    userId: row.user_id,
    codeHash: row.code_hash,
    expiresAt: new Date(row.expires_at),
    usedAt: row.used_at ? new Date(row.used_at) : null,
    createdAt: new Date(row.created_at),
  };
}

export async function findValidResetByCodeHash(
  userId: number,
  codeHash: string,
): Promise<PasswordResetRecord | null> {
  await ensurePasswordResetsTable();
  const now = new Date();

  const prismaModel = (prisma as any).passwordReset;
  if (prismaModel && typeof prismaModel.findFirst === 'function') {
    const row = await prismaModel.findFirst({
      where: {
        user_id: userId,
        code_hash: codeHash,
        used_at: null,
        expires_at: {
          gt: now,
        },
      },
      orderBy: {
        id: 'desc',
      },
    });

    if (!row) return null;

    return {
      id: row.id,
      userId: row.user_id,
      codeHash: row.code_hash,
      expiresAt: row.expires_at,
      usedAt: row.used_at,
      createdAt: row.created_at,
    };
  }

  // Fallback resiliente via SQL nativo
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id, user_id, code_hash, expires_at, used_at, created_at
     FROM password_resets
     WHERE user_id = $1 AND code_hash = $2 AND used_at IS NULL AND expires_at > NOW()
     ORDER BY id DESC
     LIMIT 1`,
    userId,
    codeHash
  );

  if (!rows || rows.length === 0) return null;

  const row = rows[0];
  return {
    id: row.id,
    userId: row.user_id,
    codeHash: row.code_hash,
    expiresAt: new Date(row.expires_at),
    usedAt: row.used_at ? new Date(row.used_at) : null,
    createdAt: new Date(row.created_at),
  };
}

export async function markResetAsUsed(id: number): Promise<void> {
  await ensurePasswordResetsTable();

  const prismaModel = (prisma as any).passwordReset;
  if (prismaModel && typeof prismaModel.update === 'function') {
    await prismaModel.update({
      where: { id },
      data: {
        used_at: new Date(),
      },
    });
    return;
  }

  // Fallback resiliente via SQL nativo
  await prisma.$executeRawUnsafe(
    `UPDATE password_resets SET used_at = NOW() WHERE id = $1`,
    id
  );
}

export async function invalidatePreviousResets(userId: number): Promise<void> {
  await ensurePasswordResetsTable();

  const prismaModel = (prisma as any).passwordReset;
  if (prismaModel && typeof prismaModel.updateMany === 'function') {
    await prismaModel.updateMany({
      where: {
        user_id: userId,
        used_at: null,
      },
      data: {
        used_at: new Date(),
      },
    });
    return;
  }

  // Fallback resiliente via SQL nativo
  await prisma.$executeRawUnsafe(
    `UPDATE password_resets SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL`,
    userId
  );
}
