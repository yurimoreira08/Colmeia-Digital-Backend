import { vi, type Mock } from 'vitest';

/**
 * Substituto do PrismaClient para os testes. Nenhum teste fala com o banco
 * (o banco do projeto é o de produção).
 *
 * Uso em um arquivo de teste:
 *   vi.mock('../../src/data/prisma.js', () => import('../helpers/prismaMock.js'));
 *   import { prisma as prismaMock, resetPrismaMock } from '../helpers/prismaMock.js';
 */

const MODEL_METHODS = [
  'findUnique',
  'findFirst',
  'findMany',
  'create',
  'update',
  'updateMany',
  'upsert',
  'delete',
  'deleteMany',
  'count',
  'aggregate',
] as const;

type ModelMock = Record<(typeof MODEL_METHODS)[number], Mock>;

const MODELS = [
  'user',
  'session',
  'passwordReset',
  'apiary',
  'box',
  'reviewReport',
  'manejo',
  'notification',
  'appConfig',
] as const;

type PrismaMock = Record<(typeof MODELS)[number], ModelMock> & {
  $connect: Mock;
  $disconnect: Mock;
  $transaction: Mock;
  $executeRawUnsafe: Mock;
  $queryRawUnsafe: Mock;
};

function createModelMock(): ModelMock {
  return Object.fromEntries(MODEL_METHODS.map((method) => [method, vi.fn()])) as ModelMock;
}

export const prisma = {
  ...Object.fromEntries(MODELS.map((model) => [model, createModelMock()])),
  $connect: vi.fn(),
  $disconnect: vi.fn(),
  $transaction: vi.fn(),
  $executeRawUnsafe: vi.fn(),
  $queryRawUnsafe: vi.fn(),
} as PrismaMock;

export default prisma;

/**
 * Zera todos os mocks e aplica respostas neutras (listas vazias, nada
 * encontrado), para que cada teste declare só o que importa para ele.
 */
export function resetPrismaMock(): void {
  for (const model of MODELS) {
    const modelMock = prisma[model];
    for (const method of MODEL_METHODS) {
      modelMock[method].mockReset();
    }
    modelMock.findUnique.mockResolvedValue(null);
    modelMock.findFirst.mockResolvedValue(null);
    modelMock.findMany.mockResolvedValue([]);
    modelMock.updateMany.mockResolvedValue({ count: 0 });
    modelMock.deleteMany.mockResolvedValue({ count: 0 });
    modelMock.count.mockResolvedValue(0);
  }
  prisma.$executeRawUnsafe.mockReset().mockResolvedValue(0);
  prisma.$queryRawUnsafe.mockReset().mockResolvedValue([]);
}
