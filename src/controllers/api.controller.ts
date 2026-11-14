import * as authService from '../services/authService.js';
import * as apiaryService from '../services/apiaryService.js';
import * as boxService from '../services/boxService.js';
import * as reviewReportService from '../services/reviewReportService.js';
import * as manejoService from '../services/manejoService.js';
import * as storageService from '../services/storageService.js';
import { sendErrorResponse } from '../middlewares/errorHandler.js';
import { 
  listRecentNotifications, 
  createNotification, 
  markNotificationAsRead, 
  markAllNotificationsAsRead 
} from '../data/repositories/notificationsRepository.js';

// --- AUTH CONTROLLERS ---

export async function registerController(req: any, res: any): Promise<void> {
  try {
    const result = await authService.register(req.body);
    res.status(200).json({ ...result.user, token: result.token });
  } catch (error) {
    sendErrorResponse(res, error, 'Erro no registro.', 'registerController');
  }
}

export async function loginController(req: any, res: any): Promise<void> {
  try {
    const result = await authService.login(req.body);
    res.status(200).json({ ...result.user, token: result.token });
  } catch (error) {
    sendErrorResponse(res, error, 'Erro no login.', 'loginController');
  }
}

export async function meController(req: any, res: any): Promise<void> {
  try {
    const user = await authService.getCurrentUser(req.userId);
    res.status(200).json(user);
  } catch (error) {
    sendErrorResponse(res, error, 'Erro ao obter dados da sessão.', 'meController');
  }
}

export async function logoutController(req: any, res: any): Promise<void> {
  try {
    await authService.logout(req.token, req.userId);
    res.status(200).json({ success: true });
  } catch (error) {
    sendErrorResponse(res, error, 'Erro ao encerrar sessão.', 'logoutController');
  }
}

export async function updateProfileController(req: any, res: any): Promise<void> {
  try {
    const updated = await authService.updateProfile(req.userId, req.body);
    res.status(200).json(updated);
  } catch (error) {
    sendErrorResponse(res, error, 'Erro ao atualizar perfil.', 'updateProfileController');
  }
}

export async function acceptTermsController(req: any, res: any): Promise<void> {
  try {
    const version = req.body?.version || 'v1';
    const user = await authService.acceptTerms(req.userId, version);
    res.status(200).json(user);
  } catch (error) {
    sendErrorResponse(res, error, 'Erro ao registrar aceite dos termos.', 'acceptTermsController');
  }
}

export async function forgotPasswordController(req: any, res: any): Promise<void> {
  try {
    const { email } = req.body || {};
    const result = await authService.requestPasswordReset(email);
    res.status(200).json(result);
  } catch (error) {
    sendErrorResponse(res, error, 'Erro ao solicitar recuperação de senha.', 'forgotPasswordController');
  }
}

export async function resetPasswordController(req: any, res: any): Promise<void> {
  try {
    const { email, code, newPassword } = req.body || {};
    const result = await authService.resetPasswordWithCode({ email, code, newPassword });
    res.status(200).json(result);
  } catch (error) {
    sendErrorResponse(res, error, 'Erro ao redefinir senha.', 'resetPasswordController');
  }
}

// --- APIARY CONTROLLERS ---

export async function listApiariesController(req: any, res: any): Promise<void> {
  try {
    const apiaries = await apiaryService.listAllApiaries(req.userId);
    res.status(200).json(apiaries);
  } catch (error) {
    sendErrorResponse(res, error, 'Erro ao listar apiários.', 'listApiariesController');
  }
}

export async function getApiaryController(req: any, res: any): Promise<void> {
  try {
    const apiary = await apiaryService.loadApiary(Number(req.params.id), req.userId);
    res.status(200).json(apiary);
  } catch (error) {
    sendErrorResponse(res, error, 'Erro ao carregar apiário.', 'getApiaryController');
  }
}

export async function saveApiaryController(req: any, res: any): Promise<void> {
  try {
    const apiary = await apiaryService.saveApiary(req.body, req.userId);
    res.status(200).json(apiary);
  } catch (error) {
    sendErrorResponse(res, error, 'Erro ao salvar apiário.', 'saveApiaryController');
  }
}

export async function deleteApiaryController(req: any, res: any): Promise<void> {
  try {
    await apiaryService.removeApiary(Number(req.params.id), req.userId);
    res.status(200).json({ success: true });
  } catch (error) {
    sendErrorResponse(res, error, 'Erro ao excluir apiário.', 'deleteApiaryController');
  }
}

// --- BOXES CONTROLLERS ---

export async function listBoxesController(req: any, res: any): Promise<void> {
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

export async function createBoxController(req: any, res: any): Promise<void> {
  try {
    const box = await boxService.createRegisteredBox(req.body, req.userId);
    res.status(200).json(box);
  } catch (error) {
    sendErrorResponse(res, error, 'Erro ao criar caixa.', 'createBoxController');
  }
}

export async function renameBoxController(req: any, res: any): Promise<void> {
  try {
    const boxId = Number(req.params.id);
    const { name } = req.body;
    await boxService.renameRegisteredBox(boxId, name, req.userId);
    res.status(200).json({ success: true });
  } catch (error) {
    sendErrorResponse(res, error, 'Erro ao renomear caixa.', 'renameBoxController');
  }
}

export async function deleteBoxController(req: any, res: any): Promise<void> {
  try {
    const boxId = Number(req.params.id);
    await boxService.deleteRegisteredBox(boxId, req.userId);
    res.status(200).json({ success: true });
  } catch (error) {
    sendErrorResponse(res, error, 'Erro ao excluir caixa.', 'deleteBoxController');
  }
}

export async function archiveBoxController(req: any, res: any): Promise<void> {
  try {
    const boxId = Number(req.params.id);
    await boxService.archiveBox(boxId, req.userId);
    res.status(200).json({ success: true });
  } catch (error) {
    sendErrorResponse(res, error, 'Erro ao arquivar caixa.', 'archiveBoxController');
  }
}

export async function unarchiveBoxController(req: any, res: any): Promise<void> {
  try {
    const boxId = Number(req.params.id);
    await boxService.unarchiveBox(boxId, req.userId);
    res.status(200).json({ success: true });
  } catch (error) {
    sendErrorResponse(res, error, 'Erro ao desarquivar caixa.', 'unarchiveBoxController');
  }
}

// --- REVISION CONTROLLERS ---

export async function listRevisionsController(req: any, res: any): Promise<void> {
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

export async function saveRevisionController(req: any, res: any): Promise<void> {
  try {
    const created = await reviewReportService.saveRevision(req.body, req.userId);
    res.status(200).json({ success: true, id: created.id });
  } catch (error) {
    sendErrorResponse(res, error, 'Erro ao salvar revisão.', 'saveRevisionController');
  }
}

export async function updateRevisionController(req: any, res: any): Promise<void> {
  try {
    const id = Number(req.params.id);
    await reviewReportService.updateRevision(id, req.body, req.userId);
    res.status(200).json({ success: true });
  } catch (error) {
    sendErrorResponse(res, error, 'Erro ao atualizar revisão.', 'updateRevisionController');
  }
}

export async function deleteRevisionController(req: any, res: any): Promise<void> {
  try {
    const id = Number(req.params.id);
    await reviewReportService.deleteRevision(id, req.userId);
    res.status(200).json({ success: true });
  } catch (error) {
    sendErrorResponse(res, error, 'Erro ao excluir revisão.', 'deleteRevisionController');
  }
}

export async function archiveRevisionController(req: any, res: any): Promise<void> {
  try {
    const id = Number(req.params.id);
    await reviewReportService.archiveRevision(id, req.userId);
    res.status(200).json({ success: true });
  } catch (error) {
    sendErrorResponse(res, error, 'Erro ao arquivar revisão.', 'archiveRevisionController');
  }
}

export async function unarchiveRevisionController(req: any, res: any): Promise<void> {
  try {
    const id = Number(req.params.id);
    await reviewReportService.unarchiveRevision(id, req.userId);
    res.status(200).json({ success: true });
  } catch (error) {
    sendErrorResponse(res, error, 'Erro ao desarquivar revisão.', 'unarchiveRevisionController');
  }
}

// --- MANEJO CONTROLLERS ---

export async function listManejosController(req: any, res: any): Promise<void> {
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
    res.status(200).json(manejos);
  } catch (error) {
    sendErrorResponse(res, error, 'Erro ao listar manejos.', 'listManejosController');
  }
}

export async function saveManejoController(req: any, res: any): Promise<void> {
  try {
    const created = await manejoService.saveManejoService(req.body, req.userId);
    res.status(200).json({ success: true, id: created.id });
  } catch (error) {
    sendErrorResponse(res, error, 'Erro ao salvar manejo.', 'saveManejoController');
  }
}

export async function updateManejoController(req: any, res: any): Promise<void> {
  try {
    const id = Number(req.params.id);
    await manejoService.updateManejoService(id, req.body, req.userId);
    res.status(200).json({ success: true });
  } catch (error) {
    sendErrorResponse(res, error, 'Erro ao atualizar manejo.', 'updateManejoController');
  }
}

export async function deleteManejoController(req: any, res: any): Promise<void> {
  try {
    const id = Number(req.params.id);
    await manejoService.deleteManejoService(id, req.userId);
    res.status(200).json({ success: true });
  } catch (error) {
    sendErrorResponse(res, error, 'Erro ao excluir manejo.', 'deleteManejoController');
  }
}

export async function archiveManejoController(req: any, res: any): Promise<void> {
  try {
    const id = Number(req.params.id);
    await manejoService.archiveManejo(id, req.userId);
    res.status(200).json({ success: true });
  } catch (error) {
    sendErrorResponse(res, error, 'Erro ao arquivar manejo.', 'archiveManejoController');
  }
}

export async function unarchiveManejoController(req: any, res: any): Promise<void> {
  try {
    const id = Number(req.params.id);
    await manejoService.unarchiveManejo(id, req.userId);
    res.status(200).json({ success: true });
  } catch (error) {
    sendErrorResponse(res, error, 'Erro ao desarquivar manejo.', 'unarchiveManejoController');
  }
}

// --- NOTIFICATIONS CONTROLLERS ---

export async function listNotificationsController(req: any, res: any): Promise<void> {
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

export async function createNotificationController(req: any, res: any): Promise<void> {
  try {
    const notif = await createNotification(req.body, req.userId);
    res.status(200).json(notif);
  } catch (error) {
    sendErrorResponse(res, error, 'Erro ao criar notificação.', 'createNotificationController');
  }
}

export async function markNotificationReadController(req: any, res: any): Promise<void> {
  try {
    const id = Number(req.params.id);
    await markNotificationAsRead(id, req.userId);
    res.status(200).json({ success: true });
  } catch (error) {
    sendErrorResponse(res, error, 'Erro ao marcar notificação como lida.', 'markNotificationReadController');
  }
}

export async function markAllNotificationsReadController(req: any, res: any): Promise<void> {
  try {
    await markAllNotificationsAsRead(req.userId);
    res.status(200).json({ success: true });
  } catch (error) {
    sendErrorResponse(res, error, 'Erro ao marcar todas notificações como lidas.', 'markAllNotificationsReadController');
  }
}

// --- STORAGE / UPLOAD CONTROLLERS ---

/**
 * Upload de imagem em base64 (usado pela foto de perfil).
 * Endpoint: POST /upload — body `{ base64Data, folder }`.
 */
export async function uploadController(req: any, res: any): Promise<void> {
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
export async function uploadManejoPhotoController(req: any, res: any): Promise<void> {
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
