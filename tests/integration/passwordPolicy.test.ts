import bcrypt from 'bcryptjs';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/data/prisma.js', () => import('../helpers/prismaMock.js'));
const sentCodes = vi.hoisted(() => [] as string[]);
vi.mock('../../src/services/emailService.js', () => ({
  sendEmail: vi.fn(),
  sendPasswordResetEmail: vi.fn(async (_email: string, code: string) => {
    sentCodes.push(code);
    return true;
  }),
}));

import { createApp } from '../../src/app.js';
import { resetPrismaMock } from '../helpers/prismaMock.js';
import { userRow } from '../helpers/fixtures.js';
import { useAuthTables } from '../helpers/userTable.js';

const SHORT_PASSWORD_MESSAGE = 'A senha deve ter pelo menos 8 caracteres.';

/** Custo do bcrypt gravado no hash (ex.: "$2a$12$..." → 12). */
function bcryptCost(hash: string): number {
  return Number(hash.split('$')[2]);
}

let tables: ReturnType<typeof useAuthTables>;

beforeEach(() => {
  resetPrismaMock();
  sentCodes.length = 0;
  tables = useAuthTables();
});

describe('política de senha em novas senhas', () => {
  it('recusa cadastro com senha de 7 caracteres', async () => {
    const response = await request(createApp())
      .post('/api/v1/auth/register')
      .send({ name: 'Pessoa Nova', email: 'nova@example.com', password: '1234567' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: SHORT_PASSWORD_MESSAGE });
    expect(tables.users).toHaveLength(0);
  });

  it('não descarta espaços da senha: a senha vale exatamente como foi digitada', async () => {
    const app = createApp();
    await request(app).post('/api/v1/auth/register').send({ name: 'Pessoa Nova', email: 'nova@example.com', password: '  senha com espaços  ' });

    const exact = await request(app).post('/api/v1/auth/login').send({ email: 'nova@example.com', password: '  senha com espaços  ' });
    const trimmed = await request(app).post('/api/v1/auth/login').send({ email: 'nova@example.com', password: 'senha com espaços' });

    expect(exact.status).toBe(200);
    expect(trimmed.status).toBe(400);
  });

  it('grava novas senhas com bcrypt custo 12', async () => {
    await request(createApp())
      .post('/api/v1/auth/register')
      .send({ name: 'Pessoa Nova', email: 'nova@example.com', password: 'senha-forte-123' });

    expect(bcryptCost(tables.users[0].password_hash as string)).toBe(12);
  });

  it('recusa nova senha curta na redefinição', async () => {
    tables.users.push(userRow({ id: 1, email: 'um@example.com' }));
    const app = createApp();
    await request(app).post('/api/v1/auth/forgot-password').send({ email: 'um@example.com' });

    const response = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ email: 'um@example.com', code: sentCodes[0], newPassword: 'curta' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: SHORT_PASSWORD_MESSAGE });
  });
});

describe('contas existentes continuam entrando', () => {
  it('aceita login com senha antiga de 4 caracteres', async () => {
    tables.users.push(userRow({ id: 1, email: 'um@example.com', password_hash: bcrypt.hashSync('abcd', 4) }));

    const response = await request(createApp()).post('/api/v1/auth/login').send({ email: 'um@example.com', password: 'abcd' });

    expect(response.status).toBe(200);
  });

  it('aceita a senha com espaços de quem cadastrou quando o backend fazia trim', async () => {
    // Antes, " minha-senha " era gravada como hash de "minha-senha".
    tables.users.push(userRow({ id: 1, email: 'um@example.com', password_hash: bcrypt.hashSync('minha-senha', 4) }));

    const response = await request(createApp()).post('/api/v1/auth/login').send({ email: 'um@example.com', password: ' minha-senha ' });

    expect(response.status).toBe(200);
  });

  it('regrava o hash com custo 12 no login quando ele é mais fraco', async () => {
    tables.users.push(userRow({ id: 1, email: 'um@example.com', password_hash: bcrypt.hashSync('senha-antiga', 4) }));

    await request(createApp()).post('/api/v1/auth/login').send({ email: 'um@example.com', password: 'senha-antiga' });

    const storedHash = tables.users[0].password_hash as string;
    expect(bcryptCost(storedHash)).toBe(12);
    expect(bcrypt.compareSync('senha-antiga', storedHash)).toBe(true);
  });
});

describe('força bruta do código de recuperação', () => {
  it('invalida o código após 5 tentativas erradas, mesmo que a 6ª esteja certa', async () => {
    tables.users.push(userRow({ id: 1, email: 'um@example.com' }));
    const app = createApp();
    await request(app).post('/api/v1/auth/forgot-password').send({ email: 'um@example.com' });
    const realCode = sentCodes[0];
    const wrongCode = realCode === '000000' ? '111111' : '000000';

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const response = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({ email: 'um@example.com', code: wrongCode, newPassword: 'nova-senha-123' });
      expect(response.status).toBe(400);
    }

    const withRealCode = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ email: 'um@example.com', code: realCode, newPassword: 'nova-senha-123' });

    expect(withRealCode.status).toBe(400);
    expect(withRealCode.body.message).toMatch(/inválido ou expirado/);
  });

  it('mantém a contagem de tentativas mesmo se o servidor reiniciar no meio', async () => {
    tables.users.push(userRow({ id: 1, email: 'um@example.com' }));
    let app = createApp();
    await request(app).post('/api/v1/auth/forgot-password').send({ email: 'um@example.com' });
    const realCode = sentCodes[0];
    const wrongCode = realCode === '000000' ? '111111' : '000000';
    const tryCode = (code: string) =>
      request(app).post('/api/v1/auth/reset-password').send({ email: 'um@example.com', code, newPassword: 'nova-senha-123' });

    for (let attempt = 1; attempt <= 3; attempt += 1) await tryCode(wrongCode);

    // Reinício: módulos (e qualquer estado em memória) recarregados; o "banco" continua.
    vi.resetModules();
    const { createApp: createRestartedApp } = await import('../../src/app.js');
    const { resetPrismaMock: resetRestartedPrisma } = await import('../helpers/prismaMock.js');
    const { useAuthTables: useRestartedTables } = await import('../helpers/userTable.js');
    resetRestartedPrisma();
    useRestartedTables([], tables);
    app = createRestartedApp();

    for (let attempt = 4; attempt <= 5; attempt += 1) await tryCode(wrongCode);
    const withRealCode = await tryCode(realCode);

    expect(withRealCode.status).toBe(400);
    expect(withRealCode.body.message).toMatch(/inválido ou expirado/);
  });

  it('aceita o código certo dentro do limite de tentativas', async () => {
    tables.users.push(userRow({ id: 1, email: 'um@example.com' }));
    const app = createApp();
    await request(app).post('/api/v1/auth/forgot-password').send({ email: 'um@example.com' });

    await request(app).post('/api/v1/auth/reset-password').send({ email: 'um@example.com', code: '999999' === sentCodes[0] ? '888888' : '999999', newPassword: 'nova-senha-123' });
    const response = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ email: 'um@example.com', code: sentCodes[0], newPassword: 'nova-senha-123' });

    expect(response.status).toBe(200);
    expect(bcrypt.compareSync('nova-senha-123', tables.users[0].password_hash as string)).toBe(true);
  });
});
