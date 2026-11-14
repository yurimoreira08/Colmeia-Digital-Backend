import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** Transporte SMTP falso: registra a configuração e as mensagens enviadas. */
const smtp = vi.hoisted(() => ({
  transportOptions: [] as unknown[],
  sentMails: [] as Array<Record<string, unknown>>,
  shouldFail: false,
}));

vi.mock('nodemailer', () => ({
  default: {
    createTransport: (options: unknown) => {
      smtp.transportOptions.push(options);
      return {
        sendMail: async (mail: Record<string, unknown>) => {
          if (smtp.shouldFail) throw Object.assign(new Error('550 Recipient address rejected: um@example.com'), { code: 'EENVELOPE' });
          smtp.sentMails.push(mail);
          return { messageId: 'teste' };
        },
      };
    },
  },
}));

import { sendPasswordResetEmail } from '../../src/services/emailService.js';

beforeEach(() => {
  smtp.transportOptions.length = 0;
  smtp.sentMails.length = 0;
  smtp.shouldFail = false;
  vi.stubEnv('RESEND_API_KEY', '');
  vi.stubEnv('SMTP_HOST', 'smtp.example.com');
  vi.stubEnv('SMTP_PORT', '465');
  vi.stubEnv('SMTP_USER', 'usuario-smtp');
  vi.stubEnv('SMTP_PASS', 'senha-smtp');
  vi.stubEnv('SMTP_FROM', 'Colmeia <nao-responda@example.com>');
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('envio do e-mail de recuperação por SMTP', () => {
  it('usa as credenciais do ambiente e TLS direto na porta 465', async () => {
    const sent = await sendPasswordResetEmail('um@example.com', '482913', 'Apicultora');

    expect(sent).toBe(true);
    expect(smtp.transportOptions).toEqual([
      { host: 'smtp.example.com', port: 465, secure: true, auth: { user: 'usuario-smtp', pass: 'senha-smtp' } },
    ]);
  });

  it('envia para o destinatário com remetente, assunto e código', async () => {
    await sendPasswordResetEmail('um@example.com', '482913', 'Apicultora');

    expect(smtp.sentMails).toHaveLength(1);
    expect(smtp.sentMails[0]).toMatchObject({
      from: 'Colmeia <nao-responda@example.com>',
      to: 'um@example.com',
      subject: expect.stringContaining('482913'),
    });
    expect(String(smtp.sentMails[0].text)).toContain('482913');
  });

  it('informa falha sem registrar o destinatário no log', async () => {
    smtp.shouldFail = true;
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const sent = await sendPasswordResetEmail('um@example.com', '482913', 'Apicultora');

    expect(sent).not.toBe(true);
    expect(errorSpy.mock.calls.flat().map(String).join('\n')).not.toContain('um@example.com');
  });
});
