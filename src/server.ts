import { createApp } from './app.js';
import { env } from './config/env.js';
import { prisma } from './data/prisma.js';

function getMaskedDbHost(urlStr?: string): string {
  if (!urlStr) return 'indefinido (DATABASE_URL ausente)';
  try {
    const parsed = new URL(urlStr);
    const port = parsed.port ? `:${parsed.port}` : '';
    const path = parsed.pathname ? parsed.pathname : '';
    return `${parsed.protocol}//${parsed.hostname}${port}${path}`;
  } catch {
    return 'URL de banco configurada';
  }
}

async function startServer() {
  try {
    await prisma.$connect();
    const dbTarget = getMaskedDbHost(process.env.DATABASE_URL || env.DATABASE_URL);
    console.log(`[database] Conectado ao banco: ${dbTarget}`);

    const app = createApp();

    app.listen(env.PORT, () => {
      console.log(`[colmeia-digital-backend] running on port ${env.PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
