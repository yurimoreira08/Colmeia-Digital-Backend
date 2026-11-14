import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/data/prisma.js', () => import('../helpers/prismaMock.js'));

import { createApp } from '../../src/app.js';
import { prisma as prismaMock, resetPrismaMock } from '../helpers/prismaMock.js';
import { apiaryRow, authHeader, mockSessionsFor } from '../helpers/fixtures.js';

type ApiaryRow = ReturnType<typeof apiaryRow>;

/**
 * Tabela `apiaries` em memória. Os mocks se comportam como o Prisma real:
 * `update` altera pela chave primária, sem olhar o dono; `updateMany` e
 * `findFirst` aplicam todos os filtros do `where`. Assim o teste confere o
 * efeito no "banco", e não a forma como a query foi montada.
 */
function useApiaryTable(rows: ApiaryRow[]) {
  const matches = (row: ApiaryRow, where: Record<string, unknown>) =>
    Object.entries(where).every(([field, value]) =>
      typeof value === 'object' && value !== null ? true : row[field as keyof ApiaryRow] === value,
    );

  prismaMock.apiary.findFirst.mockImplementation(async ({ where }) => rows.find((row) => matches(row, where)) ?? null);
  prismaMock.apiary.update.mockImplementation(async ({ where, data }) => {
    const row = rows.find((candidate) => candidate.id === where.id);
    if (!row) throw new Error('Registro não encontrado');
    Object.assign(row, data);
    return row;
  });
  prismaMock.apiary.updateMany.mockImplementation(async ({ where, data }) => {
    const targets = rows.filter((row) => matches(row, where));
    targets.forEach((row) => Object.assign(row, data));
    return { count: targets.length };
  });
}

const OWNER_ID = 1;
const OTHER_USER_ID = 2;

describe('POST /api/v1/apiaries (atualização com id)', () => {
  let ownerApiary: ApiaryRow;

  beforeEach(() => {
    resetPrismaMock();
    mockSessionsFor(OWNER_ID, OTHER_USER_ID);
    ownerApiary = apiaryRow({ id: 10, user_id: OWNER_ID, name: 'Apiário Sede', location: 'Teresina' });
    useApiaryTable([ownerApiary]);
    prismaMock.notification.create.mockImplementation(async ({ data }) => ({ id: 1, created_at: new Date(), ...data }));
  });

  it('não deixa outro usuário alterar um apiário que não é dele', async () => {
    const response = await request(createApp())
      .post('/api/v1/apiaries')
      .set('Authorization', authHeader(OTHER_USER_ID))
      .send({ id: 10, name: 'Invadido', location: 'Outro lugar', boxCount: '1' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'Apiário não encontrado.' });
    expect(ownerApiary.name).toBe('Apiário Sede');
    expect(ownerApiary.location).toBe('Teresina');
  });

  it('permite que o dono altere o próprio apiário', async () => {
    const response = await request(createApp())
      .post('/api/v1/apiaries')
      .set('Authorization', authHeader(OWNER_ID))
      .send({ id: 10, name: 'Apiário Renomeado', location: 'Parnaíba', boxCount: '3' });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ id: 10, name: 'Apiário Renomeado', location: 'Parnaíba' });
    expect(ownerApiary.name).toBe('Apiário Renomeado');
  });

  it('exige autenticação', async () => {
    const response = await request(createApp())
      .post('/api/v1/apiaries')
      .send({ id: 10, name: 'Sem login', location: 'X', boxCount: '1' });

    expect(response.status).toBe(401);
    expect(ownerApiary.name).toBe('Apiário Sede');
  });
});
