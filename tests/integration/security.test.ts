import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/data/prisma.js', () => import('../helpers/prismaMock.js'));

import { createApp } from '../../src/app.js';
import { resetPrismaMock } from '../helpers/prismaMock.js';
import { authHeader, mockSessionsFor } from '../helpers/fixtures.js';

/** Origem liberada em vitest.config.ts (CORS_ORIGINS). */
const ALLOWED_ORIGIN = 'https://painel.colmeiadigital.test';
const USER_ID = 1;

beforeEach(() => {
  resetPrismaMock();
  mockSessionsFor(USER_ID);
});

describe('headers de segurança', () => {
  it('aplica os headers do helmet e não anuncia o Express', async () => {
    const response = await request(createApp()).get('/api/v1/health');

    expect(response.status).toBe(200);
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['strict-transport-security']).toMatch(/max-age=\d+/);
    expect(response.headers['x-frame-options']).toBeDefined();
    expect(response.headers['content-security-policy']).toContain("default-src 'none'");
    expect(response.headers['x-powered-by']).toBeUndefined();
  });
});

describe('CORS', () => {
  it('não libera origens fora da lista configurada', async () => {
    const response = await request(createApp()).get('/api/v1/health').set('Origin', 'https://site-malicioso.example');

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('libera a origem configurada em CORS_ORIGINS', async () => {
    const response = await request(createApp()).get('/api/v1/health').set('Origin', ALLOWED_ORIGIN);

    expect(response.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);
  });

  it('continua atendendo o app nativo, que não envia Origin', async () => {
    const response = await request(createApp()).get('/api/v1/health');

    expect(response.status).toBe(200);
  });
});

describe('limites e erros do corpo da requisição', () => {
  it('recusa JSON acima de 1 MB nas rotas comuns com 413 em JSON', async () => {
    const response = await request(createApp())
      .post('/api/v1/apiaries')
      .set('Authorization', authHeader(USER_ID))
      .send({ name: 'x'.repeat(1024 * 1024 + 10), location: 'Teresina', boxCount: '1' });

    expect(response.status).toBe(413);
    expect(response.body).toEqual({ message: expect.any(String) });
  });

  it('responde JSON malformado com 400 em JSON, sem página HTML nem stack trace', async () => {
    const response = await request(createApp())
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": "um@example.com", "password": ');

    expect(response.status).toBe(400);
    expect(response.headers['content-type']).toMatch(/application\/json/);
    expect(response.body).toEqual({ message: 'Corpo da requisição inválido.' });
    expect(response.text).not.toMatch(/SyntaxError|at .*\.js/);
  });

  it('responde 404 em JSON para rotas inexistentes', async () => {
    const response = await request(createApp()).get('/api/v1/rota-que-nao-existe').set('Authorization', authHeader(USER_ID));

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: expect.any(String) });
  });
});
