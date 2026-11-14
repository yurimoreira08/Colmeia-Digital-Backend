import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/data/prisma.js', () => import('../helpers/prismaMock.js'));
vi.mock('@supabase/supabase-js', () => import('../helpers/supabaseMock.js'));

import { createApp } from '../../src/app.js';
import { storagePathFromUrl, toStoredPhotoUrl } from '../../src/services/storageService.js';
import { useFakeDb, type FakeDb } from '../helpers/fakeDb.js';
import { authHeader, mockSessionsFor } from '../helpers/fixtures.js';
import { prisma as prismaMock, resetPrismaMock } from '../helpers/prismaMock.js';
import { IMAGE_SIGNATURES, resetSupabaseMock } from '../helpers/supabaseMock.js';

/**
 * Fotos em bucket privado (Fase 4): com STORAGE_PRIVATE=true as respostas
 * trazem URLs assinadas, e o banco guarda sempre a URL sem prazo.
 */
const OWNER = 1;
const created = new Date('2026-05-01T10:00:00Z');
const BASE = 'https://test-project.supabase.co/storage/v1/object';
const STORED = `${BASE}/public/colmeia-digital/manejos/1/foto.jpg`;
const SIGNED = `${BASE}/sign/colmeia-digital/manejos/1/foto.jpg?token=t&ttl=2592000`;
let db: FakeDb;

beforeEach(() => {
  resetPrismaMock();
  resetSupabaseMock();
  mockSessionsFor(OWNER);
  vi.stubEnv('SUPABASE_URL', 'https://test-project.supabase.co');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-de-teste');
  vi.stubEnv('STORAGE_PRIVATE', 'true');
  vi.stubEnv('SUPABASE_BUCKET_NAME', 'colmeia-digital');
  db = useFakeDb({
    apiaries: [{ id: 10, user_id: OWNER, client_uuid: null, name: 'Sede', location: 'T', box_count: 1, description: '', created_at: created, updated_at: created }],
    boxes: [{ id: 100, apiary_id: 10, user_id: OWNER, client_uuid: null, name: 'Caixa 01', position: 1, archived: false, created_at: created, updated_at: created }],
    manejos: [{
      id: 400, client_uuid: null, user_id: OWNER, apiary_id: 10, apiary_name: 'Sede', caixa_id: 100, caixa_name: 'Caixa 01', tipo: 'apiario',
      checked_options: '[]', observacoes: '', indicacoes: '', archived: false, revisao_id: null, photo_uri: STORED, created_at: created, updated_at: created,
    }],
  });
});

afterEach(() => vi.unstubAllEnvs());

const as = (req: request.Test) => req.set('Authorization', authHeader(OWNER));

describe('URLs do bucket', () => {
  it('reconhece URL pública e assinada do nosso bucket, e só dele', () => {
    expect(storagePathFromUrl(STORED)).toBe('manejos/1/foto.jpg');
    expect(storagePathFromUrl(SIGNED)).toBe('manejos/1/foto.jpg');
    expect(storagePathFromUrl(`${BASE}/public/outro-bucket/x.jpg`)).toBeNull();
    expect(storagePathFromUrl('file:///foto.jpg')).toBeNull();
  });

  it('a forma guardada é a URL sem token', () => {
    expect(toStoredPhotoUrl(SIGNED)).toBe(STORED);
    expect(toStoredPhotoUrl('https://outro.example/x.jpg')).toBe('https://outro.example/x.jpg');
  });
});

describe('com o bucket privado', () => {
  it('as listagens e o pull trazem URLs assinadas', async () => {
    const list = await as(request(createApp()).get('/api/v1/manejos').query({ includeArchived: 'true' }));
    const changes = await as(request(createApp()).get('/api/v1/sync/changes'));

    expect(list.body[0].photoUri).toBe(SIGNED);
    expect(changes.body.manejos[0].photoUri).toBe(SIGNED);
    expect(db.manejos[0].photo_uri).toBe(STORED);
  });

  it('salvar com a URL assinada que o app recebeu guarda a URL sem prazo', async () => {
    const response = await as(request(createApp()).put('/api/v1/manejos/400').send({ checkedOptions: [], photoUri: SIGNED }));

    expect(response.status).toBe(200);
    expect(db.manejos[0].photo_uri).toBe(STORED);
  });

  it('o upload devolve a URL assinada, para o app mostrar a foto na hora', async () => {
    const response = await as(request(createApp()).post('/api/v1/upload/manejo-photo').attach('photo', IMAGE_SIGNATURES.jpeg, 'foto.jpg'));

    expect(response.status).toBe(200);
    expect(response.body.url).toContain('/object/sign/colmeia-digital/manejos/1/');
  });

  it('a foto de perfil sai assinada e é guardada sem prazo', async () => {
    const user = { id: OWNER, name: 'Ana', email: 'ana@example.com', password_hash: 'x', photo: STORED, created_at: created, updated_at: created };
    prismaMock.user.findUnique.mockResolvedValue(user);
    prismaMock.user.findFirst.mockResolvedValue(null);
    prismaMock.user.update.mockImplementation(async ({ data }) => ({ ...user, ...data }));

    const me = await as(request(createApp()).get('/api/v1/auth/me'));
    await as(request(createApp()).put('/api/v1/auth/profile').send({ name: 'Ana', email: 'ana@example.com', photo: SIGNED }));

    expect(me.body.photo).toBe(SIGNED);
    expect(prismaMock.user.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ photo: STORED }) }));
  });
});

describe('com o bucket público (padrão)', () => {
  it('as URLs saem como estão no banco', async () => {
    vi.stubEnv('STORAGE_PRIVATE', 'false');

    const list = await as(request(createApp()).get('/api/v1/manejos').query({ includeArchived: 'true' }));

    expect(list.body[0].photoUri).toBe(STORED);
  });
});
