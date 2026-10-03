import { authenticateToken } from '../services/authService.js';

export async function parseUserId(req: any, _res: any, next: any): Promise<void> {
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

  // Fallback para desenvolvimento / snapshot baseline
  const headerId = req.headers['x-user-id'] || req.headers['X-User-Id'];
  if (headerId) {
    const parsed = Number(headerId);
    if (!Number.isNaN(parsed) && parsed > 0) {
      req.userId = parsed;
    } else {
      req.userId = undefined;
    }
  } else {
    req.userId = undefined;
  }

  next();
}

export function requireAuth(req: any, res: any, next: any): any {
  if (req.method === 'OPTIONS') {
    return next();
  }

  // Rotas públicas que não exigem identificação de usuário
  const publicPaths = ['/health', '/auth/login', '/auth/register', '/auth/forgot-password', '/auth/reset-password', '/auth/logout'];
  const isPublic = publicPaths.some((p) => req.path.endsWith(p));

  if (!isPublic && req.userId === undefined) {
    return res.status(401).json({ message: 'Não autorizado. Usuário não identificado ou sessão expirada.' });
  }

  next();
}
