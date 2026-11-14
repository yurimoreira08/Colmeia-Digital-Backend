import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/data/prisma.js', () => import('../helpers/prismaMock.js'));
vi.mock('../../src/services/emailService.js', () => ({ sendPasswordResetEmail: vi.fn(), sendEmail: vi.fn() }));

import { createApp } from '../../src/app.js';
import { prisma as prismaMock, resetPrismaMock } from '../helpers/prismaMock.js';
import { TEST_PASSWORD, TEST_PASSWORD_HASH, authHeader, mockSessionsFor, userRow } from '../helpers/fixtures.js';

/** Falha se o hash da senha aparecer em qualquer lugar da resposta. */
function expectNoPasswordHash(body: unknown): void {
  const serialized = JSON.stringify(body);
  expect(serialized).not.toContain('passwordHash');
  expect(serialized).not.toContain('password_hash');
  expect(serialized).not.toContain(TEST_PASSWORD_HASH);
}

const USER_ID = 1;

beforeEach(() => {
  resetPrismaMock();
  mockSessionsFor(USER_ID);
  const row = userRow({ id: USER_ID });
  prismaMock.user.findUnique.mockImplementation(async ({ where }) =>
    where.id === row.id || where.email === row.email ? row : null,
  );
  prismaMock.user.update.mockImplementation(async ({ data }) => ({ ...row, ...data }));
  prismaMock.user.create.mockImplementation(async ({ data }) => ({ ...row, id: 99, ...data }));
  prismaMock.session.create.mockImplementation(async ({ data }) => ({ id: 1, created_at: new Date(), ...data }));
});

describe('respostas de autenticação não expõem o hash da senha', () => {
  it('POST /auth/login', async () => {
    const response = await request(createApp())
      .post('/api/v1/auth/login')
      .send({ email: 'um@example.com', password: TEST_PASSWORD });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ id: USER_ID, email: 'um@example.com' });
    expect(typeof response.body.token).toBe('string');
    expectNoPasswordHash(response.body);
  });

  it('POST /auth/register', async () => {
    const response = await request(createApp())
      .post('/api/v1/auth/register')
      .send({ name: 'Nova Pessoa', email: 'nova@example.com', password: TEST_PASSWORD });

    expect(response.status).toBe(201);
    expect(typeof response.body.token).toBe('string');
    expectNoPasswordHash(response.body);
  });

  it('GET /auth/me', async () => {
    const response = await request(createApp()).get('/api/v1/auth/me').set('Authorization', authHeader(USER_ID));

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ id: USER_ID });
    expectNoPasswordHash(response.body);
  });

  it('PUT /auth/profile', async () => {
    const response = await request(createApp())
      .put('/api/v1/auth/profile')
      .set('Authorization', authHeader(USER_ID))
      .send({ name: 'Apicultora Um', email: 'um@example.com' });

    expect(response.status).toBe(200);
    expectNoPasswordHash(response.body);
  });

  it('PATCH /auth/accept-terms', async () => {
    const response = await request(createApp())
      .patch('/api/v1/auth/accept-terms')
      .set('Authorization', authHeader(USER_ID))
      .send({ version: 'v1' });

    expect(response.status).toBe(200);
    expectNoPasswordHash(response.body);
  });
});

describe('POST /auth/login não revela se o e-mail existe', () => {
  it('responde a mesma mensagem para e-mail inexistente e senha errada', async () => {
    const app = createApp();
    const unknownEmail = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'ninguem@example.com', password: TEST_PASSWORD });
    const wrongPassword = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'um@example.com', password: 'senha-errada' });

    expect(unknownEmail.status).toBe(400);
    expect(wrongPassword.status).toBe(400);
    expect(unknownEmail.body).toEqual({ message: 'E-mail ou senha inválidos.' });
    expect(wrongPassword.body).toEqual(unknownEmail.body);
  });
});
