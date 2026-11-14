import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/data/prisma.js', () => import('../helpers/prismaMock.js'));

import { createApp } from '../../src/app.js';
import { prisma as prismaMock, resetPrismaMock } from '../helpers/prismaMock.js';
import { authHeader, mockSessionsFor } from '../helpers/fixtures.js';
import { useFakeDb } from '../helpers/fakeDb.js';

/**
 * Códigos de status (B10): criação responde 201 e edição 200. As rotas
 * antigas de aceite dos termos continuam, mas avisam que estão obsoletas.
 */
const OWNER = 1;
const created = new Date('2026-05-01T10:00:00Z');

beforeEach(() => {
  resetPrismaMock();
  mockSessionsFor(OWNER);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  useFakeDb({
    apiaries: [{ id: 10, user_id: OWNER, client_uuid: null, name: 'Sede', location: 'Teresina', box_count: 1, description: '', created_at: created, updated_at: created }],
    boxes: [{ id: 100, apiary_id: 10, user_id: OWNER, client_uuid: null, name: 'Caixa 01', position: 1, archived: false, created_at: created, updated_at: created }],
  });
  prismaMock.notification.create.mockImplementation(async ({ data }) => ({ id: 1, created_at: created, read: false, ...data }));
});

const as = (userId: number, req: request.Test) => req.set('Authorization', authHeader(userId));

describe('códigos de status (B10)', () => {
  it.each([
    ['/api/v1/apiaries', { name: 'Novo', location: 'Oeiras', boxCount: '1' }],
    ['/api/v1/boxes', { apiaryId: 10, name: 'Caixa 02', position: 2 }],
    ['/api/v1/revisions', { caixaId: 100, apiaryId: 10, checkedOptions: [] }],
    ['/api/v1/manejos', { caixaId: 100, apiaryId: 10, checkedOptions: [] }],
    ['/api/v1/notifications', { title: 'Aviso', subtitle: 'Texto' }],
  ])('POST %s que cria responde 201', async (path, body) => {
    const response = await as(OWNER, request(createApp()).post(path).send(body));

    expect(response.status).toBe(201);
  });

  it('POST /apiaries com id é edição: 200', async () => {
    const response = await as(OWNER, request(createApp()).post('/api/v1/apiaries').send({ id: 10, name: 'Sede nova', location: 'Teresina', boxCount: '1' }));

    expect(response.status).toBe(200);
  });

  it.each(['/api/v1/auth/accept-terms', '/api/v1/auth/terms'])('POST %s continua, mas avisa que está obsoleta', async (path) => {
    prismaMock.user.update.mockResolvedValue({ id: OWNER, name: 'A', email: 'a@example.com', password_hash: 'x', created_at: created, updated_at: created });
    prismaMock.user.findUnique.mockResolvedValue({ id: OWNER, name: 'A', email: 'a@example.com', password_hash: 'x', created_at: created, updated_at: created });

    const response = await as(OWNER, request(createApp()).post(path).send({ version: 'v1' }));

    expect(response.headers.deprecation).toBe('true');
    expect(response.headers.link).toBe('</api/v1/auth/accept-terms>; rel="successor-version"');
  });
});
