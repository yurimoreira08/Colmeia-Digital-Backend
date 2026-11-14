import { prisma as prismaMock } from './prismaMock.js';
import { userRow } from './fixtures.js';

type UserRow = ReturnType<typeof userRow>;
type PasswordResetRow = {
  id: number;
  user_id: number;
  code_hash: string;
  expires_at: Date;
  used_at: Date | null;
  attempts: number;
  created_at: Date;
};

/** Conteúdo das tabelas em memória. Pode ser reaproveitado entre "reinícios" do servidor. */
export interface AuthTablesState {
  users: UserRow[];
  resets: PasswordResetRow[];
  nextUserId: number;
  nextResetId: number;
}

type ResetWhere = Partial<Pick<PasswordResetRow, 'id' | 'user_id' | 'code_hash' | 'used_at'>> & {
  expires_at?: { gt: Date };
};

/** Aplica um `where` do Prisma (igualdade e `gt` em datas) a uma linha de `password_resets`. */
function matchesReset(row: PasswordResetRow, where: ResetWhere): boolean {
  return Object.entries(where).every(([field, condition]) => {
    if (condition && typeof condition === 'object' && 'gt' in condition) {
      return (row[field as keyof PasswordResetRow] as Date) > condition.gt;
    }
    return row[field as keyof PasswordResetRow] === condition;
  });
}

/** Aplica `data` do Prisma, incluindo `{ increment: n }`. */
function applyData<T extends object>(row: T, data: Record<string, unknown>): void {
  for (const [field, value] of Object.entries(data)) {
    const target = row as Record<string, unknown>;
    if (value && typeof value === 'object' && 'increment' in value) {
      target[field] = Number(target[field] ?? 0) + Number((value as { increment: number }).increment);
    } else {
      target[field] = value;
    }
  }
}

/**
 * Tabelas `users`, `sessions` e `password_resets` em memória, com os mocks
 * do Prisma se comportando como o banco (filtros do `where` respeitados).
 * Permite testar fluxos completos de autenticação e verificar o efeito no
 * "banco" (ex.: o hash gravado), e não a query montada.
 *
 * @param state passe o estado de uma chamada anterior para simular um
 *   reinício do servidor: o "banco" continua o mesmo, a memória do processo não.
 */
export function useAuthTables(initialUsers: UserRow[] = [], state?: AuthTablesState): AuthTablesState {
  const tables: AuthTablesState = state ?? {
    users: initialUsers.map((user) => ({ ...user })),
    resets: [],
    nextUserId: 100,
    nextResetId: 1,
  };
  const { users, resets } = tables;

  const findUser = (where: { id?: number; email?: string }) =>
    users.find((user) => (where.id !== undefined ? user.id === where.id : user.email === where.email)) ?? null;

  prismaMock.user.findUnique.mockImplementation(async ({ where }) => findUser(where));
  prismaMock.user.findFirst.mockImplementation(async ({ where }) => {
    const wanted = String(where?.name?.equals ?? '').toLowerCase();
    return users.find((user) => String(user.name).toLowerCase() === wanted) ?? null;
  });
  prismaMock.user.create.mockImplementation(async ({ data }) => {
    const row = userRow({ ...data, id: tables.nextUserId++ });
    users.push(row);
    return row;
  });
  prismaMock.user.update.mockImplementation(async ({ where, data }) => {
    const row = findUser(where);
    if (!row) throw new Error('Registro não encontrado');
    applyData(row, data);
    return row;
  });

  prismaMock.session.create.mockImplementation(async ({ data }) => ({ id: 1, created_at: new Date(), ...data }));
  prismaMock.session.deleteMany.mockResolvedValue({ count: 0 });

  prismaMock.passwordReset.create.mockImplementation(async ({ data }) => {
    const row: PasswordResetRow = { id: tables.nextResetId++, used_at: null, attempts: 0, created_at: new Date(), ...data };
    resets.push(row);
    return row;
  });
  prismaMock.passwordReset.findFirst.mockImplementation(
    async ({ where }) => resets.filter((reset) => matchesReset(reset, where)).at(-1) ?? null,
  );
  prismaMock.passwordReset.update.mockImplementation(async ({ where, data }) => {
    const row = resets.find((reset) => reset.id === where.id);
    if (row) applyData(row, data);
    return row;
  });
  prismaMock.passwordReset.updateMany.mockImplementation(async ({ where, data }) => {
    const targets = resets.filter((reset) => matchesReset(reset, where));
    targets.forEach((reset) => applyData(reset, data));
    return { count: targets.length };
  });

  return tables;
}
