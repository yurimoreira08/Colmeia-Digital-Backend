import * as authService from '../services/authService.js';
import * as apiaryService from '../services/apiaryService.js';
import * as boxService from '../services/boxService.js';
import * as reviewReportService from '../services/reviewReportService.js';
import * as manejoService from '../services/manejoService.js';
import * as storageService from '../services/storageService.js';
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
    res.status(400).json({ message: error instanceof Error ? error.message : 'Erro no registro.' });
  }
}

export async function loginController(req: any, res: any): Promise<void> {
  try {
    const result = await authService.login(req.body);
    res.status(200).json({ ...result.user, token: result.token });
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : 'Erro no login.' });
  }
}

export async function meController(req: any, res: any): Promise<void> {
  try {
    const user = await authService.getCurrentUser(req.userId);
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao obter dados da sessão.' });
  }
}

export async function logoutController(req: any, res: any): Promise<void> {
  try {
    await authService.logout(req.token, req.userId);
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao encerrar sessão.' });
  }
}

export async function updateProfileController(req: any, res: any): Promise<void> {
  try {
    const updated = await authService.updateProfile(req.userId, req.body);
    res.status(200).json(updated);
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : 'Erro ao atualizar perfil.' });
  }
}

export async function acceptTermsController(req: any, res: any): Promise<void> {
  try {
    const version = req.body?.version || 'v1';
    const user = await authService.acceptTerms(req.userId, version);
    res.status(200).json(user);
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : 'Erro ao registrar aceite dos termos.' });
  }
}

export async function forgotPasswordController(req: any, res: any): Promise<void> {
  try {
    const { email } = req.body || {};
    const result = await authService.requestPasswordReset(email);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : 'Erro ao solicitar recuperação de senha.' });
  }
}

export async function resetPasswordController(req: any, res: any): Promise<void> {
  try {
    const { email, code, newPassword } = req.body || {};
    const result = await authService.resetPasswordWithCode({ email, code, newPassword });
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : 'Erro ao redefinir senha.' });
  }
}

// --- APIARY CONTROLLERS ---

export async function listApiariesController(req: any, res: any): Promise<void> {
  try {
    const apiaries = await apiaryService.listAllApiaries(req.userId);
    res.status(200).json(apiaries);
  } catch (error) {
    console.error('[API] Erro ao listar apiários:', error);
    res.status(500).json({ message: 'Erro ao listar apiários.' });
  }
}

export async function getApiaryController(req: any, res: any): Promise<void> {
  try {
    const apiary = await apiaryService.loadApiary(Number(req.params.id), req.userId);
    res.status(200).json(apiary);
  } catch (error) {
    res.status(404).json({ message: 'Apiário não encontrado.' });
  }
}

export async function saveApiaryController(req: any, res: any): Promise<void> {
  try {
    const apiary = await apiaryService.saveApiary(req.body, req.userId);
    res.status(200).json(apiary);
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : 'Erro ao salvar apiário.' });
  }
}

export async function deleteApiaryController(req: any, res: any): Promise<void> {
  try {
    await apiaryService.removeApiary(Number(req.params.id), req.userId);
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao excluir apiário.' });
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
    console.error('[API] Erro ao listar caixas:', error);
    res.status(500).json({ message: 'Erro ao listar caixas.' });
  }
}

export async function createBoxController(req: any, res: any): Promise<void> {
  try {
    const box = await boxService.createRegisteredBox(req.body, req.userId);
    res.status(200).json(box);
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : 'Erro ao criar caixa.' });
  }
}

export async function renameBoxController(req: any, res: any): Promise<void> {
  try {
    const boxId = Number(req.params.id);
    const { name } = req.body;
    await boxService.renameRegisteredBox(boxId, name, req.userId);
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : 'Erro ao renomear caixa.' });
  }
}

export async function deleteBoxController(req: any, res: any): Promise<void> {
  try {
    const boxId = Number(req.params.id);
    await boxService.deleteRegisteredBox(boxId, req.userId);
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao excluir caixa.' });
  }
}

export async function archiveBoxController(req: any, res: any): Promise<void> {
  try {
    const boxId = Number(req.params.id);
    await boxService.archiveBox(boxId, req.userId);
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao arquivar caixa.' });
  }
}

export async function unarchiveBoxController(req: any, res: any): Promise<void> {
  try {
    const boxId = Number(req.params.id);
    await boxService.unarchiveBox(boxId, req.userId);
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao desarquivar caixa.' });
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
    res.status(500).json({ message: 'Erro ao listar relatórios de revisão.' });
  }
}

export async function saveRevisionController(req: any, res: any): Promise<void> {
  try {
    const created = await reviewReportService.saveRevision(req.body, req.userId);
    res.status(200).json({ success: true, id: created.id });
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : 'Erro ao salvar revisão.' });
  }
}

export async function updateRevisionController(req: any, res: any): Promise<void> {
  try {
    const id = Number(req.params.id);
    await reviewReportService.updateRevision(id, req.body, req.userId);
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : 'Erro ao atualizar revisão.' });
  }
}

export async function deleteRevisionController(req: any, res: any): Promise<void> {
  try {
    const id = Number(req.params.id);
    await reviewReportService.deleteRevision(id, req.userId);
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao excluir revisão.' });
  }
}

export async function archiveRevisionController(req: any, res: any): Promise<void> {
  try {
    const id = Number(req.params.id);
    await reviewReportService.archiveRevision(id, req.userId);
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao arquivar revisão.' });
  }
}

export async function unarchiveRevisionController(req: any, res: any): Promise<void> {
  try {
    const id = Number(req.params.id);
    await reviewReportService.unarchiveRevision(id, req.userId);
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao desarquivar revisão.' });
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
    res.status(500).json({ message: 'Erro ao listar manejos.' });
  }
}

export async function saveManejoController(req: any, res: any): Promise<void> {
  try {
    const created = await manejoService.saveManejoService(req.body, req.userId);
    res.status(200).json({ success: true, id: created.id });
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : 'Erro ao salvar manejo.' });
  }
}

export async function updateManejoController(req: any, res: any): Promise<void> {
  try {
    const id = Number(req.params.id);
    await manejoService.updateManejoService(id, req.body, req.userId);
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : 'Erro ao atualizar manejo.' });
  }
}

export async function deleteManejoController(req: any, res: any): Promise<void> {
  try {
    const id = Number(req.params.id);
    await manejoService.deleteManejoService(id, req.userId);
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao excluir manejo.' });
  }
}

export async function archiveManejoController(req: any, res: any): Promise<void> {
  try {
    const id = Number(req.params.id);
    await manejoService.archiveManejo(id, req.userId);
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao arquivar manejo.' });
  }
}

export async function unarchiveManejoController(req: any, res: any): Promise<void> {
  try {
    const id = Number(req.params.id);
    await manejoService.unarchiveManejo(id, req.userId);
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao desarquivar manejo.' });
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
    res.status(500).json({ message: 'Erro ao listar notificações.' });
  }
}

export async function createNotificationController(req: any, res: any): Promise<void> {
  try {
    const notif = await createNotification(req.body, req.userId);
    res.status(200).json(notif);
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : 'Erro ao criar notificação.' });
  }
}

export async function markNotificationReadController(req: any, res: any): Promise<void> {
  try {
    const id = Number(req.params.id);
    await markNotificationAsRead(id, req.userId);
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao marcar notificação como lida.' });
  }
}

export async function markAllNotificationsReadController(req: any, res: any): Promise<void> {
  try {
    await markAllNotificationsAsRead(req.userId);
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao marcar todas notificações como lidas.' });
  }
}

// --- STORAGE / UPLOAD CONTROLLERS ---

/**
 * Responde a uma falha de upload: 400 com a mensagem quando o problema é a
 * imagem enviada, 500 genérico para o resto (sem expor detalhes do Supabase).
 */
function sendUploadError(res: any, error: unknown, logTag: string): void {
  if (error instanceof storageService.InvalidImageError) {
    res.status(400).json({ message: error.message });
    return;
  }
  console.error(`[${logTag}] Falha:`, error instanceof Error ? error.message : error);
  res.status(500).json({ message: 'Erro ao realizar upload de imagem.' });
}

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
    sendUploadError(res, error, 'UploadController');
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
    sendUploadError(res, error, 'UploadManejoPhotoController');
  }
}
