-- Fase 2 (14/11/2026): chaves estrangeiras de revisões, manejos e notificações,
-- flags como BOOLEAN e o contador de tentativas do código de reset.
--
-- Escrito à mão: o SQL gerado pelo Prisma apagava e recriava as colunas
-- archived/read, o que zeraria quais registros estão arquivados/lidos.
-- Ensaiado numa cópia restaurada da produção antes de aplicar.

-- Tudo numa transação: no Postgres o Prisma não envolve a migration numa,
-- e uma falha no meio deixaria a produção pela metade.
BEGIN;

-- 1. Registros órfãos (apontam para caixa ou apiário que não existem mais).
--    Sem isto as chaves estrangeiras não podem ser criadas. Exportados antes
--    para backups/ (fora do git).
DELETE FROM "manejos" m
WHERE NOT EXISTS (SELECT 1 FROM "boxes" b WHERE b."id" = m."caixa_id")
   OR (m."apiary_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "apiaries" a WHERE a."id" = m."apiary_id"));

DELETE FROM "review_reports" r
WHERE NOT EXISTS (SELECT 1 FROM "boxes" b WHERE b."id" = r."caixa_id")
   OR (r."apiary_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "apiaries" a WHERE a."id" = r."apiary_id"));

-- Manejo cuja revisão de origem não existe mais só perde o vínculo.
UPDATE "manejos" m SET "revisao_id" = NULL
WHERE m."revisao_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "review_reports" r WHERE r."id" = m."revisao_id");

DELETE FROM "notifications" n
WHERE n."user_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "users" u WHERE u."id" = n."user_id");

-- 2. Flags inteiras (0/1) viram BOOLEAN preservando o valor. O índice
--    boxes(apiary_id, archived) é reconstruído pelo próprio ALTER TYPE.
ALTER TABLE "boxes"
  ALTER COLUMN "archived" DROP DEFAULT,
  ALTER COLUMN "archived" TYPE BOOLEAN USING ("archived" <> 0),
  ALTER COLUMN "archived" SET DEFAULT false;

ALTER TABLE "review_reports"
  ALTER COLUMN "archived" DROP DEFAULT,
  ALTER COLUMN "archived" TYPE BOOLEAN USING ("archived" <> 0),
  ALTER COLUMN "archived" SET DEFAULT false;

ALTER TABLE "manejos"
  ALTER COLUMN "archived" DROP DEFAULT,
  ALTER COLUMN "archived" TYPE BOOLEAN USING ("archived" <> 0),
  ALTER COLUMN "archived" SET DEFAULT false;

ALTER TABLE "notifications"
  ALTER COLUMN "read" DROP DEFAULT,
  ALTER COLUMN "read" TYPE BOOLEAN USING ("read" <> 0),
  ALTER COLUMN "read" SET DEFAULT false;

-- 3. Contador de tentativas do código de reset. IF NOT EXISTS porque a versão
--    anterior do backend já criava a coluna em tempo de execução.
ALTER TABLE "password_resets" ADD COLUMN IF NOT EXISTS "attempts" INTEGER NOT NULL DEFAULT 0;

-- 4. Índice para a nova chave estrangeira de revisão.
CREATE INDEX "manejos_revisao_id_idx" ON "manejos"("revisao_id");

-- 5. Chaves estrangeiras.
ALTER TABLE "review_reports" ADD CONSTRAINT "review_reports_caixa_id_fkey" FOREIGN KEY ("caixa_id") REFERENCES "boxes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "review_reports" ADD CONSTRAINT "review_reports_apiary_id_fkey" FOREIGN KEY ("apiary_id") REFERENCES "apiaries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "manejos" ADD CONSTRAINT "manejos_caixa_id_fkey" FOREIGN KEY ("caixa_id") REFERENCES "boxes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "manejos" ADD CONSTRAINT "manejos_apiary_id_fkey" FOREIGN KEY ("apiary_id") REFERENCES "apiaries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "manejos" ADD CONSTRAINT "manejos_revisao_id_fkey" FOREIGN KEY ("revisao_id") REFERENCES "review_reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
