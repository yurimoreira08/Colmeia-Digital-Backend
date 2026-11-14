-- Fase 3, F3 (14/11/2026): suporte ao sync em lote e ao pull incremental.
--
-- Só acrescenta: nenhuma coluna existente muda e nenhum dado é reescrito.
-- O código antigo continua funcionando com o banco novo, então esta
-- migration é aplicada ANTES do deploy do código que a usa.
-- Ensaiado numa cópia restaurada da produção antes de aplicar.

BEGIN;

-- 1. Exclusões feitas no servidor (tombstones), lidas pelo GET /sync/changes.
CREATE TABLE "deleted_records" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "entity" TEXT NOT NULL,
    "record_id" INTEGER NOT NULL,
    "deleted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deleted_records_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "deleted_records_user_id_deleted_at_idx" ON "deleted_records"("user_id", "deleted_at");

ALTER TABLE "deleted_records" ADD CONSTRAINT "deleted_records_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 2. Id gerado no aparelho para apiários e caixas (revisões e manejos já têm):
--    reenviar a mesma criação não duplica o registro. Nulo nos registros atuais.
ALTER TABLE "apiaries" ADD COLUMN "client_uuid" TEXT;
CREATE UNIQUE INDEX "apiaries_client_uuid_key" ON "apiaries"("client_uuid");

ALTER TABLE "boxes" ADD COLUMN "client_uuid" TEXT;
CREATE UNIQUE INDEX "boxes_client_uuid_key" ON "boxes"("client_uuid");

-- 3. Índices para buscar o que mudou desde o último sync.
CREATE INDEX "apiaries_user_id_updated_at_idx" ON "apiaries"("user_id", "updated_at");
CREATE INDEX "boxes_updated_at_idx" ON "boxes"("updated_at");
CREATE INDEX "review_reports_updated_at_idx" ON "review_reports"("updated_at");
CREATE INDEX "manejos_updated_at_idx" ON "manejos"("updated_at");

COMMIT;
