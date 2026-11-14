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
  /**
   * Origens web autorizadas a chamar a API via navegador, separadas por vírgula
   * (ex.: "https://painel.exemplo.com,http://localhost:8081"). O app nativo não
   * envia Origin e não depende disto. Vazio = nenhuma origem web liberada.
   */
  /**
   * Quantos proxies reversos ficam na frente da API (valor de `trust proxy`).
   * Errar para menos faz todos os clientes parecerem o mesmo IP no rate limit;
   * errar para mais permite falsificar o IP via X-Forwarded-For.
   */
  TRUST_PROXY: z.coerce.number().int().min(0).default(1),
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
