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
 * supertest conecta de 127.0.0.1, que faz o papel do proxy.
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
  it('pula os proxies internos do Render (rede privada 10.x) e chega no IP público do cliente', async () => {
    // Visto em produção: o Render tem pelo menos dois saltos internos em 10.0.0.0/8.
    const response = await request(createApp())
      .get('/api/v1/health/client-ip')
      .set('X-Forwarded-For', '203.0.113.9, 10.28.177.20');

    expect(response.body).toEqual({ ip: '203.0.113.9' });
  });

  it('não deixa o cliente forjar o IP mesmo com proxies internos no caminho', async () => {
    const response = await request(createApp())
      .get('/api/v1/health/client-ip')
      .set('X-Forwarded-For', '198.51.100.1, 203.0.113.9, 10.28.177.20');

    expect(response.body).toEqual({ ip: '203.0.113.9' });
  });
  it('pula também a borda do Cloudflare, que fica na frente do Render', async () => {
    // Visto em produção: cliente → Cloudflare (172.64.0.0/13) → proxies internos do Render (10.x).
    const response = await request(createApp())
      .get('/api/v1/health/client-ip')
      .set('X-Forwarded-For', '203.0.113.9, 172.71.10.20, 10.28.177.20');

    expect(response.body).toEqual({ ip: '203.0.113.9' });
  });

  it('pula a borda do Cloudflare em IPv6', async () => {
    const response = await request(createApp())
      .get('/api/v1/health/client-ip')
      .set('X-Forwarded-For', '203.0.113.9, 2606:4700::1, 10.28.177.20');

    expect(response.body).toEqual({ ip: '203.0.113.9' });
  });
});
