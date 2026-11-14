/**
 * Erro "esperado", cuja mensagem foi escrita para o usuário final e pode ir
 * na resposta HTTP (ex.: validação, recurso não encontrado).
 *
 * Qualquer outro erro (Prisma, Supabase, bug) é tratado como interno: vai só
 * para o log e o cliente recebe uma mensagem genérica. Ver `errorHandler.ts`.
 */
export class AppError extends Error {
  constructor(
    message: string,
    readonly status: number = 400,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/** Recurso inexistente ou de outro usuário (mesma resposta nos dois casos). */
export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, 404);
  }
}
