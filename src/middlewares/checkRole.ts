import type { NextFunction } from 'express';
import { prisma } from '../data/prisma.js';
import { getApiaryById } from '../data/repositories/apiaryRepository.js';

export async function checkRole(req: any, res: any, next: NextFunction) {
  if (req.method === 'OPTIONS') {
    return next();
  }

  const path = req.originalUrl || req.path;
  const publicPaths = ['/health', '/auth/login', '/auth/register', '/auth/forgot-password', '/auth/reset-password', '/auth/logout'];
  const isPublic = publicPaths.some((p) => path.endsWith(p));
  if (isPublic) {
    return next();
  }

  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ message: 'Não autorizado. Usuário não identificado.' });
  }

  // Resolve apiaryId for the request
  let apiaryId: number | null = null;

  if (req.body.apiaryId) {
    apiaryId = Number(req.body.apiaryId);
  } else if (req.body.apiary_id) {
    apiaryId = Number(req.body.apiary_id);
  } else if (req.query.apiaryId) {
    apiaryId = Number(req.query.apiaryId);
  } else if (req.query.apiary_id) {
    apiaryId = Number(req.query.apiary_id);
  }

  // Parse path manually because req.params is empty in global middleware before routing
  const apiaryMatch = path.match(/\/apiaries\/(\d+)/);
  if (apiaryMatch) {
    apiaryId = Number(apiaryMatch[1]);
  }

  // If child entity is accessed by ID in the path (e.g. /boxes/123 or /revisions/123/archive)
  const childMatch = path.match(/\/(boxes|revisions|manejos)\/(\d+)/);
  if (!apiaryId && childMatch) {
    const entityType = childMatch[1];
    const entityId = Number(childMatch[2]);
    try {
      if (entityType === 'boxes') {
        const row = await prisma.box.findUnique({ where: { id: entityId }, select: { apiary_id: true } });
        if (row) apiaryId = row.apiary_id;
      } else if (entityType === 'revisions') {
        const row = await prisma.reviewReport.findUnique({ where: { id: entityId }, select: { apiary_id: true } });
        if (row) apiaryId = row.apiary_id;
      } else if (entityType === 'manejos') {
        const row = await prisma.manejo.findUnique({ where: { id: entityId }, select: { apiary_id: true } });
        if (row) apiaryId = row.apiary_id;
      }
    } catch (err) {
      console.error(`Error fetching apiaryId for child entity ${entityType} in checkRole middleware:`, err);
    }
  }

  // If we still don't have apiaryId, try resolving by caixaId/caixa_id from body
  if (!apiaryId) {
    const caixaId = req.body.caixaId || req.body.caixa_id;
    if (caixaId) {
      try {
        const row = await prisma.box.findUnique({ where: { id: Number(caixaId) }, select: { apiary_id: true } });
        if (row) apiaryId = row.apiary_id;
      } catch (err) {
        console.error('Error fetching apiaryId via caixaId in checkRole middleware:', err);
      }
    }
  }

  // If the request doesn't involve any apiary context, let other handlers manage it
  if (!apiaryId) {
    return next();
  }

  try {
    const apiary = await getApiaryById(apiaryId);
    if (!apiary) {
      return res.status(404).json({ message: 'Apiário não encontrado.' });
    }

    // Ownership check: apiary must belong to the authenticated user
    if (apiary.user_id !== userId) {
      return res.status(403).json({ message: 'Acesso negado. Este apiário pertence a outro usuário.' });
    }

    req.userRole = 'owner';
    next();
  } catch (error) {
    console.error('Error in checkRole middleware:', error);
    res.status(500).json({ message: 'Erro ao validar posse do recurso.' });
  }
}
