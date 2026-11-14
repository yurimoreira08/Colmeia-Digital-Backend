import { describe, expect, it } from 'vitest';

import { DEFAULT_TRUSTED_PROXIES, parseTrustProxy } from '../../src/config/trustedProxies.js';

describe('parseTrustProxy (variável TRUST_PROXY)', () => {
  it('usa rede privada + Cloudflare quando vazia', () => {
    expect(parseTrustProxy('')).toEqual(DEFAULT_TRUSTED_PROXIES);
    expect(parseTrustProxy('   ')).toEqual(DEFAULT_TRUSTED_PROXIES);
    expect(DEFAULT_TRUSTED_PROXIES).toEqual(expect.arrayContaining(['uniquelocal', '172.64.0.0/13', '2606:4700::/32']));
  });

  it('interpreta números como quantidade de saltos', () => {
    expect(parseTrustProxy('1')).toBe(1);
    expect(parseTrustProxy(' 3 ')).toBe(3);
  });

  it('interpreta true e false', () => {
    expect(parseTrustProxy('true')).toBe(true);
    expect(parseTrustProxy('false')).toBe(false);
  });

  it('interpreta uma lista de IPs, CIDRs ou nomes separada por vírgula', () => {
    expect(parseTrustProxy('loopback, 10.0.0.0/8 ,uniquelocal')).toEqual(['loopback', '10.0.0.0/8', 'uniquelocal']);
  });
});
