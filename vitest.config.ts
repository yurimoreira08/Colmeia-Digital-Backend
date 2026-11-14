import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // Valores falsos de propósito: o dotenv não sobrescreve variáveis já
    // definidas, então nenhum teste consegue alcançar o banco ou o bucket
    // reais (o banco do projeto é o de produção). Prisma e Supabase também
    // são substituídos por mocks em tests/helpers.
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://test:test@127.0.0.1:1/colmeia_test',
      SUPABASE_URL: 'https://test-project.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
      SUPABASE_ANON_KEY: '',
      SUPABASE_BUCKET_NAME: 'colmeia-test',
      RESEND_API_KEY: '',
      SMTP_HOST: '',
      CORS_ORIGINS: 'https://painel.colmeiadigital.test',
    },
    restoreMocks: true,
  },
});
