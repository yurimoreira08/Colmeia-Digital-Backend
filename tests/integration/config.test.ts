import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/data/prisma.js', () => import('../helpers/prismaMock.js'));

import { createApp } from '../../src/app.js';
import { prisma as prismaMock, resetPrismaMock } from '../helpers/prismaMock.js';
import { authHeader, mockSessionsFor } from '../helpers/fixtures.js';

const USER_ID = 1;

beforeEach(() => {
  resetPrismaMock();
  mockSessionsFor(USER_ID);
});

describe('configuração global (/api/v1/config) não é acessível pela API', () => {
  it('POST não existe e não grava nada', async () => {
    const response = await request(createApp())
      .post('/api/v1/config')
      .set('Authorization', authHeader(USER_ID))
      .send({ key: 'test_data_enabled', value: '1' });

    expect(response.status).toBe(404);
    expect(prismaMock.appConfig.upsert).not.toHaveBeenCalled();
  });

  it('GET não existe', async () => {
    const response = await request(createApp())
      .get('/api/v1/config?key=test_data_enabled')
      .set('Authorization', authHeader(USER_ID));

    expect(response.status).toBe(404);
  });
});
