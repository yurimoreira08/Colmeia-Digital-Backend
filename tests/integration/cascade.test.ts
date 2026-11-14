import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/data/prisma.js', () => import('../helpers/prismaMock.js'));

import { createApp } from '../../src/app.js';
import { prisma as prismaMock, resetPrismaMock } from '../helpers/prismaMock.js';
import { authHeader, mockSessionsFor } from '../helpers/fixtures.js';
import { useFakeDb, type FakeDb } from '../helpers/fakeDb.js';

/**
 * Exclusões e arquivamentos em cascata (apiário → caixas → revisões/manejos):
 * tudo ou nada. O banco em memória faz rollback de verdade no $transaction.
 */
const OWNER = 1;
const created = new Date('2026-05-01T10:00:00Z');
let db: FakeDb;

const record = (id: number, extra: Record<string, unknown>) => ({
  id, client_uuid: null, apiary_id: 10, apiary_name: 'Sede', caixa_id: 100, caixa_name: 'Caixa 01', tipo: 'apiario',
  checked_options: '[]', observacoes: '', indicacoes: '', archived: false, created_at: created, updated_at: created, ...extra,
});

beforeEach(() => {
  resetPrismaMock();
  mockSessionsFor(OWNER);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  db = useFakeDb({
    apiaries: [{ id: 10, user_id: OWNER, name: 'Sede', location: 'Teresina', box_count: 1, description: '', created_at: created, updated_at: created }],
    boxes: [{ id: 100, apiary_id: 10, user_id: OWNER, name: 'Caixa 01', position: 1, archived: false, created_at: created, updated_at: created }],
    reviewReports: [
      record(200, { user_id: OWNER }),
      // Registros antigos, criados antes do user_id existir: também são do apiário.
      record(201, { user_id: null }),
    ],
    manejos: [record(300, { user_id: OWNER, revisao_id: null, photo_uri: null }), record(301, { user_id: null, revisao_id: null, photo_uri: null })],
  });
  prismaMock.notification.create.mockImplementation(async ({ data }) => ({ id: 1, created_at: created, read: false, ...data }));
});

const asOwner = (req: request.Test) => req.set('Authorization', authHeader(OWNER));

describe('excluir apiário', () => {
  it('remove o apiário, as caixas e todos os registros dele, inclusive os antigos sem user_id', async () => {
    const response = await asOwner(request(createApp()).delete('/api/v1/apiaries/10'));

    expect(response.status).toBe(200);
    expect(db.apiaries).toHaveLength(0);
    expect(db.boxes).toHaveLength(0);
    expect(db.reviewReports).toHaveLength(0);
    expect(db.manejos).toHaveLength(0);
  });

  it('não apaga nada se uma etapa falhar no meio', async () => {
    prismaMock.manejo.deleteMany.mockRejectedValueOnce(new Error('falha simulada no banco'));

    const response = await asOwner(request(createApp()).delete('/api/v1/apiaries/10'));

    expect(response.status).toBe(500);
    expect(db.apiaries).toHaveLength(1);
    expect(db.boxes).toHaveLength(1);
    expect(db.reviewReports).toHaveLength(2);
    expect(db.manejos).toHaveLength(2);
  });
});

describe('excluir caixa', () => {
  it('remove a caixa e todos os registros dela', async () => {
    const response = await asOwner(request(createApp()).delete('/api/v1/boxes/100'));

    expect(response.status).toBe(200);
    expect(db.boxes).toHaveLength(0);
    expect(db.reviewReports).toHaveLength(0);
    expect(db.manejos).toHaveLength(0);
  });

  it('não apaga nada se uma etapa falhar no meio', async () => {
    prismaMock.manejo.deleteMany.mockRejectedValueOnce(new Error('falha simulada no banco'));

    const response = await asOwner(request(createApp()).delete('/api/v1/boxes/100'));

    expect(response.status).toBe(500);
    expect(db.boxes).toHaveLength(1);
    expect(db.reviewReports).toHaveLength(2);
    expect(db.manejos).toHaveLength(2);
  });
});

describe('arquivar e desarquivar caixa', () => {
  it('arquiva a caixa e todos os registros dela', async () => {
    const response = await asOwner(request(createApp()).post('/api/v1/boxes/100/archive'));

    expect(response.status).toBe(200);
    expect(db.boxes[0].archived).toBe(true);
    expect(db.reviewReports.map((r) => r.archived)).toEqual([true, true]);
    expect(db.manejos.map((m) => m.archived)).toEqual([true, true]);
  });

  it('não arquiva nada se uma etapa falhar no meio', async () => {
    prismaMock.manejo.updateMany.mockRejectedValueOnce(new Error('falha simulada no banco'));

    const response = await asOwner(request(createApp()).post('/api/v1/boxes/100/archive'));

    expect(response.status).toBe(500);
    expect(db.boxes[0].archived).toBe(false);
    expect(db.reviewReports.map((r) => r.archived)).toEqual([false, false]);
  });

  it('não desarquiva nada se uma etapa falhar no meio', async () => {
    db.boxes[0].archived = true;
    db.reviewReports.forEach((r) => (r.archived = true));
    db.manejos.forEach((m) => (m.archived = true));
    prismaMock.manejo.updateMany.mockRejectedValueOnce(new Error('falha simulada no banco'));

    const response = await asOwner(request(createApp()).post('/api/v1/boxes/100/unarchive'));

    expect(response.status).toBe(500);
    expect(db.boxes[0].archived).toBe(true);
    expect(db.reviewReports.map((r) => r.archived)).toEqual([true, true]);
  });
});

describe('listagens escondem o que está arquivado', () => {
  it('sem includeArchived, só aparecem caixas, revisões e manejos ativos', async () => {
    db.boxes.push({ id: 101, apiary_id: 10, user_id: OWNER, name: 'Caixa arquivada', position: 2, archived: true, created_at: created, updated_at: created });
    db.reviewReports[1].archived = true;
    db.manejos[1].archived = true;
    const app = createApp();

    const boxes = await asOwner(request(app).get('/api/v1/boxes?apiaryId=10'));
    const reviews = await asOwner(request(app).get('/api/v1/revisions?apiaryId=10'));
    const manejos = await asOwner(request(app).get('/api/v1/manejos?apiaryId=10'));
    const allBoxes = await asOwner(request(app).get('/api/v1/boxes?apiaryId=10&includeArchived=true'));

    expect(boxes.body.map((b: { id: number }) => b.id)).toEqual([100]);
    expect(reviews.body.map((r: { id: number }) => r.id)).toEqual([200]);
    expect(manejos.body.map((m: { id: number }) => m.id)).toEqual([300]);
    expect(allBoxes.body.map((b: { id: number }) => b.id).sort()).toEqual([100, 101]);
    expect(allBoxes.body.find((b: { id: number }) => b.id === 101).archived).toBe(true);
  });

  it('a contagem de caixas do apiário ignora as arquivadas', async () => {
    db.boxes.push({ id: 101, apiary_id: 10, user_id: OWNER, name: 'Caixa arquivada', position: 2, archived: true, created_at: created, updated_at: created });

    const response = await asOwner(request(createApp()).get('/api/v1/apiaries'));

    expect(response.body[0].boxCount).toBe(1);
  });
});
