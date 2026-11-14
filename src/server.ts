import type { Server } from 'http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { prisma } from './data/prisma.js';
import { logger } from './lib/logger.js';
import { flushSentry, initSentry } from './lib/sentry.js';

// Antes de tudo, para capturar erros desde a subida.
initSentry();

/** Tempo máximo para terminar as requisições em andamento ao desligar. */
const SHUTDOWN_TIMEOUT_MS = 10_000;

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

/**
 * Desligamento gracioso: o Render manda SIGTERM a cada deploy. Para de aceitar
 * conexões, espera as requisições em andamento (até 10 s), fecha o banco e
 * envia os erros pendentes ao Sentry.
 */
function handleShutdown(server: Server): void {
  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'Desligando o servidor');

    const forceExit = setTimeout(() => {
      logger.error('Requisições não terminaram a tempo; encerrando mesmo assim');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    forceExit.unref();

    server.close(async () => {
      await prisma.$disconnect().catch(() => undefined);
      await flushSentry();
      logger.info('Servidor desligado');
      process.exit(0);
    });
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

async function startServer() {
  try {
    await prisma.$connect();
    logger.info({ database: getMaskedDbHost(process.env.DATABASE_URL || env.DATABASE_URL) }, 'Conectado ao banco');

    const server = createApp().listen(env.PORT, () => {
      logger.info({ port: env.PORT }, 'Servidor no ar');
    });
    handleShutdown(server);
  } catch (error) {
    logger.fatal({ err: error }, 'Falha ao subir o servidor');
    await flushSentry();
    process.exit(1);
  }
}

startServer();
