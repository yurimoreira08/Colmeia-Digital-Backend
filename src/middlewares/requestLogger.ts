import { randomUUID } from 'crypto';
import type { IncomingMessage, ServerResponse } from 'http';
import { pinoHttp } from 'pino-http';
import { logger } from '../lib/logger.js';

/** Id recebido do cliente só é aceito se for curto e sem caracteres estranhos. */
const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{8,64}$/;

/**
 * Um log por requisição (método, rota, status, duração) com um id que também
 * volta no cabeçalho `X-Request-Id`: o apicultor ou o app informam o id e o
 * erro é achado no log e no Sentry. A query string fica fora do log
 * (pode ter termo de busca).
 */
export const requestLogger = pinoHttp({
  logger,
  genReqId(req: IncomingMessage, res: ServerResponse) {
    const incoming = req.headers['x-request-id'];
    const id = typeof incoming === 'string' && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();
    res.setHeader('X-Request-Id', id);
    return id;
  },
  customLogLevel(_req, res, error) {
    if (error || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  serializers: {
    req: (req: { id: string; method: string; url: string }) => ({ id: req.id, method: req.method, path: req.url.split('?')[0] }),
    res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
  },
});
