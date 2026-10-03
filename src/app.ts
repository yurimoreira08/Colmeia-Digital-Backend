import cors from 'cors';
import express from 'express';

import { router } from './routes/index.js';
import { parseUserId, requireAuth } from './middlewares/auth.js';
import { checkRole } from './middlewares/checkRole.js';

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    }),
  );

  app.use(express.json({ limit: '20mb' }));
  app.use(parseUserId);
  app.use(requireAuth);
  app.use(checkRole);

  app.use('/api/v1', router);

  app.use((_: any, res: any) => {
    res.status(404).json({ message: 'Rota nao encontrada.' });
  });

  return app;
}
