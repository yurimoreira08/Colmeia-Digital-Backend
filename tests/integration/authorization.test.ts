import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/data/prisma.js', () => import('../helpers/prismaMock.js'));

import { createApp } from '../../src/app.js';
import { resetPrismaMock } from '../helpers/prismaMock.js';
import { authHeader, mockSessionsFor } from '../helpers/fixtures.js';
import { useFakeDb, type FakeDb } from '../helpers/fakeDb.js';

/**
 * Matriz de controle de acesso (IDOR): a usuária A (id 1) é dona do apiário
 * 10, com a caixa 100, a revisão 200, o manejo 300 e a notificação 400. O
 * usuário B (id 2) tem o apiário 20 e a caixa 110. Toda tentativa de B sobre
 * dados de A precisa falhar sem alterar nada e sem devolver dados de A.
 */
const OWNER = 1;
const INTRUDER = 2;
const created = new Date('2026-05-01T10:00:00Z');

let db: FakeDb;

function seed(): FakeDb {
  return useFakeDb({
    apiaries: [
      { id: 10, user_id: OWNER, name: 'Apiário da A', location: 'Teresina', box_count: 1, description: '', created_at: created, updated_at: created },
      { id: 20, user_id: INTRUDER, name: 'Apiário do B', location: 'Picos', box_count: 1, description: '', created_at: created, updated_at: created },
    ],
    boxes: [
      { id: 100, apiary_id: 10, user_id: OWNER, name: 'Caixa A1', position: 1, archived: false, created_at: created, updated_at: created },
      { id: 110, apiary_id: 20, user_id: INTRUDER, name: 'Caixa B1', position: 1, archived: false, created_at: created, updated_at: created },
    ],
    reviewReports: [
      { id: 200, client_uuid: 'uuid-revisao-da-a', user_id: OWNER, apiary_id: 10, apiary_name: 'Apiário da A', caixa_id: 100, caixa_name: 'Caixa A1', tipo: 'apiario', checked_options: '["rainha"]', observacoes: 'segredo da A', indicacoes: '', archived: false, created_at: created, updated_at: created },
    ],
    manejos: [
      { id: 300, client_uuid: 'uuid-manejo-da-a', user_id: OWNER, apiary_id: 10, apiary_name: 'Apiário da A', caixa_id: 100, caixa_name: 'Caixa A1', tipo: 'apiario', revisao_id: null, checked_options: '["alimentacao"]', observacoes: 'segredo da A', indicacoes: '', photo_uri: null, archived: false, created_at: created, updated_at: created },
    ],
    notifications: [{ id: 400, user_id: OWNER, title: 'Aviso da A', subtitle: 'segredo da A', read: false, created_at: created }],
  });
}

/** Retrato dos dados de A, para comparar antes e depois de cada tentativa. */
function ownerSnapshot() {
  const strip = (row: Record<string, unknown>) => {
    const { updated_at: _updatedAt, ...rest } = row;
    return rest;
  };
  return JSON.stringify({
    apiaries: db.apiaries.filter((a) => a.user_id === OWNER).map(strip),
    boxes: db.boxes.filter((b) => b.apiary_id === 10).map(strip),
    reviews: db.reviewReports.filter((r) => r.user_id === OWNER).map(strip),
    manejos: db.manejos.filter((m) => m.user_id === OWNER).map(strip),
    notifications: db.notifications.filter((n) => n.user_id === OWNER).map(strip),
  });
}

const revisionBody = { caixaId: 100, caixaName: 'Caixa A1', apiaryId: 10, apiaryName: 'Apiário da A', tipo: 'apiario', checkedOptions: ['x'], observacoes: 'invadido', indicacoes: '' };
/** Manejo válido: tarefas são objetos (com string a validação recusaria antes da autorização). */
const manejoBody = { ...revisionBody, checkedOptions: [{ id: 'alimentacao', obs: '', ind: '' }] };

type Attempt = [label: string, method: 'get' | 'post' | 'put' | 'delete', path: string, body?: Record<string, unknown>];

const writeAttempts: Attempt[] = [
  ['editar o apiário da A', 'post', '/api/v1/apiaries', { id: 10, name: 'Invadido', location: 'X', boxCount: '1' }],
  ['excluir o apiário da A', 'delete', '/api/v1/apiaries/10'],
  ['criar caixa no apiário da A', 'post', '/api/v1/boxes', { apiaryId: 10, name: 'Caixa intrusa' }],
  ['renomear a caixa da A', 'put', '/api/v1/boxes/100/rename', { name: 'Invadida' }],
  ['excluir a caixa da A', 'delete', '/api/v1/boxes/100'],
  ['arquivar a caixa da A', 'post', '/api/v1/boxes/100/archive'],
  ['criar revisão na caixa da A', 'post', '/api/v1/revisions', revisionBody],
  ['criar revisão na caixa da A informando o próprio apiário', 'post', '/api/v1/revisions', { ...revisionBody, apiaryId: 20, apiaryName: 'Apiário do B' }],
  ['editar a revisão da A', 'put', '/api/v1/revisions/200', { observacoes: 'invadido', indicacoes: '', checkedOptions: [] }],
  ['excluir a revisão da A', 'delete', '/api/v1/revisions/200'],
  ['arquivar a revisão da A', 'post', '/api/v1/revisions/200/archive'],
  ['criar manejo na caixa da A', 'post', '/api/v1/manejos', manejoBody],
  ['criar manejo na caixa da A informando o próprio apiário', 'post', '/api/v1/manejos', { ...manejoBody, apiaryId: 20, apiaryName: 'Apiário do B' }],
  ['editar o manejo da A', 'put', '/api/v1/manejos/300', { observacoes: 'invadido', indicacoes: '', checkedOptions: [{ id: 'x', obs: '', ind: '' }] }],
  ['excluir o manejo da A', 'delete', '/api/v1/manejos/300'],
  ['arquivar o manejo da A', 'post', '/api/v1/manejos/300/archive'],
  ['marcar como lida a notificação da A', 'put', '/api/v1/notifications/400/read'],
  ['marcar todas as notificações como lidas', 'put', '/api/v1/notifications/read-all'],
];

const readAttempts: Attempt[] = [
  ['ler o apiário da A', 'get', '/api/v1/apiaries/10'],
  ['listar apiários', 'get', '/api/v1/apiaries'],
  ['listar caixas do apiário da A', 'get', '/api/v1/boxes?apiaryId=10&includeArchived=true'],
  ['listar todas as caixas', 'get', '/api/v1/boxes?includeArchived=true'],
  ['listar revisões do apiário da A', 'get', '/api/v1/revisions?apiaryId=10&includeArchived=true'],
  ['listar revisões da caixa da A', 'get', '/api/v1/revisions?caixaId=100&includeArchived=true'],
  ['listar manejos do apiário da A', 'get', '/api/v1/manejos?apiaryId=10&includeArchived=true'],
  ['listar notificações', 'get', '/api/v1/notifications'],
  ['reenviar a revisão da A pelo client_uuid', 'post', '/api/v1/revisions', { ...revisionBody, apiaryId: 20, caixaId: 110, clientUuid: 'uuid-revisao-da-a' }],
  ['reenviar o manejo da A pelo client_uuid', 'post', '/api/v1/manejos', { ...manejoBody, apiaryId: 20, caixaId: 110, clientUuid: 'uuid-manejo-da-a' }],
];

function send(method: Attempt[1], path: string, body?: Record<string, unknown>) {
  const req = request(createApp())[method](path).set('Authorization', authHeader(INTRUDER));
  return body ? req.send(body) : req;
}

beforeEach(() => {
  resetPrismaMock();
  mockSessionsFor(OWNER, INTRUDER);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  db = seed();
});

describe('o usuário B não altera dados da usuária A', () => {
  it.each(writeAttempts)('%s', async (_label, method, path, body) => {
    const before = ownerSnapshot();
    const boxesBefore = db.boxes.length;
    const reviewsBefore = db.reviewReports.length;
    const manejosBefore = db.manejos.length;

    const response = await send(method, path, body);

    expect(ownerSnapshot()).toBe(before);
    // Nenhum registro novo pendurado em caixa ou apiário da A.
    expect(db.boxes.filter((b) => b.apiary_id === 10)).toHaveLength(boxesBefore - 1);
    expect(db.reviewReports.filter((r) => r.caixa_id === 100 || r.apiary_id === 10)).toHaveLength(reviewsBefore);
    expect(db.manejos.filter((m) => m.caixa_id === 100 || m.apiary_id === 10)).toHaveLength(manejosBefore);
    expect(response.status).not.toBe(500);
  });
});

describe('o usuário B não lê dados da usuária A', () => {
  it.each(readAttempts)('%s', async (_label, method, path, body) => {
    const response = await send(method, path, body);

    const text = JSON.stringify(response.body);
    expect(text).not.toContain('Apiário da A');
    expect(text).not.toContain('Caixa A1');
    expect(text).not.toContain('segredo da A');
    expect(text).not.toContain('Aviso da A');
    expect(response.status).not.toBe(500);
  });
});

describe('relatórios', () => {
  it('as estatísticas de B não incluem dados da A', async () => {
    const response = await send('post', '/api/v1/reports/stats', {
      fromIso: '2026-01-01T00:00:00Z',
      toIso: '2026-12-31T23:59:59Z',
      chartFilter: 'apiarios',
    });

    expect(response.status).toBe(200);
    expect(JSON.stringify(response.body)).not.toMatch(/Apiário da A|Caixa A1|segredo da A/);
  });
});

describe('a dona continua com acesso total', () => {
  it('A lista e altera os próprios dados', async () => {
    const app = createApp();
    const list = await request(app).get('/api/v1/revisions?apiaryId=10&includeArchived=true').set('Authorization', authHeader(OWNER));
    const rename = await request(app).put('/api/v1/boxes/100/rename').set('Authorization', authHeader(OWNER)).send({ name: 'Caixa renomeada' });

    expect(list.status).toBe(200);
    expect(JSON.stringify(list.body)).toContain('segredo da A');
    expect(rename.status).toBe(200);
    expect(db.boxes.find((b) => b.id === 100)?.name).toBe('Caixa renomeada');
  });
});
