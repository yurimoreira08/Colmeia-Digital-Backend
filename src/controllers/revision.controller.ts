/** Controllers: Revisões. */
import type { Request, Response } from 'express';
import * as reviewReportService from '../services/reviewReportService.js';
import { sendErrorResponse } from '../middlewares/errorHandler.js';

export async function listRevisionsController(req: Request, res: Response): Promise<void> {
  try {
    const apiaryId = req.query.apiaryId ? Number(req.query.apiaryId) : undefined;
    const caixaId = req.query.caixaId ? Number(req.query.caixaId) : undefined;
    const includeArchived = req.query.includeArchived === 'true';

    const revisions = await reviewReportService.listRevisionReports({
      tipo: 'apiario',
      apiaryId,
      caixaId,
      includeArchived,
    }, req.userId);
    res.status(200).json(revisions);
  } catch (error) {
    sendErrorResponse(res, error, 'Erro ao listar relatórios de revisão.', 'listRevisionsController');
  }
}

export async function saveRevisionController(req: Request, res: Response): Promise<void> {
  try {
    const created = await reviewReportService.saveRevision(req.body, req.userId);
    res.status(201).json({ success: true, id: created.id });
  } catch (error) {
    sendErrorResponse(res, error, 'Erro ao salvar revisão.', 'saveRevisionController');
  }
}

export async function updateRevisionController(req: Request, res: Response): Promise<void> {
  try {
    const id = Number(req.params.id);
    await reviewReportService.updateRevision(id, req.body, req.userId);
    res.status(200).json({ success: true });
  } catch (error) {
    sendErrorResponse(res, error, 'Erro ao atualizar revisão.', 'updateRevisionController');
  }
}

export async function deleteRevisionController(req: Request, res: Response): Promise<void> {
  try {
    const id = Number(req.params.id);
    await reviewReportService.deleteRevision(id, req.userId);
    res.status(200).json({ success: true });
  } catch (error) {
    sendErrorResponse(res, error, 'Erro ao excluir revisão.', 'deleteRevisionController');
  }
}

export async function archiveRevisionController(req: Request, res: Response): Promise<void> {
  try {
    const id = Number(req.params.id);
    await reviewReportService.archiveRevision(id, req.userId);
    res.status(200).json({ success: true });
  } catch (error) {
    sendErrorResponse(res, error, 'Erro ao arquivar revisão.', 'archiveRevisionController');
  }
}

export async function unarchiveRevisionController(req: Request, res: Response): Promise<void> {
  try {
    const id = Number(req.params.id);
    await reviewReportService.unarchiveRevision(id, req.userId);
    res.status(200).json({ success: true });
  } catch (error) {
    sendErrorResponse(res, error, 'Erro ao desarquivar revisão.', 'unarchiveRevisionController');
  }
}
