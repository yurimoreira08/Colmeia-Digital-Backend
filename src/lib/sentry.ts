import * as Sentry from '@sentry/node';
import { env } from '../config/env.js';

/**
 * Sentry (rastreamento de erros). Só liga com SENTRY_DSN definido.
 *
 * Nada de PII vai para o Sentry: sem IP, sem cookies, sem corpo da
 * requisição, sem cabeçalho Authorization e sem query string (pode ter
 * termo de busca). Do usuário vai só o id.
 */
let enabled = false;

export function initSentry(): void {
  if (!env.SENTRY_DSN) return;
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: process.env.RENDER ? 'production' : env.NODE_ENV,
    release: process.env.RENDER_GIT_COMMIT,
    tracesSampleRate: 0,
    beforeSend: scrubEvent,
  });
  enabled = true;
}

/** Remove dados pessoais do evento antes do envio. Exportado para os testes. */
export function scrubEvent<T extends Sentry.ErrorEvent>(event: T): T {
  if (event.request) {
    delete event.request.cookies;
    delete event.request.data;
    delete event.request.query_string;
    if (event.request.headers) {
      const { authorization: _authorization, Authorization: _Authorization, cookie: _cookie, ...safeHeaders } = event.request.headers;
      event.request.headers = safeHeaders;
    }
  }
  if (event.user) event.user = event.user.id ? { id: event.user.id } : undefined;
  return event;
}

/** Envia um erro inesperado (500) ao Sentry, com o id da requisição e do usuário. */
export function captureUnexpectedError(error: unknown, context: { tag: string; requestId?: string; userId?: number }): void {
  if (!enabled) return;
  Sentry.withScope((scope) => {
    scope.setTag('handler', context.tag);
    if (context.requestId) scope.setTag('request_id', context.requestId);
    if (context.userId) scope.setUser({ id: String(context.userId) });
    Sentry.captureException(error);
  });
}

/** Espera os eventos pendentes saírem (desligamento do servidor). */
export async function flushSentry(timeoutMs = 2000): Promise<void> {
  if (enabled) await Sentry.close(timeoutMs);
}
