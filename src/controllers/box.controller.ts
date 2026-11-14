/** Controllers: Caixas (colmeias). */
import type { Request, Response } from 'express';
import * as boxService from '../services/boxService.js';
import { sendErrorResponse } from '../middlewares/errorHandler.js';

export async function listBoxesController(req: Request, res: Response): Promise<void> {
  try {
    const apiaryId = req.query.apiaryId ? Number(req.query.apiaryId) : undefined;
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const includeArchived = req.query.includeArchived === 'true';

    const boxes = await boxService.listRegisteredBoxes({
      apiaryId,
      search,
      includeArchived,
    }, req.userId);
    res.status(200).json(boxes);
  } catch (error) {
    sendErrorResponse(res, error, 'Erro ao listar caixas.', 'listBoxesController');
  }
}

export async function createBoxController(req: Request, res: Response): Promise<void> {
  try {
    const box = await boxService.createRegisteredBox(req.body, req.userId);
    res.status(201).json(box);
  } catch (error) {
    sendErrorResponse(res, error, 'Erro ao criar caixa.', 'createBoxController');
  }
}

export async function renameBoxController(req: Request, res: Response): Promise<void> {
  try {
    const boxId = Number(req.params.id);
    const { name } = req.body;
    await boxService.renameRegisteredBox(boxId, name, req.userId);
    res.status(200).json({ success: true });
  } catch (error) {
    sendErrorResponse(res, error, 'Erro ao renomear caixa.', 'renameBoxController');
  }
}

export async function deleteBoxController(req: Request, res: Response): Promise<void> {
  try {
    const boxId = Number(req.params.id);
    await boxService.deleteRegisteredBox(boxId, req.userId);
    res.status(200).json({ success: true });
  } catch (error) {
    sendErrorResponse(res, error, 'Erro ao excluir caixa.', 'deleteBoxController');
  }
}

export async function archiveBoxController(req: Request, res: Response): Promise<void> {
  try {
    const boxId = Number(req.params.id);
    await boxService.archiveBox(boxId, req.userId);
    res.status(200).json({ success: true });
  } catch (error) {
    sendErrorResponse(res, error, 'Erro ao arquivar caixa.', 'archiveBoxController');
  }
}

export async function unarchiveBoxController(req: Request, res: Response): Promise<void> {
  try {
    const boxId = Number(req.params.id);
    await boxService.unarchiveBox(boxId, req.userId);
    res.status(200).json({ success: true });
  } catch (error) {
    sendErrorResponse(res, error, 'Erro ao desarquivar caixa.', 'unarchiveBoxController');
  }
}
