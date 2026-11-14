import cors from 'cors';
import express from 'express';
import helmet from 'helmet';

import { env } from './config/env.js';
import { router } from './routes/index.js';
import { parseUserId, requireAuth } from './middlewares/auth.js';
import { checkRole } from './middlewares/checkRole.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';

/** Limite padrão do corpo JSON. */
const DEFAULT_JSON_LIMIT = '1mb';
/**
 * Limite da rota de upload em base64 (foto de perfil): 5 MB de imagem viram
 * ~6,7 MB em base64. O tamanho real da imagem é validado no storageService.
 */
const BASE64_UPLOAD_JSON_LIMIT = '8mb';

export function createApp() {
  const app = express();

  // O Render fica na frente da aplicação como proxy reverso: sem isto, todo
  // cliente teria o IP do proxy e o rate limit valeria para todos juntos.
  app.set('trust proxy', env.TRUST_PROXY);

  // API só devolve JSON: CSP fechada (default-src 'none') e demais headers do helmet.
  app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } } }));

  // Navegadores só recebem CORS para as origens configuradas. O app nativo
  // não envia Origin e não é afetado.
  app.use(
    cors({
      origin: env.CORS_ORIGINS,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    }),
  );

  // O parser de 8 MB roda antes e marca o corpo como lido; o de 1 MB então ignora essa rota.
  app.use('/api/v1/upload', express.json({ limit: BASE64_UPLOAD_JSON_LIMIT }));
  app.use(express.json({ limit: DEFAULT_JSON_LIMIT }));

  app.use(parseUserId);
  app.use(requireAuth);
  app.use(checkRole);

  app.use('/api/v1', router);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
