import { prisma as prismaMock } from './prismaMock.js';

/**
 * Banco em memória para os testes de autorização: apiários, caixas,
 * revisões, manejos e notificações, com os mocks do Prisma respeitando o
 * `where` como o banco faria (igualdade, `in`, comparações, `OR`/`AND`,
 * texto sem diferenciar maiúsculas e o filtro de relação `apiary: {...}`).
 *
 * Os testes verificam o efeito nas tabelas, e não a query montada: se uma
 * rota esquecer o filtro de dono, o registro de outro usuário é alterado de
 * verdade aqui e o teste falha.
 */

type Row = Record<string, unknown> & { id: number };
type Where = Record<string, unknown>;

export interface FakeDb {
  apiaries: Row[];
  boxes: Row[];
  reviewReports: Row[];
  manejos: Row[];
  notifications: Row[];
}

const now = () => new Date('2026-06-01T12:00:00Z');

function matchesValue(actual: unknown, condition: unknown): boolean {
  if (condition === null || typeof condition !== 'object' || condition instanceof Date) {
    return actual === condition || (actual instanceof Date && condition instanceof Date && actual.getTime() === condition.getTime());
  }
  const c = condition as Record<string, unknown>;
  const insensitive = c.mode === 'insensitive';
  const norm = (v: unknown) => (insensitive && typeof v === 'string' ? v.toLowerCase() : v);
  if ('equals' in c) return norm(actual) === norm(c.equals);
  if ('contains' in c) return String(norm(actual) ?? '').includes(String(norm(c.contains)));
  if ('in' in c) return (c.in as unknown[]).includes(actual);
  if ('not' in c) return !matchesValue(actual, c.not);
  if ('gt' in c) return (actual as number) > (c.gt as number);
  if ('gte' in c) return (actual as number) >= (c.gte as number);
  if ('lt' in c) return (actual as number) < (c.lt as number);
  if ('lte' in c) return (actual as number) <= (c.lte as number);
  return false;
}

function createMatcher(db: FakeDb) {
  const matches = (row: Row, where: Where | undefined): boolean => {
    if (!where) return true;
    return Object.entries(where).every(([field, condition]) => {
      if (condition === undefined) return true;
      if (field === 'OR') return (condition as Where[]).some((sub) => matches(row, sub));
      if (field === 'AND') return (condition as Where[]).every((sub) => matches(row, sub));
      if (field === 'NOT') return !matches(row, condition as Where);
      if (field === 'apiary') {
        // Filtro de relação: a caixa pertence a um apiário que atende ao filtro.
        const apiary = db.apiaries.find((a) => a.id === row.apiary_id);
        return Boolean(apiary) && matches(apiary as Row, condition as Where);
      }
      return matchesValue(row[field], condition);
    });
  };
  return matches;
}

/** Aplica `select`/`include` simples usados pelos repositórios. */
function project(db: FakeDb, model: keyof FakeDb, row: Row, args: Record<string, unknown> = {}): Row {
  const result: Row = { ...row };
  const include = args.include as Record<string, unknown> | undefined;
  if (include?.apiary) {
    result.apiary = db.apiaries.find((a) => a.id === row.apiary_id) ?? null;
  }
  if (include?._count && model === 'apiaries') {
    const countArgs = (include._count as { select: { boxes: boolean | { where?: Where } } }).select.boxes;
    const where = typeof countArgs === 'object' ? countArgs.where : undefined;
    const matches = createMatcher(db);
    result._count = { boxes: db.boxes.filter((b) => b.apiary_id === row.id && matches(b, where)).length };
  }
  const select = args.select as Record<string, boolean> | undefined;
  if (select) {
    return Object.fromEntries(Object.keys(select).filter((key) => select[key]).map((key) => [key, result[key]])) as Row;
  }
  return result;
}

function bindModel(db: FakeDb, model: keyof FakeDb, prismaName: keyof typeof prismaMock, defaults: () => Record<string, unknown>) {
  const table = db[model];
  const matches = createMatcher(db);
  const mock = prismaMock[prismaName] as unknown as Record<string, { mockImplementation: (fn: (...args: never[]) => unknown) => void }>;
  let nextId = Math.max(0, ...table.map((r) => r.id)) + 1;

  const find = (where?: Where) => table.filter((row) => matches(row, where));

  mock.findMany.mockImplementation(async (args: Record<string, unknown> = {}) =>
    find(args.where as Where).map((row) => project(db, model, row, args)),
  );
  mock.findFirst.mockImplementation(async (args: Record<string, unknown> = {}) => {
    const row = find(args.where as Where).at(0);
    return row ? project(db, model, row, args) : null;
  });
  mock.findUnique.mockImplementation(async (args: Record<string, unknown>) => {
    const row = find(args.where as Where).at(0);
    return row ? project(db, model, row, args) : null;
  });
  mock.count.mockImplementation(async (args: Record<string, unknown> = {}) => find(args.where as Where).length);
  mock.aggregate.mockImplementation(async (args: Record<string, unknown>) => {
    const field = Object.keys((args._max as Record<string, boolean>) ?? {})[0];
    const values = find(args.where as Where).map((row) => row[field] as number);
    return { _max: { [field]: values.length ? Math.max(...values) : null } };
  });
  mock.create.mockImplementation(async (args: Record<string, unknown>) => {
    const row = { ...defaults(), ...(args.data as Record<string, unknown>), id: nextId++ } as Row;
    table.push(row);
    return project(db, model, row, args);
  });
  mock.update.mockImplementation(async (args: Record<string, unknown>) => {
    // Como no Prisma real: update só pela chave única, sem outros filtros.
    const row = table.find((r) => r.id === (args.where as Where).id);
    if (!row) throw new Error('Registro não encontrado');
    Object.assign(row, args.data, { updated_at: now() });
    return project(db, model, row, args);
  });
  mock.updateMany.mockImplementation(async (args: Record<string, unknown>) => {
    const rows = find(args.where as Where);
    rows.forEach((row) => Object.assign(row, args.data, { updated_at: now() }));
    return { count: rows.length };
  });
  mock.deleteMany.mockImplementation(async (args: Record<string, unknown> = {}) => {
    const rows = find(args.where as Where);
    rows.forEach((row) => table.splice(table.indexOf(row), 1));
    return { count: rows.length };
  });
}

/**
 * Cria o banco em memória e liga os mocks do Prisma a ele.
 * `$transaction` executa a função com o próprio mock (sem isolamento real).
 */
export function useFakeDb(initial: Partial<FakeDb> = {}): FakeDb {
  const db: FakeDb = {
    apiaries: [...(initial.apiaries ?? [])].map((r) => ({ ...r })),
    boxes: [...(initial.boxes ?? [])].map((r) => ({ ...r })),
    reviewReports: [...(initial.reviewReports ?? [])].map((r) => ({ ...r })),
    manejos: [...(initial.manejos ?? [])].map((r) => ({ ...r })),
    notifications: [...(initial.notifications ?? [])].map((r) => ({ ...r })),
  };
  const timestamps = () => ({ created_at: now(), updated_at: now() });
  bindModel(db, 'apiaries', 'apiary', () => ({ ...timestamps(), description: '', box_count: 0 }));
  bindModel(db, 'boxes', 'box', () => ({ ...timestamps(), archived: false, user_id: null }));
  bindModel(db, 'reviewReports', 'reviewReport', () => ({ ...timestamps(), archived: false, client_uuid: null }));
  bindModel(db, 'manejos', 'manejo', () => ({ ...timestamps(), archived: false, client_uuid: null, photo_uri: null, revisao_id: null }));
  bindModel(db, 'notifications', 'notification', () => ({ created_at: now(), read: false }));
  // $transaction com rollback de verdade: se algo falha no meio, as tabelas
  // voltam ao estado anterior, como no Postgres.
  prismaMock.$transaction.mockImplementation(async (arg: unknown) => {
    const snapshot = structuredClone(db);
    try {
      return typeof arg === 'function' ? await (arg as (tx: unknown) => unknown)(prismaMock) : await Promise.all(arg as unknown[]);
    } catch (error) {
      for (const key of Object.keys(db) as Array<keyof FakeDb>) {
        db[key].splice(0, db[key].length, ...snapshot[key]);
      }
      throw error;
    }
  });
  return db;
}
