/** Controllers: Manejos. */
import type { Request, Response } from 'express';
import { withSignedPhotos } from '../services/storageService.js';
import * as manejoService from '../services/manejoService.js';
import { sendErrorResponse } from '../middlewares/errorHandler.js';

export async function listManejosController(req: Request, res: Response): Promise<void> {
  try {
    const apiaryId = req.query.apiaryId ? Number(req.query.apiaryId) : undefined;
    const caixaId = req.query.caixaId ? Number(req.query.caixaId) : undefined;
    const includeArchived = req.query.includeArchived === 'true';

    const manejos = await manejoService.listManejoReports({
      tipo: 'apiario',
      apiaryId,
      caixaId,
      includeArchived,
    }, req.userId);
    res.status(200).json(await withSignedPhotos(manejos, 'photoUri'));
  } catch (error) {
    sendErrorResponse(res, error, 'Erro ao listar manejos.', 'listManejosController');
  }
}

export async function saveManejoController(req: Request, res: Response): Promise<void> {
  try {
    const created = await manejoService.saveManejoService(req.body, req.userId);
    res.status(201).json({ success: true, id: created.id });
  } catch (error) {
    sendErrorResponse(res, error, 'Erro ao salvar manejo.', 'saveManejoController');
  }
}

export async function updateManejoController(req: Request, res: Response): Promise<void> {
  try {
    const id = Number(req.params.id);
    await manejoService.updateManejoService(id, req.body, req.userId);
    res.status(200).json({ success: true });
  } catch (error) {
    sendErrorResponse(res, error, 'Erro ao atualizar manejo.', 'updateManejoController');
  }
}

export async function deleteManejoController(req: Request, res: Response): Promise<void> {
  try {
    const id = Number(req.params.id);
    await manejoService.deleteManejoService(id, req.userId);
    res.status(200).json({ success: true });
  } catch (error) {
    sendErrorResponse(res, error, 'Erro ao excluir manejo.', 'deleteManejoController');
  }
}

export async function archiveManejoController(req: Request, res: Response): Promise<void> {
  try {
    const id = Number(req.params.id);
    await manejoService.archiveManejo(id, req.userId);
    res.status(200).json({ success: true });
  } catch (error) {
    sendErrorResponse(res, error, 'Erro ao arquivar manejo.', 'archiveManejoController');
  }
}

export async function unarchiveManejoController(req: Request, res: Response): Promise<void> {
  try {
    const id = Number(req.params.id);
    await manejoService.unarchiveManejo(id, req.userId);
    res.status(200).json({ success: true });
  } catch (error) {
    sendErrorResponse(res, error, 'Erro ao desarquivar manejo.', 'unarchiveManejoController');
  }
}
