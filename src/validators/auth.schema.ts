import { z } from 'zod';
import { emailField } from './common.schema.js';

/** Senha como texto. O tamanho mínimo de senhas novas é conferido no authService. */
const passwordField = z.string({ error: 'Informe a senha.' }).max(256, 'Senha muito longa.');
const nameField = z.string({ error: 'Informe seu nome completo.' }).max(120, 'Nome muito longo.');
const deviceInfo = z.string().max(200).optional();
const termsVersion = z.string().max(20).optional();

export const registerBodySchema = z.object({
  name: nameField,
  email: emailField,
  password: passwordField,
  deviceInfo,
  termsAcceptedVersion: termsVersion,
});

export const loginBodySchema = z.object({
  email: emailField,
  password: passwordField,
  deviceInfo,
});

export const updateProfileBodySchema = z.object({
  name: nameField,
  email: emailField,
  photo: z.string().max(2048).nullish(),
});

export const acceptTermsBodySchema = z.object({ version: termsVersion });

export const forgotPasswordBodySchema = z.object({ email: emailField });

export const resetPasswordBodySchema = z.object({
  email: emailField,
  code: z.string({ error: 'Informe o código de verificação de 6 dígitos.' }).max(12),
  newPassword: z.string({ error: 'Informe a nova senha.' }).max(256, 'Senha muito longa.'),
});
