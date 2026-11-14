import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../errors/AppError.js';
import { authenticateToken } from '../services/authService.js';

export async function parseUserId(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];

  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const rawToken = authHeader.slice(7).trim();
    if (rawToken) {
      const userId = await authenticateToken(rawToken);
      if (userId) {
        req.userId = userId;
        req.token = rawToken;
        return next();
      }
    }
  }

  req.userId = undefined;
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (req.method === 'OPTIONS') {
    return next();
  }

  // Rotas públicas que não exigem identificação de usuário
  const publicPaths = ['/health', '/health/client-ip', '/auth/login', '/auth/register', '/auth/forgot-password', '/auth/reset-password', '/auth/logout'];
  const isPublic = publicPaths.some((p) => req.path.endsWith(p));

  if (!isPublic && req.userId === undefined) {
    res.status(401).json({ message: 'Não autorizado. Usuário não identificado ou sessão expirada.' });
    return;
  }

  next();
}

/**
 * Id do usuário logado numa rota protegida. O `requireAuth` já barrou quem
 * não tem sessão; isto só dá o tipo certo e protege contra uma rota pública
 * que use dados do usuário por engano.
 */
export function authenticatedUserId(req: Request): number {
  if (req.userId === undefined) throw new AppError('Não autorizado. Usuário não identificado.', 401);
  return req.userId;
}
