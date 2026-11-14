-- CreateTable
CREATE TABLE "apiaries" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "box_count" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "apiaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_config" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "app_config_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "boxes" (
    "id" SERIAL NOT NULL,
    "apiary_id" INTEGER NOT NULL,
    "user_id" INTEGER,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "archived" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "boxes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manejos" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "apiary_id" INTEGER,
    "apiary_name" TEXT,
    "caixa_id" INTEGER NOT NULL,
    "caixa_name" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "revisao_id" INTEGER,
    "checked_options" TEXT NOT NULL,
    "observacoes" TEXT,
    "indicacoes" TEXT,
    "photo_uri" TEXT,
    "archived" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "client_uuid" TEXT,

    CONSTRAINT "manejos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "title" TEXT NOT NULL,
    "subtitle" TEXT NOT NULL,
    "read" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_resets" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "code_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_resets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_reports" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "apiary_id" INTEGER,
    "apiary_name" TEXT,
    "caixa_id" INTEGER NOT NULL,
    "caixa_name" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "checked_options" TEXT NOT NULL,
    "observacoes" TEXT,
    "indicacoes" TEXT,
    "archived" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "client_uuid" TEXT,

    CONSTRAINT "review_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "token_hash" TEXT NOT NULL,
    "device_info" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "photo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "terms_accepted_at" TIMESTAMP(3),
    "terms_accepted_version" TEXT,
    "terms_version" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "apiaries_user_id_idx" ON "apiaries"("user_id" ASC);

-- CreateIndex
CREATE INDEX "boxes_apiary_id_archived_idx" ON "boxes"("apiary_id" ASC, "archived" ASC);

-- CreateIndex
CREATE INDEX "boxes_user_id_idx" ON "boxes"("user_id" ASC);

-- CreateIndex
CREATE INDEX "manejos_apiary_id_caixa_id_idx" ON "manejos"("apiary_id" ASC, "caixa_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "manejos_client_uuid_key" ON "manejos"("client_uuid" ASC);

-- CreateIndex
CREATE INDEX "manejos_created_at_idx" ON "manejos"("created_at" ASC);

-- CreateIndex
CREATE INDEX "manejos_user_id_idx" ON "manejos"("user_id" ASC);

-- CreateIndex
CREATE INDEX "notifications_user_id_idx" ON "notifications"("user_id" ASC);

-- CreateIndex
CREATE INDEX "idx_password_resets_code_hash" ON "password_resets"("code_hash" ASC);

-- CreateIndex
CREATE INDEX "idx_password_resets_user_id" ON "password_resets"("user_id" ASC);

-- CreateIndex
CREATE INDEX "password_resets_code_hash_idx" ON "password_resets"("code_hash" ASC);

-- CreateIndex
CREATE INDEX "password_resets_user_id_idx" ON "password_resets"("user_id" ASC);

-- CreateIndex
CREATE INDEX "review_reports_apiary_id_caixa_id_idx" ON "review_reports"("apiary_id" ASC, "caixa_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "review_reports_client_uuid_key" ON "review_reports"("client_uuid" ASC);

-- CreateIndex
CREATE INDEX "review_reports_created_at_idx" ON "review_reports"("created_at" ASC);

-- CreateIndex
CREATE INDEX "review_reports_user_id_idx" ON "review_reports"("user_id" ASC);

-- CreateIndex
CREATE INDEX "sessions_token_hash_idx" ON "sessions"("token_hash" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash" ASC);

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email" ASC);

-- AddForeignKey
ALTER TABLE "apiaries" ADD CONSTRAINT "apiaries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boxes" ADD CONSTRAINT "boxes_apiary_id_fkey" FOREIGN KEY ("apiary_id") REFERENCES "apiaries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_resets" ADD CONSTRAINT "password_resets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

