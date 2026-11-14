import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  DATABASE_PATH: z.string().default('./colmeia_digital.db'),
  DATABASE_URL: z.string().optional(),
  SUPABASE_URL: z.string().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_BUCKET_NAME: z.string().default('colmeia-digital'),
  // Texto livre (e não enum) para um valor inesperado no Render não derrubar o servidor.
  NODE_ENV: z.string().default('development'),
  /**
   * Origens web autorizadas a chamar a API via navegador, separadas por vírgula
   * (ex.: "https://painel.exemplo.com,http://localhost:8081"). O app nativo não
   * envia Origin e não depende disto. Vazio = nenhuma origem web liberada.
   */
  /**
   * Quais proxies reversos são confiáveis (valor de `trust proxy` do Express).
   *
   * Padrão: só endereços de rede privada. O Render usa vários saltos internos
   * em 10.0.0.0/8 (em quantidade variável), então um número fixo de saltos
   * falha; confiando só na rede privada, o IP do cliente é o primeiro endereço
   * público a partir da direita do X-Forwarded-For e não pode ser forjado.
   *
   * Aceita também um número de saltos ("1") ou "true"/"false". Confira após o
   * deploy com GET /api/v1/health/client-ip: tem que ser o IP público real.
   */
  TRUST_PROXY: z
    .string()
    .default('loopback, linklocal, uniquelocal')
    .transform((value): boolean | number | string => {
      const trimmed = value.trim();
      if (/^d+$/.test(trimmed)) return Number(trimmed);
      if (trimmed === 'true') return true;
      if (trimmed === 'false') return false;
      return trimmed;
    }),
  CORS_ORIGINS: z
    .string()
    .default('')
    .transform((value) => value.split(',').map((origin) => origin.trim()).filter(Boolean)),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
  throw new Error(`Falha ao carregar variaveis de ambiente: ${details}`);
}

export const env = parsed.data;
