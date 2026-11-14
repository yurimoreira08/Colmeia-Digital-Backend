import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../errors/AppError.js';
import { logger } from '../lib/logger.js';
import { captureUnexpectedError } from '../lib/sentry.js';

const INTERNAL_ERROR_MESSAGE = 'Erro interno do servidor. Tente novamente em instantes.';

/** Erros gerados pelo body-parser do Express trazem um `type`. */
type BodyParserError = Error & { type?: string; status?: number };

/**
 * Responde a um erro capturado num controller.
 *
 * - `AppError`: status e mensagem do próprio erro (mensagens escritas para o usuário).
 * - Qualquer outro erro: registra no log e responde 500 com `fallbackMessage`,
 *   sem expor detalhes internos (Prisma, Supabase, stack).
 */
export function sendErrorResponse(res: Response, error: unknown, fallbackMessage: string, logTag: string): void {
  if (error instanceof AppError) {
    res.status(error.status).json({ message: error.message });
    return;
  }

  // res.req existe em toda resposta do Express; o log da requisição já traz o id dela.
  const req = res.req as Request | undefined;
  (req?.log ?? logger).error({ err: error, handler: logTag }, 'Erro inesperado');
  captureUnexpectedError(error, { tag: logTag, requestId: req?.id ? String(req.id) : undefined, userId: req?.userId });
  res.status(500).json({ message: fallbackMessage });
}

/** Responde 404 em JSON para rotas que não existem. */
export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ message: 'Rota não encontrada.' });
}

/**
 * Último middleware da aplicação: trata erros que chegam via `next(err)`,
 * como JSON malformado ou corpo grande demais, sempre em JSON e sem stack.
 */
export function errorHandler(error: unknown, _req: Request, res: Response, next: NextFunction): void {
  if (res.headersSent) {
    next(error);
    return;
  }

  const parserError = error as BodyParserError;
  if (parserError?.type === 'entity.parse.failed') {
    res.status(400).json({ message: 'Corpo da requisição inválido.' });
    return;
  }
  if (parserError?.type === 'entity.too.large') {
    res.status(413).json({ message: 'O conteúdo enviado excede o tamanho máximo permitido.' });
    return;
  }

  sendErrorResponse(res, error, INTERNAL_ERROR_MESSAGE, 'errorHandler');
}
