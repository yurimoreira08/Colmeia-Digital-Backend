import dotenv from 'dotenv';

dotenv.config();

export interface SendEmailParams {
  to: string;
  subject: string;
  text: string;
  html: string;
}

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
        console.log(`[EMAIL] E-mail de recuperação enviado com sucesso para ${to} via Resend API`);
        return true;
      } else {
        const errorData = await res.text();
        console.error(`[EMAIL] Falha ao enviar via Resend API (Status ${res.status}):`, errorData);
      }
    } catch (err) {
      console.error('[EMAIL] Erro de rede ao conectar com Resend API:', err);
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

      console.log(`[EMAIL] E-mail de recuperação enviado com sucesso para ${to} via SMTP (${smtpHost})`);
      return true;
    } catch (err) {
      console.error(`[EMAIL] Falha ao enviar e-mail via SMTP (${smtpHost}):`, err);
    }
  }

  // 3. Modo Desenvolvimento / Fallback de Log no Console
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
            <p>Olá, <strong>${userName}</strong>!</p>
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
