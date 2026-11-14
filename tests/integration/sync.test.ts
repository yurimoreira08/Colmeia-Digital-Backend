import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/data/prisma.js', () => import('../helpers/prismaMock.js'));

import { createApp } from '../../src/app.js';
import { prisma as prismaMock, resetPrismaMock } from '../helpers/prismaMock.js';
import { authHeader, mockSessionsFor } from '../helpers/fixtures.js';
import { useFakeDb, type FakeDb } from '../helpers/fakeDb.js';

/**
 * Sync (F3): registro das exclusões feitas no servidor, pull incremental
 * (GET /sync/changes) e envio em lote (POST /sync).
 */
const OWNER = 1;
const OTHER = 2;
const created = new Date('2026-05-01T10:00:00Z');
let db: FakeDb;

const record = (id: number, extra: Record<string, unknown>) => ({
  id, client_uuid: null, apiary_id: 10, apiary_name: 'Sede', caixa_id: 100, caixa_name: 'Caixa 01', tipo: 'apiario',
  checked_options: '[]', observacoes: '', indicacoes: '', archived: false, created_at: created, updated_at: created, ...extra,
});

beforeEach(() => {
  resetPrismaMock();
  mockSessionsFor(OWNER, OTHER);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  db = useFakeDb({
    apiaries: [
      { id: 10, user_id: OWNER, client_uuid: null, name: 'Sede', location: 'Teresina', box_count: 1, description: '', created_at: created, updated_at: created },
      { id: 20, user_id: OTHER, client_uuid: null, name: 'Alheio', location: 'Picos', box_count: 1, description: '', created_at: created, updated_at: created },
    ],
    boxes: [
      { id: 100, apiary_id: 10, user_id: OWNER, client_uuid: null, name: 'Caixa 01', position: 1, archived: false, created_at: created, updated_at: created },
      { id: 200, apiary_id: 20, user_id: OTHER, client_uuid: null, name: 'Caixa alheia', position: 1, archived: false, created_at: created, updated_at: created },
    ],
    reviewReports: [record(300, { user_id: OWNER })],
    manejos: [record(400, { user_id: OWNER, revisao_id: null, photo_uri: null })],
  });
  prismaMock.notification.create.mockImplementation(async ({ data }) => ({ id: 1, created_at: created, read: false, ...data }));
});

const as = (userId: number, req: request.Test) => req.set('Authorization', authHeader(userId));
const tombstones = () => db.deletedRecords.map((r) => ({ user_id: r.user_id, entity: r.entity, record_id: r.record_id }));

describe('exclusões ficam registradas para os outros aparelhos', () => {
  it.each([
    ['/api/v1/apiaries/10', 'apiaries', 10],
    ['/api/v1/boxes/100', 'boxes', 100],
    ['/api/v1/revisions/300', 'review_reports', 300],
    ['/api/v1/manejos/400', 'manejos', 400],
  ])('DELETE %s', async (path, entity, id) => {
    const response = await as(OWNER, request(createApp()).delete(path));

    expect(response.status).toBe(200);
    expect(tombstones()).toEqual([{ user_id: OWNER, entity, record_id: id }]);
  });

  it('a exclusão que falha não deixa registro', async () => {
    prismaMock.manejo.deleteMany.mockRejectedValueOnce(new Error('falha simulada no banco'));

    const response = await as(OWNER, request(createApp()).delete('/api/v1/apiaries/10'));

    expect(response.status).toBe(500);
    expect(tombstones()).toEqual([]);
    expect(db.apiaries).toHaveLength(2);
  });
});

describe('GET /sync/changes', () => {
  const later = new Date('2026-06-10T10:00:00Z');

  it('sem since: tudo do usuário, nada de outro usuário', async () => {
    const response = await as(OWNER, request(createApp()).get('/api/v1/sync/changes'));

    expect(response.status).toBe(200);
    expect(response.body.full).toBe(true);
    expect(response.body.apiaries.map((a: { id: number }) => a.id)).toEqual([10]);
    expect(response.body.boxes.map((b: { id: number }) => b.id)).toEqual([100]);
    expect(response.body.revisions.map((r: { id: number }) => r.id)).toEqual([300]);
    expect(response.body.manejos.map((m: { id: number }) => m.id)).toEqual([400]);
    expect(response.body.deletions).toEqual([]);
    expect(Date.parse(response.body.serverTime)).not.toBeNaN();
  });

  it('com since: só o que mudou depois (com margem) e as exclusões do período', async () => {
    db.boxes[0].updated_at = later;
    db.boxes[0].archived = true;
    db.deletedRecords.push({ id: 1, user_id: OWNER, entity: 'manejos', record_id: 401, deleted_at: later });
    db.deletedRecords.push({ id: 2, user_id: OTHER, entity: 'boxes', record_id: 201, deleted_at: later });

    const response = await as(OWNER, request(createApp()).get('/api/v1/sync/changes').query({ since: '2026-06-01T00:00:00.000Z' }));

    expect(response.status).toBe(200);
    expect(response.body.full).toBe(false);
    expect(response.body.apiaries).toEqual([]);
    // Arquivados também vêm: o app precisa saber que a caixa foi arquivada.
    expect(response.body.boxes).toEqual([expect.objectContaining({ id: 100, archived: true })]);
    expect(response.body.revisions).toEqual([]);
    expect(response.body.deletions).toEqual([{ entity: 'manejos', id: 401, deletedAt: later.toISOString() }]);
  });

  it('a margem repete o que mudou pouco antes do since', async () => {
    db.apiaries[0].updated_at = new Date('2026-06-01T11:59:00Z');

    const response = await as(OWNER, request(createApp()).get('/api/v1/sync/changes').query({ since: '2026-06-01T12:00:00.000Z' }));

    expect(response.body.apiaries.map((a: { id: number }) => a.id)).toEqual([10]);
  });

  it('since inválido: 422', async () => {
    const response = await as(OWNER, request(createApp()).get('/api/v1/sync/changes').query({ since: 'ontem' }));

    expect(response.status).toBe(422);
  });

  it('sem login: 401', async () => {
    const response = await request(createApp()).get('/api/v1/sync/changes');

    expect(response.status).toBe(401);
  });
});

describe('POST /sync', () => {
  const push = (body: Record<string, unknown>, userId = OWNER) => as(userId, request(createApp()).post('/api/v1/sync').send(body));
  const newChain = {
    apiaries: [{ localId: -1, clientUuid: 'ap-1', name: 'Novo apiário', location: 'Oeiras', boxCount: '1', description: '' }],
    boxes: [{ localId: -2, clientUuid: 'cx-1', apiaryId: -1, name: 'Caixa 01', position: 1 }],
    revisions: [{ localId: -3, clientUuid: 'rev-1', caixaId: -2, apiaryId: -1, caixaName: 'Caixa 01', apiaryName: 'Novo apiário', checkedOptions: ['mel'] }],
    manejos: [{ localId: -4, clientUuid: 'man-1', caixaId: -2, apiaryId: -1, revisaoId: -3, checkedOptions: [{ id: 'alimentacao', obs: '', ind: '' }] }],
  };

  it('cria apiário, caixa, revisão e manejo de uma vez, ligando os ids locais', async () => {
    const response = await push(newChain);

    expect(response.status).toBe(200);
    const [apiary] = response.body.apiaries;
    const [box] = response.body.boxes;
    const [revision] = response.body.revisions;
    const [manejo] = response.body.manejos;
    expect([apiary.status, box.status, revision.status, manejo.status]).toEqual(['created', 'created', 'created', 'created']);
    expect(apiary.localId).toBe(-1);

    expect(db.boxes.find((b) => b.id === box.id)).toMatchObject({ apiary_id: apiary.id, client_uuid: 'cx-1' });
    expect(db.apiaries.find((a) => a.id === apiary.id)).toMatchObject({ user_id: OWNER, client_uuid: 'ap-1' });
    expect(db.reviewReports.find((r) => r.id === revision.id)).toMatchObject({ caixa_id: box.id, apiary_id: apiary.id });
    expect(db.manejos.find((m) => m.id === manejo.id)).toMatchObject({ caixa_id: box.id, revisao_id: revision.id });
  });

  it('reenviar o mesmo lote não duplica nada', async () => {
    const first = await push(newChain);
    const counts = () => [db.apiaries.length, db.boxes.length, db.reviewReports.length, db.manejos.length];
    const before = counts();

    const second = await push(newChain);

    expect(counts()).toEqual(before);
    expect(second.body.apiaries[0].id).toBe(first.body.apiaries[0].id);
    expect(second.body.boxes[0].id).toBe(first.body.boxes[0].id);
    expect(second.body.revisions[0].id).toBe(first.body.revisions[0].id);
  });

  it('alteração sem conflito é aplicada (renomear e arquivar a caixa)', async () => {
    const response = await push({ boxes: [{ localId: 100, id: 100, apiaryId: 10, name: 'Caixa renomeada', archived: true, baseUpdatedAt: created.toISOString() }] });

    expect(response.body.boxes).toEqual([{ localId: 100, status: 'updated', id: 100 }]);
    expect(db.boxes.find((b) => b.id === 100)).toMatchObject({ name: 'Caixa renomeada', archived: true });
  });

  it('conflito: o registro mudou no servidor depois que o aparelho o baixou', async () => {
    db.reviewReports[0].updated_at = new Date('2026-06-10T10:00:00Z');
    db.reviewReports[0].observacoes = 'Editado no outro aparelho';

    const response = await push({
      revisions: [{ localId: 300, id: 300, caixaId: 100, apiaryId: 10, observacoes: 'Editado neste aparelho', checkedOptions: [], baseUpdatedAt: created.toISOString() }],
    });

    const [result] = response.body.revisions;
    expect(result.status).toBe('conflict');
    expect(result.server).toMatchObject({ id: 300, observacoes: 'Editado no outro aparelho' });
    expect(db.reviewReports[0].observacoes).toBe('Editado no outro aparelho');
  });

  describe('posse (IDOR)', () => {
    it('não altera, não cria em nem exclui registros de outro usuário', async () => {
      const response = await push({
        deletions: [{ entity: 'boxes', id: 200 }],
        apiaries: [{ localId: 20, id: 20, name: 'Tomado', location: 'X', boxCount: '1' }],
        boxes: [
          { localId: 200, id: 200, apiaryId: 20, name: 'Tomada' },
          { localId: -5, apiaryId: 20, name: 'Intrusa' },
        ],
        revisions: [{ localId: -6, caixaId: 200, apiaryId: 20, checkedOptions: [] }],
      });

      expect(response.status).toBe(200);
      expect(response.body.deletions[0]).toMatchObject({ status: 'rejected' });
      expect(response.body.apiaries[0]).toMatchObject({ status: 'rejected', message: 'Este registro pertence a outro usuário.' });
      expect(response.body.boxes.map((b: { status: string }) => b.status)).toEqual(['rejected', 'rejected']);
      expect(response.body.revisions[0].status).toBe('rejected');
      expect(db.apiaries.find((a) => a.id === 20)!.name).toBe('Alheio');
      expect(db.boxes.filter((b) => b.apiary_id === 20).map((b) => b.name)).toEqual(['Caixa alheia']);
      expect(db.reviewReports).toHaveLength(1);
    });

    it('caixa própria com apiário de outro usuário é recusada (S19)', async () => {
      const response = await push({ revisions: [{ localId: -7, caixaId: 100, apiaryId: 20, checkedOptions: [] }] });

      expect(response.body.revisions[0]).toMatchObject({ status: 'rejected', message: 'A caixa informada não pertence a este apiário.' });
    });

    it('reenvio com o client_uuid de um registro de outro usuário não devolve esse registro', async () => {
      db.reviewReports.push(record(301, { user_id: OTHER, apiary_id: 20, caixa_id: 200, client_uuid: 'uuid-alheio', observacoes: 'segredo' }));

      const response = await push({ revisions: [{ localId: -8, clientUuid: 'uuid-alheio', caixaId: 100, apiaryId: 10, checkedOptions: [] }] });

      expect(response.body.revisions[0]).toEqual({ localId: -8, status: 'rejected', message: 'Este registro já foi enviado por outra conta.' });
      expect(JSON.stringify(response.body)).not.toContain('segredo');
    });
  });

  it('filho de um pai recusado é recusado; o resto do lote segue', async () => {
    const response = await push({
      apiaries: [{ localId: -1, name: 'A', location: 'B', boxCount: 'abc' }],
      boxes: [
        { localId: -2, apiaryId: -1, name: 'Órfã' },
        { localId: -3, apiaryId: 10, name: 'Caixa 02', position: 2 },
      ],
    });

    expect(response.body.apiaries[0].status).toBe('rejected');
    expect(response.body.boxes[0]).toMatchObject({ status: 'rejected', message: 'O registro pai não foi enviado ou foi recusado.' });
    expect(response.body.boxes[1].status).toBe('created');
  });

  it('exclusões: a do usuário é feita e registrada; a já excluída conta como feita', async () => {
    const response = await push({ deletions: [{ entity: 'review_reports', id: 300 }, { entity: 'manejos', id: 999 }] });

    expect(response.body.deletions).toEqual([
      { entity: 'review_reports', id: 300, status: 'deleted' },
      { entity: 'manejos', id: 999, status: 'deleted' },
    ]);
    expect(db.reviewReports).toHaveLength(0);
    expect(tombstones()).toEqual([{ user_id: OWNER, entity: 'review_reports', record_id: 300 }]);
  });

  it('lote grande demais ou malformado: 422', async () => {
    const tooMany = Array.from({ length: 101 }, (_, i) => ({ entity: 'manejos', id: i + 1 }));

    expect((await push({ deletions: tooMany })).status).toBe(422);
    expect((await push({ boxes: [{ localId: 0, apiaryId: 10, name: 'x' }] })).status).toBe(422);
  });
});

describe('rotas antigas: client_uuid de outro usuário (S20)', () => {
  it.each([
    ['/api/v1/revisions', 'reviewReports', {}],
    ['/api/v1/manejos', 'manejos', { revisao_id: null, photo_uri: null }],
  ] as const)('POST %s não devolve o registro de outro usuário', async (path, table, extra) => {
    db[table].push(record(900, { user_id: OTHER, apiary_id: 20, caixa_id: 200, client_uuid: 'uuid-alheio', observacoes: 'segredo', ...extra }));

    const response = await as(OWNER, request(createApp()).post(path).send({ clientUuid: 'uuid-alheio', caixaId: 100, apiaryId: 10, checkedOptions: [] }));

    expect(response.status).toBe(409);
    expect(JSON.stringify(response.body)).not.toContain('segredo');
  });
});

describe('updatedAt nas revisões e manejos', () => {
  it('vem nas listagens e no pull, para o app usar como baseUpdatedAt', async () => {
    const changes = await as(OWNER, request(createApp()).get('/api/v1/sync/changes'));
    const revisions = await as(OWNER, request(createApp()).get('/api/v1/revisions').query({ includeArchived: 'true' }));

    expect(changes.body.revisions[0].updatedAt).toBe(created.toISOString());
    expect(changes.body.manejos[0].updatedAt).toBe(created.toISOString());
    expect(revisions.body[0].updatedAt).toBe(created.toISOString());
  });
});
