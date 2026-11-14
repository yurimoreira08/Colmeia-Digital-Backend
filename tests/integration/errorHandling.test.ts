import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/data/prisma.js', () => import('../helpers/prismaMock.js'));

import { createApp } from '../../src/app.js';
import { prisma as prismaMock, resetPrismaMock } from '../helpers/prismaMock.js';
import { apiaryRow, authHeader, mockSessionsFor } from '../helpers/fixtures.js';

const USER_ID = 1;
const INTERNAL_DETAIL = 'Invalid `prisma.box.findFirst()` invocation: connection to db.secret-host.supabase.co refused';

beforeEach(() => {
  resetPrismaMock();
  mockSessionsFor(USER_ID);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const ownedApiary = apiaryRow({ id: 10, user_id: USER_ID });
  prismaMock.apiary.findFirst.mockImplementation(async ({ where }) =>
    where.id === ownedApiary.id && (where.user_id === undefined || where.user_id === USER_ID) ? ownedApiary : null,
  );
});

describe('tratamento central de erros', () => {
  it('erro de regra de negócio continua respondendo 400 com a mensagem', async () => {
    const response = await request(createApp())
      .post('/api/v1/boxes')
      .set('Authorization', authHeader(USER_ID))
      .send({ apiaryId: 10, name: 'a' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'Informe um nome valido para a caixa.' });
  });

  it('erro interno responde 500 genérico, sem detalhes do banco', async () => {
    prismaMock.box.findFirst.mockRejectedValue(new Error(INTERNAL_DETAIL));

    const response = await request(createApp())
      .post('/api/v1/boxes')
      .set('Authorization', authHeader(USER_ID))
      .send({ apiaryId: 10, name: 'Caixa 01' });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: expect.any(String) });
    expect(JSON.stringify(response.body)).not.toMatch(/prisma|supabase|secret/i);
  });

  it('falha interna em relatórios não expõe a mensagem do erro', async () => {
    prismaMock.apiary.findMany.mockRejectedValue(new Error(INTERNAL_DETAIL));

    const response = await request(createApp())
      .post('/api/v1/reports/stats')
      .set('Authorization', authHeader(USER_ID))
      .send({ fromIso: '2026-01-01T00:00:00Z', toIso: '2026-12-31T00:00:00Z', chartFilter: 'all' });

    expect(response.status).toBe(500);
    expect(JSON.stringify(response.body)).not.toMatch(/prisma|supabase|secret/i);
  });
});
