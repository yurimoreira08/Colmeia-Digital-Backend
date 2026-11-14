/** Controllers: Apiários. */
import type { Request, Response } from 'express';
import * as apiaryService from '../services/apiaryService.js';
import { sendErrorResponse } from '../middlewares/errorHandler.js';

export async function listApiariesController(req: Request, res: Response): Promise<void> {
  try {
    const apiaries = await apiaryService.listAllApiaries(req.userId);
    res.status(200).json(apiaries);
  } catch (error) {
    sendErrorResponse(res, error, 'Erro ao listar apiários.', 'listApiariesController');
  }
}

export async function getApiaryController(req: Request, res: Response): Promise<void> {
  try {
    const apiary = await apiaryService.loadApiary(Number(req.params.id), req.userId);
    res.status(200).json(apiary);
  } catch (error) {
    sendErrorResponse(res, error, 'Erro ao carregar apiário.', 'getApiaryController');
  }
}

export async function saveApiaryController(req: Request, res: Response): Promise<void> {
  try {
    const apiary = await apiaryService.saveApiary(req.body, req.userId);
    // Sem id é criação (201); com id, edição (200).
    res.status(req.body.id ? 200 : 201).json(apiary);
  } catch (error) {
    sendErrorResponse(res, error, 'Erro ao salvar apiário.', 'saveApiaryController');
  }
}

export async function deleteApiaryController(req: Request, res: Response): Promise<void> {
  try {
    await apiaryService.removeApiary(Number(req.params.id), req.userId);
    res.status(200).json({ success: true });
  } catch (error) {
    sendErrorResponse(res, error, 'Erro ao excluir apiário.', 'deleteApiaryController');
  }
}
