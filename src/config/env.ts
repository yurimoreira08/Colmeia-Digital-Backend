import dotenv from 'dotenv';
import { z } from 'zod';
import { parseTrustProxy } from './trustedProxies.js';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
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
   * Vazio = padrão de `trustedProxies.ts` (rede privada + Cloudflare), que é
   * o caminho do Render. Aceita também um número de saltos ("1"), "true"/
   * "false" ou uma lista de IPs/CIDRs separada por vírgula. Confira após o
   * deploy com GET /api/v1/health/client-ip: tem que ser o IP público real.
   */
  TRUST_PROXY: z
    .string()
    .default('')
    .transform(parseTrustProxy),
  CORS_ORIGINS: z
    .string()
    .default('')
    .transform((value) => value.split(',').map((origin) => origin.trim()).filter(Boolean)),
  /** DSN do Sentry. Vazio = Sentry desligado (desenvolvimento, testes). */
  SENTRY_DSN: z.string().default(''),
  /** Nível dos logs (trace, debug, info, warn, error, fatal, silent). Vazio = info (silent nos testes). */
  LOG_LEVEL: z.string().default(''),
  /**
   * Fotos em bucket privado: as respostas trazem URLs assinadas com prazo, e não
   * a URL pública. Só ligue depois de tornar o bucket privado no Supabase.
   */
  STORAGE_PRIVATE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  /** Validade das URLs assinadas das fotos, em segundos (padrão: 30 dias). */
  SIGNED_URL_TTL_SECONDS: z.coerce.number().int().positive().default(30 * 24 * 60 * 60),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
  throw new Error(`Falha ao carregar variaveis de ambiente: ${details}`);
}

export const env = parsed.data;
