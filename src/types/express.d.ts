/**
 * Campos que o middleware de autenticação acrescenta ao `Request`.
 * Permite tipar controllers com `Request` do Express em vez de `any`.
 */
declare global {
  namespace Express {
    interface Request {
      /** Definido por `parseUserId` quando o Bearer token é válido. */
      userId?: number;
      /** Token em texto puro da requisição (usado no logout). */
      token?: string;
    }
  }
}

export {};
