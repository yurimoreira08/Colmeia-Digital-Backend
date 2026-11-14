import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/data/prisma.js', () => import('../helpers/prismaMock.js'));
vi.mock('../../src/services/emailService.js', () => ({ sendPasswordResetEmail: vi.fn(async () => true), sendEmail: vi.fn() }));

import { createApp } from '../../src/app.js';
import { resetPrismaMock } from '../helpers/prismaMock.js';
import { TEST_PASSWORD, userRow } from '../helpers/fixtures.js';
import { useAuthTables } from '../helpers/userTable.js';

const RATE_LIMIT_MESSAGE = /Muitas tentativas/;

beforeEach(() => {
  resetPrismaMock();
  useAuthTables([userRow({ id: 1, email: 'um@example.com' }), userRow({ id: 2, email: 'dois@example.com', name: 'Dois' })]);
});

describe('limite de tentativas em /auth', () => {
  it('não conta logins bem-sucedidos (vários usuários atrás do mesmo IP de operadora)', async () => {
    const app = createApp();
    for (let attempt = 1; attempt <= 12; attempt += 1) {
      const response = await request(app).post('/api/v1/auth/login').send({ email: 'um@example.com', password: TEST_PASSWORD });
      expect(response.status).toBe(200);
    }
    // 12 logins com bcrypt custo 12 levam alguns segundos.
  }, 20_000);

  it('bloqueia o login depois de 10 tentativas erradas do mesmo IP em 15 minutos', async () => {
    const app = createApp();
    for (let attempt = 1; attempt <= 10; attempt += 1) {
      const response = await request(app).post('/api/v1/auth/login').send({ email: 'um@example.com', password: 'errada-123' });
      expect(response.status).toBe(400);
    }

    const blocked = await request(app).post('/api/v1/auth/login').send({ email: 'um@example.com', password: TEST_PASSWORD });

    expect(blocked.status).toBe(429);
    expect(blocked.body.message).toMatch(RATE_LIMIT_MESSAGE);
  });

  it('limita pedidos de código de recuperação por e-mail, sem afetar outros e-mails', async () => {
    const app = createApp();
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const response = await request(app).post('/api/v1/auth/forgot-password').send({ email: 'um@example.com' });
      expect(response.status).toBe(200);
    }

    const blocked = await request(app).post('/api/v1/auth/forgot-password').send({ email: 'UM@example.com ' });
    const otherEmail = await request(app).post('/api/v1/auth/forgot-password').send({ email: 'dois@example.com' });

    expect(blocked.status).toBe(429);
    expect(blocked.body.message).toMatch(RATE_LIMIT_MESSAGE);
    expect(otherEmail.status).toBe(200);
  });

  it('informa quando tentar de novo (header RateLimit)', async () => {
    const response = await request(createApp()).post('/api/v1/auth/login').send({ email: 'um@example.com', password: TEST_PASSWORD });

    expect(response.headers['ratelimit-limit'] ?? response.headers['ratelimit']).toBeDefined();
  });
});

describe('limite geral da API', () => {
  // Alto de propósito: o sync do app faz uma requisição por registro pendente.
  it('bloqueia a partir da 1001ª requisição do mesmo IP em 15 minutos', async () => {
    const app = createApp();
    for (let attempt = 1; attempt <= 1000; attempt += 1) {
      const response = await request(app).get('/api/v1/health');
      expect(response.status).toBe(200);
    }

    const blocked = await request(app).get('/api/v1/health');

    expect(blocked.status).toBe(429);
    // 1000 requisições sequenciais levam alguns segundos com a suíte rodando em paralelo.
  }, 30_000);
});
