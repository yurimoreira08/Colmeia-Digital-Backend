import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/data/prisma.js', () => import('../helpers/prismaMock.js'));
vi.mock('../../src/services/emailService.js', () => ({ sendPasswordResetEmail: vi.fn(async () => true), sendEmail: vi.fn() }));

import { createApp } from '../../src/app.js';
import { resetPrismaMock } from '../helpers/prismaMock.js';
import { authHeader, mockSessionsFor } from '../helpers/fixtures.js';
import { useFakeDb } from '../helpers/fakeDb.js';

const USER_ID = 1;
const created = new Date('2026-05-01T10:00:00Z');

beforeEach(() => {
  resetPrismaMock();
  mockSessionsFor(USER_ID);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  useFakeDb({
    apiaries: [{ id: 10, user_id: USER_ID, name: 'Sede', location: 'Teresina', box_count: 1, description: '', created_at: created, updated_at: created }],
    boxes: [{ id: 100, apiary_id: 10, user_id: USER_ID, name: 'Caixa 01', position: 1, archived: false, created_at: created, updated_at: created }],
  });
});

const api = () => request(createApp());
const asUser = (req: request.Test) => req.set('Authorization', authHeader(USER_ID));

/** Formato padrão do erro de validação. */
function expectValidationError(response: request.Response, field: string) {
  expect(response.status).toBe(422);
  expect(response.body).toEqual({
    message: expect.any(String),
    errors: expect.arrayContaining([expect.objectContaining({ field, message: expect.any(String) })]),
  });
}

describe('validação de entrada: respostas 422 com o campo inválido', () => {
  it('cadastro sem e-mail informa o campo, com mensagem para o usuário', async () => {
    const response = await api().post('/api/v1/auth/register').send({ name: 'Pessoa', password: 'senha-forte-1' });

    expectValidationError(response, 'email');
    expect(response.body.message).toBe('Informe o e-mail.');
  });

  it('login com senha que não é texto', async () => {
    const response = await api().post('/api/v1/auth/login').send({ email: 'um@example.com', password: 12345678 });

    expectValidationError(response, 'password');
  });

  it('id de rota que não é número', async () => {
    const response = await asUser(api().delete('/api/v1/boxes/abc'));

    expectValidationError(response, 'id');
  });

  it('criação de caixa sem apiaryId', async () => {
    const response = await asUser(api().post('/api/v1/boxes')).send({ name: 'Caixa nova' });

    expectValidationError(response, 'apiaryId');
  });

  it('quantidade de caixas que não é número nem texto', async () => {
    const response = await asUser(api().post('/api/v1/apiaries')).send({ name: 'Novo', location: 'Picos', boxCount: { n: 3 } });

    expectValidationError(response, 'boxCount');
  });

  it('revisão com checkedOptions que não é lista', async () => {
    const response = await asUser(api().post('/api/v1/revisions')).send({
      caixaId: 100, caixaName: 'Caixa 01', apiaryId: 10, apiaryName: 'Sede', tipo: 'apiario', checkedOptions: 'rainha',
    });

    expectValidationError(response, 'checkedOptions');
  });

  it('texto acima do tamanho máximo', async () => {
    const response = await asUser(api().post('/api/v1/revisions')).send({
      caixaId: 100, caixaName: 'Caixa 01', apiaryId: 10, apiaryName: 'Sede', tipo: 'apiario', checkedOptions: [], observacoes: 'x'.repeat(5001),
    });

    expectValidationError(response, 'observacoes');
  });

  it('filtro de relatório desconhecido', async () => {
    const response = await asUser(api().post('/api/v1/reports/stats')).send({ fromIso: '2026-01-01', toIso: '2026-12-31', chartFilter: 'tudo' });

    expectValidationError(response, 'chartFilter');
  });

  it('query com includeArchived inválido', async () => {
    const response = await asUser(api().get('/api/v1/boxes?includeArchived=talvez'));

    expectValidationError(response, 'includeArchived');
  });
});

describe('compatibilidade com o que o app envia hoje (sync offline)', () => {
  it('aceita revisão com observações, indicações e client_uuid nulos vindos do SQLite', async () => {
    const response = await asUser(api().post('/api/v1/revisions')).send({
      id: undefined, clientUuid: null, caixaId: 100, caixaName: 'Caixa 01', apiaryId: 10, apiaryName: 'Sede',
      tipo: 'apiario', checkedOptions: ['rainha', 'postura'], observacoes: null, indicacoes: null,
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, id: expect.any(Number) });
  });

  it('aceita manejo com tarefas, foto e revisão nulas', async () => {
    const response = await asUser(api().post('/api/v1/manejos')).send({
      clientUuid: 'uuid-1', caixaId: 100, caixaName: 'Caixa 01', apiaryId: 10, apiaryName: 'Sede', tipo: 'apiario',
      revisaoId: null, checkedOptions: [{ id: 'alimentacao', obs: '', ind: '' }], observacoes: null, indicacoes: null, photoUri: null,
    });

    expect(response.status).toBe(200);
  });

  it('aceita apiário com boxCount em texto e descrição nula', async () => {
    const response = await asUser(api().post('/api/v1/apiaries')).send({ name: 'Novo', location: 'Picos', boxCount: '4', description: null });

    expect(response.status).toBe(200);
  });

  it('aceita criação de caixa com posição', async () => {
    const response = await asUser(api().post('/api/v1/boxes')).send({ apiaryId: 10, name: 'Caixa 02', position: 2 });

    expect(response.status).toBe(200);
  });

  it('aceita aceite de termos sem corpo', async () => {
    const response = await asUser(api().post('/api/v1/auth/terms'));

    expect(response.status).not.toBe(422);
  });
});
