import type { NextFunction, Request, RequestHandler, Response } from 'express';
import {
  findApiaryOwnerId,
  findBoxOwnership,
  findFieldRecordOwnerId,
} from '../data/repositories/ownershipRepository.js';
import { sendErrorResponse } from './errorHandler.js';

/**
 * Autorização por rota: cada middleware confere a posse de um recurso
 * específico antes do controller. Rodam **depois** do `validate()`, então
 * ids já chegam como números.
 *
 * Respostas: 404 quando o recurso não existe, 403 quando existe e é de outro
 * usuário (o sync do app trata o 403 parando de reenviar o registro). Os
 * repositórios continuam filtrando por usuário: é a segunda camada de defesa.
 */

const FORBIDDEN_MESSAGE = 'Acesso negado. Este recurso pertence a outro usuário.';

type OwnerLookup = (req: Request) => Promise<{ ownerId: number | null } | null>;

/** Monta um middleware a partir de "como descobrir o dono" e da mensagem de não encontrado. */
function requireOwnership(lookup: OwnerLookup, notFoundMessage: string): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const resource = await lookup(req);
      if (!resource) {
        res.status(404).json({ message: notFoundMessage });
        return;
      }
      if (resource.ownerId !== req.userId) {
        res.status(403).json({ message: FORBIDDEN_MESSAGE });
        return;
      }
      next();
    } catch (error) {
      sendErrorResponse(res, error, 'Erro ao validar posse do recurso.', 'authorize');
    }
  };
}

async function apiaryOwner(apiaryId: number) {
  const ownerId = await findApiaryOwnerId(apiaryId);
  return ownerId === null ? null : { ownerId };
}

/** `/apiaries/:id` */
export const requireApiaryFromParams = requireOwnership((req) => apiaryOwner(Number(req.params.id)), 'Apiário não encontrado.');

/** `/boxes/:id/...` */
export const requireBoxFromParams = requireOwnership((req) => findBoxOwnership(Number(req.params.id)), 'Caixa não encontrada.');

/** `/revisions/:id/...` */
export const requireRevisionFromParams = requireOwnership(async (req) => {
  const ownerId = await findFieldRecordOwnerId('revision', Number(req.params.id));
  return ownerId === null ? null : { ownerId };
}, 'Revisão não encontrada.');

/** `/manejos/:id/...` */
export const requireManejoFromParams = requireOwnership(async (req) => {
  const ownerId = await findFieldRecordOwnerId('manejo', Number(req.params.id));
  return ownerId === null ? null : { ownerId };
}, 'Manejo não encontrado.');

/** `POST /boxes`: o apiário onde a caixa será criada. */
export const requireApiaryFromBody = requireOwnership((req) => apiaryOwner(Number(req.body.apiaryId)), 'Apiário não encontrado.');

/**
 * `POST /apiaries`: com `id` é edição e o apiário precisa ser do usuário;
 * sem `id` é criação e não há o que conferir.
 */
export const requireApiaryForSave: RequestHandler = (req, res, next) => {
  if (req.body.id === undefined) {
    next();
    return;
  }
  return requireOwnership((r) => apiaryOwner(Number(r.body.id)), 'Apiário não encontrado.')(req, res, next);
};

/** Listagens com `?apiaryId=`: o filtro precisa ser de um apiário do usuário. */
export const requireApiaryFromQuery: RequestHandler = (req, res, next) => {
  if (req.query.apiaryId === undefined) {
    next();
    return;
  }
  return requireOwnership((r) => apiaryOwner(Number(r.query.apiaryId)), 'Apiário não encontrado.')(req, res, next);
};

/**
 * Criação de revisão ou manejo: a caixa precisa ser do usuário e, se o
 * apiário foi informado, precisa ser o apiário **da caixa**. Sem isso, um
 * usuário poderia pendurar registros na caixa de outro informando o próprio
 * apiário (achado S19).
 */
export const requireRecordTargetFromBody: RequestHandler = async (req, res, next) => {
  try {
    const box = await findBoxOwnership(Number(req.body.caixaId));
    if (!box) {
      res.status(404).json({ message: 'Caixa não encontrada.' });
      return;
    }
    if (box.ownerId !== req.userId) {
      res.status(403).json({ message: FORBIDDEN_MESSAGE });
      return;
    }
    const apiaryId = req.body.apiaryId;
    if (apiaryId !== null && apiaryId !== undefined && Number(apiaryId) !== box.apiaryId) {
      res.status(422).json({
        message: 'A caixa informada não pertence a este apiário.',
        errors: [{ field: 'apiaryId', message: 'A caixa informada não pertence a este apiário.' }],
      });
      return;
    }
    next();
  } catch (error) {
    sendErrorResponse(res, error, 'Erro ao validar posse do recurso.', 'authorize');
  }
};
