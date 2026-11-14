import dotenv from 'dotenv';
import { isProductionRuntime } from '../config/runtime.js';

dotenv.config();

/**
 * Escapa texto para inserir com segurança em HTML.
 * Dados do usuário (ex.: nome) nunca entram crus no corpo do e-mail.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface SendEmailParams {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * Envia um e-mail pelo Resend (RESEND_API_KEY) ou por SMTP (SMTP_HOST/USER/PASS).
 *
 * Os logs nunca incluem o destinatário nem o conteúdo, que pode ter o código
 * de recuperação. Sem provedor configurado, em desenvolvimento o e-mail é
 * mostrado no console; em produção (incluindo o Render) nada é impresso e a
 * função devolve false.
 *
 * @returns true se algum provedor aceitou o envio.
 */
export async function sendEmail(params: SendEmailParams): Promise<boolean> {
  const { to, subject, text, html } = params;

  // 1. Suporte direto a Resend API (se RESEND_API_KEY estiver configurada)
  const resendApiKey = process.env.RESEND_API_KEY;
  if (resendApiKey) {
    try {
      const fromAddress = process.env.RESEND_FROM || process.env.SMTP_FROM || 'Colmeia Digital <onboarding@resend.dev>';
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey.trim()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromAddress,
          to: [to],
          subject,
          text,
          html,
        }),
      });

      if (res.ok) {
        console.log('[EMAIL] E-mail enviado via Resend API.');
        return true;
      } else {
        console.error(`[EMAIL] Falha ao enviar via Resend API (status ${res.status}).`);
      }
    } catch (err) {
      console.error('[EMAIL] Erro de rede ao conectar com a Resend API:', err instanceof Error ? err.name : err);
    }
  }

  // 2. Suporte a Provedores SMTP (Brevo, SendGrid, Mailgun, SMTP Próprio, etc.)
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpFrom = process.env.SMTP_FROM || 'Colmeia Digital <nao-responda@colmeiadigital.com>';

  if (smtpHost && smtpUser && smtpPass) {
    try {
      const nodemailer = await import('nodemailer');
      const transporter = nodemailer.default.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      await transporter.sendMail({
        from: smtpFrom,
        to,
        subject,
        text,
        html,
      });

      console.log('[EMAIL] E-mail enviado via SMTP.');
      return true;
    } catch (err) {
      // A mensagem do erro do SMTP pode citar o destinatário; registra só o código.
      const code = (err as { code?: string })?.code ?? (err instanceof Error ? err.name : 'erro desconhecido');
      console.error(`[EMAIL] Falha ao enviar e-mail via SMTP (${code}).`);
    }
  }

  // 3. Sem provedor configurado
  if (isProductionRuntime()) {
    console.error('[EMAIL] Nenhum provedor de e-mail configurado (RESEND_API_KEY ou SMTP_*). E-mail não enviado.');
    return false;
  }

  // Só em desenvolvimento: mostra o e-mail no console para testar o fluxo localmente.
  console.log('\n===============================================================');
  console.log(`  📧 [EMAIL DISPARADO] Para: ${to}`);
  console.log(`  Assunto: ${subject}`);
  console.log(`  Conteúdo:\n${text}`);
  console.log('===============================================================\n');

  return true;
}

export async function sendPasswordResetEmail(email: string, code: string, userName: string): Promise<boolean> {
  const subject = `${code} é o seu código de recuperação - Colmeia Digital`;

  const text = `Olá, ${userName}!\n\nRecebemos uma solicitação para redefinir a senha da sua conta no Colmeia Digital.\n\nSeu código de verificação é:\n\n👉  ${code}  👈\n\nEste código é válido por 15 minutos.\n\nSe você não solicitou a redefinição de senha, ignore este e-mail. Sua conta continua segura.`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f6f9; margin: 0; padding: 20px; }
          .card { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
          .header { background: #f59e0b; padding: 28px 20px; text-align: center; color: #1e293b; }
          .header h1 { margin: 0; font-size: 22px; font-weight: 800; letter-spacing: 1px; }
          .content { padding: 30px 24px; color: #334155; line-height: 1.6; }
          .code-box { background: #fef3c7; border: 2px dashed #f59e0b; border-radius: 8px; padding: 18px; text-align: center; margin: 24px 0; }
          .code { font-size: 32px; font-weight: 800; color: #b45309; letter-spacing: 6px; }
          .footer { padding: 20px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            <h1>🐝 COLMEIA DIGITAL</h1>
          </div>
          <div class="content">
            <p>Olá, <strong>${escapeHtml(userName)}</strong>!</p>
            <p>Recebemos uma solicitação para redefinir a senha da sua conta.</p>
            <p>Utilize o código de verificação abaixo no aplicativo para criar uma nova senha:</p>
            
            <div class="code-box">
              <div class="code">${code}</div>
              <small style="color: #92400e; display: block; margin-top: 6px;">Válido por 15 minutos</small>
            </div>

            <p style="font-size: 13px; color: #64748b;">Se você não solicitou a redefinição de senha, nenhuma ação é necessária. Sua senha atual permanecerá segura.</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} Colmeia Digital - Gestão e Monitoramento de Apiários</p>
          </div>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject,
    text,
    html,
  });
}
