/** Controllers: Notificações. */
import type { Request, Response } from 'express';
import { sendErrorResponse } from '../middlewares/errorHandler.js';
import { listRecentNotifications, createNotification, markNotificationAsRead, markAllNotificationsAsRead } from '../data/repositories/notificationsRepository.js';

export async function listNotificationsController(req: Request, res: Response): Promise<void> {
  try {
    if (!req.userId) {
      res.status(401).json({ message: 'Não autorizado. Usuário não identificado.' });
      return;
    }
    const notifs = await listRecentNotifications(req.userId, 50);
    res.status(200).json(notifs);
  } catch (error) {
    sendErrorResponse(res, error, 'Erro ao listar notificações.', 'listNotificationsController');
  }
}

export async function createNotificationController(req: Request, res: Response): Promise<void> {
  try {
    const notif = await createNotification(req.body, req.userId);
    res.status(201).json(notif);
  } catch (error) {
    sendErrorResponse(res, error, 'Erro ao criar notificação.', 'createNotificationController');
  }
}

export async function markNotificationReadController(req: Request, res: Response): Promise<void> {
  try {
    const id = Number(req.params.id);
    await markNotificationAsRead(id, req.userId);
    res.status(200).json({ success: true });
  } catch (error) {
    sendErrorResponse(res, error, 'Erro ao marcar notificação como lida.', 'markNotificationReadController');
  }
}

export async function markAllNotificationsReadController(req: Request, res: Response): Promise<void> {
  try {
    await markAllNotificationsAsRead(req.userId);
    res.status(200).json({ success: true });
  } catch (error) {
    sendErrorResponse(res, error, 'Erro ao marcar todas notificações como lidas.', 'markAllNotificationsReadController');
  }
}
