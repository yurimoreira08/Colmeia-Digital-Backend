import { afterEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_TRUSTED_PROXIES } from '../../src/config/trustedProxies.js';

/** Carrega `env.ts` de novo com as variáveis de ambiente atuais. */
async function loadEnv() {
  vi.resetModules();
  const module = await import('../../src/config/env.js');
  return module.env;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('env (validação das variáveis de ambiente)', () => {
  it('aplica os padrões quando as variáveis opcionais não estão definidas', async () => {
    vi.stubEnv('PORT', '');
    vi.stubEnv('CORS_ORIGINS', '');
    vi.stubEnv('TRUST_PROXY', '');
    vi.stubEnv('SUPABASE_BUCKET_NAME', '');
    delete process.env.PORT;
    delete process.env.CORS_ORIGINS;
    delete process.env.TRUST_PROXY;
    delete process.env.SUPABASE_BUCKET_NAME;

    const env = await loadEnv();

    expect(env.PORT).toBe(4000);
    expect(env.CORS_ORIGINS).toEqual([]);
    expect(env.TRUST_PROXY).toEqual(DEFAULT_TRUSTED_PROXIES);
    expect(env.SUPABASE_BUCKET_NAME).toBe('colmeia-digital');
  });

  it('converte PORT para número e CORS_ORIGINS para lista', async () => {
    vi.stubEnv('PORT', '8080');
    vi.stubEnv('CORS_ORIGINS', 'https://a.example, http://localhost:8081 ,');

    const env = await loadEnv();

    expect(env.PORT).toBe(8080);
    expect(env.CORS_ORIGINS).toEqual(['https://a.example', 'http://localhost:8081']);
  });

  it('interpreta TRUST_PROXY numérico', async () => {
    vi.stubEnv('TRUST_PROXY', '2');

    const env = await loadEnv();

    expect(env.TRUST_PROXY).toBe(2);
  });

  it('recusa PORT inválida com mensagem clara', async () => {
    vi.stubEnv('PORT', 'porta');

    await expect(loadEnv()).rejects.toThrow(/Falha ao carregar variaveis de ambiente: PORT/);
  });
});
