import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/data/prisma.js', () => import('../helpers/prismaMock.js'));
vi.mock('@supabase/supabase-js', () => import('../helpers/supabaseMock.js'));

import { createApp } from '../../src/app.js';
import { prisma as prismaMock, resetPrismaMock } from '../helpers/prismaMock.js';
import { useFakeDb, type FakeDb } from '../helpers/fakeDb.js';
import { authHeader, mockSessionsFor, TEST_PASSWORD, TEST_PASSWORD_HASH, userRow } from '../helpers/fixtures.js';
import { resetSupabaseMock, storedFiles } from '../helpers/supabaseMock.js';

/**
 * LGPD (Fase 4): o usuário exporta todos os seus dados e exclui a conta,
 * com tudo o que cadastrou e as fotos do storage.
 */
const OWNER = 1;
const OTHER = 2;
const created = new Date('2026-05-01T10:00:00Z');
let db: FakeDb;

const record = (id: number, apiaryId: number, boxId: number, userId: number, extra: Record<string, unknown> = {}) => ({
  id, client_uuid: null, user_id: userId, apiary_id: apiaryId, apiary_name: 'A', caixa_id: boxId, caixa_name: 'C', tipo: 'apiario',
  checked_options: '[]', observacoes: '', indicacoes: '', archived: false, created_at: created, updated_at: created, ...extra,
});

beforeEach(() => {
  resetPrismaMock();
  resetSupabaseMock();
  mockSessionsFor(OWNER, OTHER);
  vi.stubEnv('SUPABASE_URL', 'https://test-project.supabase.co');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-de-teste');
  prismaMock.user.findUnique.mockImplementation(async ({ where }: { where: { id: number } }) =>
    userRow({ id: where.id, email: `u${where.id}@example.com`, password_hash: TEST_PASSWORD_HASH }));
  db = useFakeDb({
    apiaries: [
      { id: 10, user_id: OWNER, client_uuid: null, name: 'Meu', location: 'T', box_count: 1, description: '', created_at: created, updated_at: created },
      { id: 20, user_id: OTHER, client_uuid: null, name: 'Alheio', location: 'P', box_count: 1, description: '', created_at: created, updated_at: created },
    ],
    boxes: [
      { id: 100, apiary_id: 10, user_id: OWNER, client_uuid: null, name: 'Caixa 01', position: 1, archived: true, created_at: created, updated_at: created },
      { id: 200, apiary_id: 20, user_id: OTHER, client_uuid: null, name: 'Caixa alheia', position: 1, archived: false, created_at: created, updated_at: created },
    ],
    reviewReports: [record(300, 10, 100, OWNER), record(301, 20, 200, OTHER)],
    manejos: [record(400, 10, 100, OWNER, { revisao_id: null, photo_uri: null }), record(401, 20, 200, OTHER, { revisao_id: null, photo_uri: null })],
    notifications: [{ id: 1, user_id: OWNER, title: 'Oi', subtitle: '', read: false, created_at: created }],
  });
  for (const path of ['manejos/1/a.jpg', 'manejos/1/b.jpg', 'profiles/1/eu.png', 'manejos/2/outro.jpg']) storedFiles.add(path);
});

const as = (userId: number, req: request.Test) => req.set('Authorization', authHeader(userId));

describe('DELETE /auth/account', () => {
  it('com a senha certa apaga a conta, tudo o que é dela e as fotos, sem tocar em outro usuário', async () => {
    const response = await as(OWNER, request(createApp()).delete('/api/v1/auth/account').send({ password: TEST_PASSWORD }));

    expect(response.status).toBe(200);
    expect(db.apiaries.map((a) => a.id)).toEqual([20]);
    expect(db.boxes.map((b) => b.id)).toEqual([200]);
    expect(db.reviewReports.map((r) => r.id)).toEqual([301]);
    expect(db.manejos.map((m) => m.id)).toEqual([401]);
    expect(db.notifications).toEqual([]);
    expect(prismaMock.session.deleteMany).toHaveBeenCalledWith({ where: { user_id: OWNER } });
    expect(prismaMock.user.deleteMany).toHaveBeenCalledWith({ where: { id: OWNER } });
    expect([...storedFiles]).toEqual(['manejos/2/outro.jpg']);
  });

  it('com a senha errada não apaga nada', async () => {
    const response = await as(OWNER, request(createApp()).delete('/api/v1/auth/account').send({ password: 'errada-123' }));

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Senha incorreta.');
    expect(db.apiaries).toHaveLength(2);
    expect(prismaMock.user.deleteMany).not.toHaveBeenCalled();
    expect(storedFiles.size).toBe(4);
  });

  it('sem senha: 422; sem login: 401', async () => {
    expect((await as(OWNER, request(createApp()).delete('/api/v1/auth/account').send({}))).status).toBe(422);
    expect((await request(createApp()).delete('/api/v1/auth/account').send({ password: TEST_PASSWORD })).status).toBe(401);
  });

  it('se o storage falhar, a conta sai do banco mesmo assim (as fotos ficam no log para limpeza)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubEnv('SUPABASE_URL', '');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
    vi.stubEnv('SUPABASE_ANON_KEY', '');

    const response = await as(OWNER, request(createApp()).delete('/api/v1/auth/account').send({ password: TEST_PASSWORD }));

    expect(response.status).toBe(200);
    expect(prismaMock.user.deleteMany).toHaveBeenCalled();
  });
});

describe('GET /auth/export', () => {
  it('devolve o perfil e tudo o que o usuário cadastrou, inclusive arquivados, sem hash nem dados de outro usuário', async () => {
    const response = await as(OWNER, request(createApp()).get('/api/v1/auth/export'));

    expect(response.status).toBe(200);
    expect(response.headers['content-disposition']).toContain('colmeia-digital-meus-dados.json');
    expect(response.body.user).toMatchObject({ id: OWNER, email: 'u1@example.com' });
    expect(response.body.apiaries.map((a: { id: number }) => a.id)).toEqual([10]);
    expect(response.body.boxes.map((b: { id: number }) => b.id)).toEqual([100]);
    expect(response.body.revisions.map((r: { id: number }) => r.id)).toEqual([300]);
    expect(response.body.manejos.map((m: { id: number }) => m.id)).toEqual([400]);
    expect(JSON.stringify(response.body)).not.toMatch(/password|Alheio|u2@example/i);
  });
});
