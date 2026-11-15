import crypto from 'crypto';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/data/prisma.js', () => import('../helpers/prismaMock.js'));

import { createApp } from '../../src/app.js';
import { prisma as prismaMock, resetPrismaMock } from '../helpers/prismaMock.js';
import { authHeader, tokenFor } from '../helpers/fixtures.js';

/**
 * Sessão deslizante: quem usa o app não perde a sessão. Antes, o token valia
 * 30 dias a partir do login e depois o sync recebia 401 para sempre, com o
 * app funcionando offline e as pendências acumulando sem aviso.
 */
const DAY = 24 * 60 * 60 * 1000;
const tokenHash = crypto.createHash('sha256').update(tokenFor(1)).digest('hex');

function sessionExpiringIn(ms: number) {
  prismaMock.session.findUnique.mockResolvedValue({
    id: 7, user_id: 1, token_hash: tokenHash, device_info: null, expires_at: new Date(Date.now() + ms), created_at: new Date(),
  });
}

beforeEach(() => {
  resetPrismaMock();
  prismaMock.apiary.findMany.mockResolvedValue([]);
});

describe('renovação da sessão', () => {
  it('a sessão em uso é estendida por mais 30 dias', async () => {
    sessionExpiringIn(5 * DAY);

    const response = await request(createApp()).get('/api/v1/apiaries').set('Authorization', authHeader(1));

    expect(response.status).toBe(200);
    expect(prismaMock.session.updateMany).toHaveBeenCalledTimes(1);
    const { where, data } = prismaMock.session.updateMany.mock.calls[0][0];
    expect(where).toEqual({ id: 7 });
    expect(data.expires_at.getTime()).toBeGreaterThan(Date.now() + 29.9 * DAY);
  });

  it('renova no máximo uma vez por dia (não grava a cada requisição)', async () => {
    sessionExpiringIn(29.5 * DAY);

    await request(createApp()).get('/api/v1/apiaries').set('Authorization', authHeader(1));

    expect(prismaMock.session.updateMany).not.toHaveBeenCalled();
  });

  it('sessão vencida continua inválida (401) e é apagada', async () => {
    sessionExpiringIn(-DAY);

    const response = await request(createApp()).get('/api/v1/apiaries').set('Authorization', authHeader(1));

    expect(response.status).toBe(401);
    expect(prismaMock.session.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.session.deleteMany).toHaveBeenCalledWith({ where: { token_hash: tokenHash } });
  });
});
