-- LEGADO (fora do Prisma Migrate). Migration de 25/10/2026 que nunca foi registrada.
-- As colunas já existem em produção e estão no baseline 0_init. O UPDATE abaixo
-- nunca rodou em produção (4 usuários têm terms_version nulo e
-- terms_accepted_version preenchido; a API já devolve o valor certo pelo
-- fallback do mapPrismaUser). Só aplique com decisão explícita.

-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "terms_accepted_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "terms_version" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "terms_accepted_version" TEXT;

-- Update existing terms_version if terms_accepted_version was set
UPDATE "users" SET "terms_version" = "terms_accepted_version" WHERE "terms_version" IS NULL AND "terms_accepted_version" IS NOT NULL;
