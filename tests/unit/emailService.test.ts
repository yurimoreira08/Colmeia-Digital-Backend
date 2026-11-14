import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { sendPasswordResetEmail } from '../../src/services/emailService.js';

const RESET_CODE = '482913';

/** Tudo o que foi escrito no console durante o teste, numa string só. */
function consoleOutput(...spies: Array<ReturnType<typeof vi.spyOn>>): string {
  return spies.flatMap((spy) => spy.mock.calls.flat()).map(String).join('\n');
}

let logSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;
let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('envio do e-mail de recuperação sem provedor configurado', () => {
  it('em produção não imprime o código no log e informa que não enviou', async () => {
    vi.stubEnv('NODE_ENV', 'production');

    const sent = await sendPasswordResetEmail('um@example.com', RESET_CODE, 'Apicultora');

    expect(sent).toBe(false);
    expect(consoleOutput(logSpy, errorSpy, warnSpy)).not.toContain(RESET_CODE);
  });

  it('no Render conta como produção mesmo sem NODE_ENV=production', async () => {
    // O Render define RENDER=true; NODE_ENV=production lá faria o npm pular as devDependencies do build.
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('RENDER', 'true');

    const sent = await sendPasswordResetEmail('um@example.com', RESET_CODE, 'Apicultora');

    expect(sent).toBe(false);
    expect(consoleOutput(logSpy, errorSpy, warnSpy)).not.toContain(RESET_CODE);
  });

  it('não registra o endereço de e-mail do usuário nos logs', async () => {
    vi.stubEnv('NODE_ENV', 'production');

    await sendPasswordResetEmail('um@example.com', RESET_CODE, 'Apicultora');

    expect(consoleOutput(logSpy, errorSpy, warnSpy)).not.toContain('um@example.com');
  });
});

describe('conteúdo do e-mail de recuperação', () => {
  it('escapa o nome do usuário no HTML', async () => {
    vi.stubEnv('RESEND_API_KEY', 'test-resend-key');
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await sendPasswordResetEmail('um@example.com', RESET_CODE, '<img src=x onerror=alert(1)>');

    const payload = JSON.parse(String((fetchMock.mock.calls[0] as unknown[])[1] && (fetchMock.mock.calls[0][1] as RequestInit).body));
    expect(payload.html).not.toContain('<img src=x');
    expect(payload.html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('em caso de sucesso no provedor, não registra o e-mail do destinatário', async () => {
    vi.stubEnv('RESEND_API_KEY', 'test-resend-key');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })));

    const sent = await sendPasswordResetEmail('um@example.com', RESET_CODE, 'Apicultora');

    expect(sent).toBe(true);
    expect(consoleOutput(logSpy, errorSpy, warnSpy)).not.toContain('um@example.com');
  });
});
