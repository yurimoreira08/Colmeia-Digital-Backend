/** Controllers: Uploads de imagem (foto de perfil e de manejo). */
import type { Request, Response } from 'express';
import * as storageService from '../services/storageService.js';
import { sendErrorResponse } from '../middlewares/errorHandler.js';

/**
 * Upload de imagem em base64 (usado pela foto de perfil).
 * Endpoint: POST /upload — body `{ base64Data, folder }`.
 */
export async function uploadController(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ message: 'Autenticação necessária para upload de imagens.' });
      return;
    }

    const { base64Data, folder } = req.body || {};
    if (!base64Data || typeof base64Data !== 'string') {
      res.status(400).json({ message: 'Nenhum dado de imagem (base64) enviado.' });
      return;
    }

    const targetFolder: storageService.StorageFolder =
      folder === 'profiles' ? 'profiles' : folder === 'manejos' ? 'manejos' : 'geral';

    const result = await storageService.uploadImageToStorage({
      userId,
      folder: targetFolder,
      base64Data,
    });

    res.status(200).json({ success: true, url: result.url, path: result.path });
  } catch (error) {
    sendErrorResponse(res, error, 'Erro ao realizar upload de imagem.', 'uploadController');
  }
}

/**
 * Upload multipart/form-data de fotos de manejo.
 * Endpoint: POST /upload/manejo-photo — campo `photo`.
 */
export async function uploadManejoPhotoController(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ message: 'Autenticação necessária para upload de fotos.' });
      return;
    }

    if (!req.file) {
      res.status(400).json({ message: 'Nenhuma foto enviada no campo multipart "photo".' });
      return;
    }

    const result = await storageService.uploadBufferToStorage({
      userId,
      folder: 'manejos',
      buffer: req.file.buffer,
    });

    res.status(200).json({ success: true, url: result.url, path: result.path });
  } catch (error) {
    sendErrorResponse(res, error, 'Erro ao realizar upload da foto de manejo.', 'uploadManejoPhotoController');
  }
}
