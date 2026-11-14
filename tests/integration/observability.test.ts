import { Writable } from 'stream';
import pino from 'pino';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/data/prisma.js', () => import('../helpers/prismaMock.js'));
vi.mock('../../src/lib/sentry.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/lib/sentry.js')>()),
  captureUnexpectedError: vi.fn(),
}));

import { createApp } from '../../src/app.js';
import { REDACTED_PATHS } from '../../src/lib/logger.js';
import { captureUnexpectedError, scrubEvent } from '../../src/lib/sentry.js';
import { authHeader, mockSessionsFor } from '../helpers/fixtures.js';
import { prisma as prismaMock, resetPrismaMock } from '../helpers/prismaMock.js';

/**
 * Observabilidade (Fase 4): id da requisição, logs sem dados sensíveis e
 * erros inesperados no Sentry sem PII.
 */
beforeEach(() => {
  resetPrismaMock();
  mockSessionsFor(1);
  vi.mocked(captureUnexpectedError).mockClear();
});

describe('id da requisição', () => {
  it('toda resposta traz X-Request-Id', async () => {
    const response = await request(createApp()).get('/api/v1/health');

    expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('reaproveita o id enviado pelo cliente, se for seguro', async () => {
    const ok = await request(createApp()).get('/api/v1/health').set('X-Request-Id', 'app-1234567890');
    const unsafe = await request(createApp()).get('/api/v1/health').set('X-Request-Id', '<script>alert(1)</script>');

    expect(ok.headers['x-request-id']).toBe('app-1234567890');
    expect(unsafe.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('logs', () => {
  it('ocultam senha, token, código de reset, e-mail e cabeçalho de autenticação', () => {
    let output = '';
    const sink = new Writable({ write: (chunk, _enc, done) => { output += chunk; done(); } });
    const log = pino({ redact: { paths: REDACTED_PATHS, censor: '[oculto]' } }, sink);

    log.info({ body: { email: 'pessoa@example.com', password: 'segredo123', code: '123456', token: 'abc' }, req: { headers: { authorization: 'Bearer xyz' } } }, 'teste');

    for (const secret of ['pessoa@example.com', 'segredo123', '123456', 'abc', 'Bearer xyz']) expect(output).not.toContain(secret);
    expect(output).toContain('[oculto]');
  });
});

describe('Sentry', () => {
  it('erro inesperado (500) vai ao Sentry com o id da requisição e do usuário', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    prismaMock.apiary.findMany.mockRejectedValue(new Error('banco fora do ar'));

    const response = await request(createApp()).get('/api/v1/apiaries').set('Authorization', authHeader(1));

    expect(response.status).toBe(500);
    expect(captureUnexpectedError).toHaveBeenCalledWith(expect.any(Error), {
      tag: 'listApiariesController',
      requestId: response.headers['x-request-id'],
      userId: 1,
    });
  });

  it('erro esperado (AppError, ex.: 404) não vai ao Sentry', async () => {
    prismaMock.apiary.findFirst.mockResolvedValue(null);

    await request(createApp()).get('/api/v1/apiaries/99').set('Authorization', authHeader(1));

    expect(captureUnexpectedError).not.toHaveBeenCalled();
  });

  it('o evento sai sem cabeçalho de autenticação, cookies, corpo, query nem dados do usuário além do id', () => {
    const event = scrubEvent({
      type: undefined,
      request: { headers: { authorization: 'Bearer x', 'user-agent': 'app' }, cookies: { a: 'b' }, data: '{"password":"x"}', query_string: 'search=ana' },
      user: { id: '1', email: 'pessoa@example.com', ip_address: '1.2.3.4' },
    });

    expect(event.request).toEqual({ headers: { 'user-agent': 'app' } });
    expect(event.user).toEqual({ id: '1' });
  });
});
