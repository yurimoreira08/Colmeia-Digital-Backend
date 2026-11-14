-- B14 (14/11/2026): o UPDATE da migration legada de 25/10/2026
-- (prisma/legacy/20261025143000_add_terms_version.sql), que nunca rodou.
-- As colunas já existem desde o baseline 0_init; falta só copiar a versão
-- aceita para terms_version nos usuários antigos (4 em produção).
-- Idempotente: rodar de novo não muda nada.

BEGIN;

UPDATE "users"
SET "terms_version" = "terms_accepted_version"
WHERE "terms_version" IS NULL AND "terms_accepted_version" IS NOT NULL;

COMMIT;
