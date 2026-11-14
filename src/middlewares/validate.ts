import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';

// Mensagens padrão do Zod em português (as dos campos principais são personalizadas nos schemas).
z.config(z.locales.pt());

/** Schemas que uma rota pode validar. */
export interface RequestSchemas {
  body?: z.ZodType;
  query?: z.ZodType;
  params?: z.ZodType;
}

/** Erro de validação de um campo, no formato devolvido ao cliente. */
export interface FieldError {
  field: string;
  message: string;
}

function toFieldErrors(error: z.ZodError): FieldError[] {
  return error.issues.map((issue) => ({ field: issue.path.join('.') || '(corpo)', message: issue.message }));
}

/**
 * Valida corpo, query e parâmetros da rota antes do controller.
 *
 * Em caso de erro responde 422 com `{ message, errors: [{ field, message }] }`,
 * onde `message` é a mensagem do primeiro campo (pensada para aparecer direto
 * no app). Em caso de sucesso, troca `req.body`/`req.query`/`req.params` pelos
 * valores já convertidos e sem campos desconhecidos: o controller só recebe
 * dados no formato do schema.
 */
export function validate(schemas: RequestSchemas) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: FieldError[] = [];
    const parsed: Partial<Record<keyof RequestSchemas, unknown>> = {};

    for (const part of ['params', 'query', 'body'] as const) {
      const schema = schemas[part];
      if (!schema) continue;
      const result = schema.safeParse(req[part] ?? {});
      if (result.success) {
        parsed[part] = result.data;
      } else {
        errors.push(...toFieldErrors(result.error));
      }
    }

    if (errors.length > 0) {
      res.status(422).json({ message: errors[0].message, errors });
      return;
    }

    if (parsed.body !== undefined) req.body = parsed.body;
    if (parsed.query !== undefined) req.query = parsed.query as Request['query'];
    if (parsed.params !== undefined) req.params = parsed.params as Request['params'];
    next();
  };
}
