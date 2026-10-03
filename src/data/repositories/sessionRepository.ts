import { prisma } from '../prisma.js';

export interface SessionRecord {
  id: number;
  userId: number;
  tokenHash: string;
  deviceInfo?: string | null;
  expiresAt: Date;
  createdAt: Date;
}

export async function createSession(params: {
  userId: number;
  tokenHash: string;
  deviceInfo?: string;
  expiresAt: Date;
}): Promise<SessionRecord> {
  const session = await prisma.session.create({
    data: {
      user_id: params.userId,
      token_hash: params.tokenHash,
      device_info: params.deviceInfo || null,
      expires_at: params.expiresAt,
    },
  });

  return {
    id: session.id,
    userId: session.user_id,
    tokenHash: session.token_hash,
    deviceInfo: session.device_info,
    expiresAt: session.expires_at,
    createdAt: session.created_at,
  };
}

export async function findSessionByTokenHash(tokenHash: string): Promise<SessionRecord | null> {
  const session = await prisma.session.findUnique({
    where: { token_hash: tokenHash },
  });

  if (!session) return null;

  // Se expirada, remove e retorna null
  if (session.expires_at < new Date()) {
    await deleteSessionByTokenHash(tokenHash);
    return null;
  }

  return {
    id: session.id,
    userId: session.user_id,
    tokenHash: session.token_hash,
    deviceInfo: session.device_info,
    expiresAt: session.expires_at,
    createdAt: session.created_at,
  };
}

export async function deleteSessionByTokenHash(tokenHash: string): Promise<void> {
  await prisma.session.deleteMany({
    where: { token_hash: tokenHash },
  });
}

export async function deleteSessionsByUserId(userId: number): Promise<void> {
  await prisma.session.deleteMany({
    where: { user_id: userId },
  });
}

export async function clearActiveSession(tokenHash?: string, userId?: number): Promise<void> {
  if (tokenHash) {
    await deleteSessionByTokenHash(tokenHash);
  } else if (userId) {
    await deleteSessionsByUserId(userId);
  } else {
    await prisma.session.deleteMany({});
  }
}
