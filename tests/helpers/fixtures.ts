import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma as prismaMock } from './prismaMock.js';

/** Senha usada pelos usuários de teste. */
export const TEST_PASSWORD = 'senha-de-teste-123';

/** Hash real (custo baixo para o teste ser rápido) da senha de teste. */
export const TEST_PASSWORD_HASH = bcrypt.hashSync(TEST_PASSWORD, 4);

/** Linha da tabela `users` como o Prisma devolve. */
export function userRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 1,
    name: 'Apicultora Um',
    email: 'um@example.com',
    password_hash: TEST_PASSWORD_HASH,
    photo: null,
    terms_accepted_at: new Date('2026-01-01T00:00:00Z'),
    terms_version: 'v1',
    terms_accepted_version: 'v1',
    created_at: new Date('2026-01-01T00:00:00Z'),
    updated_at: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

/** Linha da tabela `apiaries` como o Prisma devolve (com `_count`). */
export function apiaryRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 10,
    user_id: 1,
    name: 'Apiário Sede',
    location: 'Teresina',
    box_count: 3,
    description: '',
    created_at: new Date('2026-01-01T00:00:00Z'),
    updated_at: new Date('2026-01-01T00:00:00Z'),
    _count: { boxes: 3 },
    ...overrides,
  };
}

/** Token de sessão em texto puro usado no header `Authorization` dos testes. */
export function tokenFor(userId: number): string {
  return `token-de-teste-usuario-${userId}`;
}

/** Header `Authorization` pronto para o usuário informado. */
export function authHeader(userId: number): string {
  return `Bearer ${tokenFor(userId)}`;
}

/**
 * Faz o mock de `session.findUnique` reconhecer os tokens de `tokenFor(id)`
 * dos usuários informados. Qualquer outro token é tratado como inválido.
 */
export function mockSessionsFor(...userIds: number[]): void {
  const sessionsByHash = new Map(
    userIds.map((userId) => {
      const tokenHash = crypto.createHash('sha256').update(tokenFor(userId)).digest('hex');
      return [tokenHash, userId] as const;
    }),
  );

  prismaMock.session.findUnique.mockImplementation(async ({ where }: { where: { token_hash: string } }) => {
    const userId = sessionsByHash.get(where.token_hash);
    if (!userId) return null;
    return {
      id: userId,
      user_id: userId,
      token_hash: where.token_hash,
      device_info: null,
      expires_at: new Date(Date.now() + 60 * 60 * 1000),
      created_at: new Date(),
    };
  });
}
