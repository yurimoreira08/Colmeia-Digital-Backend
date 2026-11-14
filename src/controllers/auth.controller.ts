/** Controllers: Cadastro, login, sessão, perfil, termos e recuperação de senha. */
import type { Request, Response } from 'express';
import * as authService from '../services/authService.js';
import { authenticatedUserId } from '../middlewares/auth.js';
import { sendErrorResponse } from '../middlewares/errorHandler.js';

export async function registerController(req: Request, res: Response): Promise<void> {
  try {
    const result = await authService.register(req.body);
    res.status(201).json({ ...result.user, token: result.token });
  } catch (error) {
    sendErrorResponse(res, error, 'Erro no registro.', 'registerController');
  }
}

export async function loginController(req: Request, res: Response): Promise<void> {
  try {
    const result = await authService.login(req.body);
    res.status(200).json({ ...result.user, token: result.token });
  } catch (error) {
    sendErrorResponse(res, error, 'Erro no login.', 'loginController');
  }
}

export async function meController(req: Request, res: Response): Promise<void> {
  try {
    const user = await authService.getCurrentUser(req.userId);
    res.status(200).json(user);
  } catch (error) {
    sendErrorResponse(res, error, 'Erro ao obter dados da sessão.', 'meController');
  }
}

export async function logoutController(req: Request, res: Response): Promise<void> {
  try {
    await authService.logout(req.token, req.userId);
    res.status(200).json({ success: true });
  } catch (error) {
    sendErrorResponse(res, error, 'Erro ao encerrar sessão.', 'logoutController');
  }
}

export async function updateProfileController(req: Request, res: Response): Promise<void> {
  try {
    const updated = await authService.updateProfile(authenticatedUserId(req), req.body);
    res.status(200).json(updated);
  } catch (error) {
    sendErrorResponse(res, error, 'Erro ao atualizar perfil.', 'updateProfileController');
  }
}

export async function acceptTermsController(req: Request, res: Response): Promise<void> {
  try {
    const version = req.body?.version || 'v1';
    const user = await authService.acceptTerms(authenticatedUserId(req), version);
    res.status(200).json(user);
  } catch (error) {
    sendErrorResponse(res, error, 'Erro ao registrar aceite dos termos.', 'acceptTermsController');
  }
}

export async function forgotPasswordController(req: Request, res: Response): Promise<void> {
  try {
    const { email } = req.body || {};
    const result = await authService.requestPasswordReset(email);
    res.status(200).json(result);
  } catch (error) {
    sendErrorResponse(res, error, 'Erro ao solicitar recuperação de senha.', 'forgotPasswordController');
  }
}

export async function resetPasswordController(req: Request, res: Response): Promise<void> {
  try {
    const { email, code, newPassword } = req.body || {};
    const result = await authService.resetPasswordWithCode({ email, code, newPassword });
    res.status(200).json(result);
  } catch (error) {
    sendErrorResponse(res, error, 'Erro ao redefinir senha.', 'resetPasswordController');
  }
}
