import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/data/prisma.js', () => import('../helpers/prismaMock.js'));

import { createApp } from '../../src/app.js';
import { resetPrismaMock } from '../helpers/prismaMock.js';

beforeEach(() => {
  resetPrismaMock();
});

/**
 * GET /health/client-ip existe para conferir o TRUST_PROXY em produção:
 * o IP devolvido precisa ser o IP público de quem chamou. Nos testes, o
 * supertest conecta de 127.0.0.1, que faz o papel do proxy (TRUST_PROXY=1).
 */
describe('GET /api/v1/health/client-ip', () => {
  it('é público e devolve o IP do cliente informado pelo proxy', async () => {
    const response = await request(createApp()).get('/api/v1/health/client-ip').set('X-Forwarded-For', '203.0.113.9');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ip: '203.0.113.9' });
  });

  it('ignora IPs que o cliente tenta forjar à esquerda do X-Forwarded-For', async () => {
    // O proxy acrescenta o IP real no fim; o que vem antes foi escrito pelo cliente.
    const response = await request(createApp())
      .get('/api/v1/health/client-ip')
      .set('X-Forwarded-For', '198.51.100.1, 203.0.113.9');

    expect(response.body).toEqual({ ip: '203.0.113.9' });
  });
});
