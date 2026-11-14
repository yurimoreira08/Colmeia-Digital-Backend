import rateLimit, { type Options } from 'express-rate-limit';
import type { Request } from 'express';

/**
 * Limites de requisição da API.
 *
 * O contador fica em memória, o que vale para uma única instância (o Render
 * roda uma). Com mais de uma instância os limites passam a valer por
 * instância: nesse caso, troque o `store` por um compartilhado (Redis).
 *
 * As funções criam limitadores novos a cada chamada: `createApp()` monta os
 * seus, então cada app (e cada teste) tem contadores próprios.
 */

const FIFTEEN_MINUTES = 15 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;

const TOO_MANY_REQUESTS_MESSAGE = 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';

const baseOptions: Partial<Options> = {
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_req, res, _next, options) => {
    res.status(options.statusCode).json({ message: TOO_MANY_REQUESTS_MESSAGE });
  },
};

/**
 * Limite geral por IP para toda a API.
 * Alto de propósito: o sync do app faz uma requisição por registro pendente
 * e várias pessoas podem compartilhar o IP da operadora (CGNAT).
 */
export function createGeneralLimiter() {
  return rateLimit({ ...baseOptions, windowMs: FIFTEEN_MINUTES, limit: 1000 });
}

/**
 * Limite estrito por IP nas rotas de autenticação (login, cadastro e
 * recuperação de senha), contra força bruta de senha e de código.
 *
 * Só conta tentativas que falharam: no interior é comum muitas pessoas
 * saírem pelo mesmo IP da operadora, e logins certos não devem bloquear
 * ninguém.
 */
export function createAuthLimiter() {
  return rateLimit({ ...baseOptions, windowMs: FIFTEEN_MINUTES, limit: 10, skipSuccessfulRequests: true });
}

/**
 * Limite por e-mail no pedido de código de recuperação, para impedir que
 * alguém dispare e-mails em massa para a mesma pessoa trocando de IP.
 * Requisições sem e-mail passam direto (o service responde a validação).
 */
export function createPasswordResetEmailLimiter() {
  return rateLimit({
    ...baseOptions,
    windowMs: ONE_HOUR,
    limit: 3,
    keyGenerator: (req: Request) => `email:${String(req.body?.email ?? '').trim().toLowerCase()}`,
    skip: (req: Request) => typeof req.body?.email !== 'string' || req.body.email.trim() === '',
  });
}
