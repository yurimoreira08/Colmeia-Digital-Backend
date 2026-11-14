import pino from 'pino';
import { env } from '../config/env.js';

/**
 * Log estruturado (JSON, uma linha por evento) para o Render.
 *
 * Campos sensíveis são trocados por "[oculto]" antes de sair do processo:
 * senha, token, código de reset, e-mail e os cabeçalhos de autenticação.
 * Ao registrar um erro, passe-o em `err` (`logger.error({ err }, 'mensagem')`).
 */
export const REDACTED_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  '*.password',
  '*.newPassword',
  '*.password_hash',
  '*.passwordHash',
  '*.token',
  '*.code',
  '*.email',
];

export const logger = pino({
  level: env.LOG_LEVEL || (env.NODE_ENV === 'test' ? 'silent' : 'info'),
  redact: { paths: REDACTED_PATHS, censor: '[oculto]' },
  base: { service: 'colmeia-digital-backend' },
});
