# Banco local e migrations

A produção usa um único banco no Supabase. Para desenvolver e, principalmente,
para **ensaiar migrations**, use um Postgres local. Nunca rode `prisma migrate dev`
ou `prisma db push` apontando para a produção.

## 1. Subir o Postgres local

**Com Docker** (recomendado):

```bash
docker compose up -d
```

**Sem Docker**, com os binários do PostgreSQL instalados (ex.: `C:\Program Files\PostgreSQL\18\bin`):

```powershell
$pg = 'C:\Program Files\PostgreSQL\18\bin'
& "$pg\initdb.exe" -D .pgdata -U colmeia -A trust -E UTF8
& "$pg\pg_ctl.exe" -D .pgdata -o "-p 55432" -l .pgdata\pg.log start
& "$pg\psql.exe" -h 127.0.0.1 -p 55432 -U colmeia -d postgres -c "CREATE DATABASE colmeia_dev;"
```

Depois, num `.env.local` (ou exportando no terminal):

```
DATABASE_URL=postgresql://colmeia:colmeia@localhost:55432/colmeia_dev
```

## 2. Criar o schema

Banco vazio: `npm run db:migrate:deploy` aplica todas as migrations de `prisma/migrations`.

Cópia da produção (para ensaio realista):

```powershell
.\scripts\backup-db.ps1                         # gera backups/backup_<data>.sql
& "$pg\psql.exe" -h 127.0.0.1 -p 55432 -U colmeia -d colmeia_dev -f backups\backup_<data>.sql
npx prisma migrate resolve --applied 0_init     # o dump já tem o schema do baseline
npm run db:migrate:deploy
```

## 3. Criar uma migration nova

1. Altere `prisma/schema.prisma`.
2. Com o `DATABASE_URL` **local**: `npm run db:migrate:create -- --name descricao_curta`.
3. **Leia o SQL gerado.** O Prisma pode apagar e recriar colunas ao mudar o tipo
   (isso perderia dados). Prefira `ALTER COLUMN ... TYPE ... USING ...` e
   envolva a migration em `BEGIN; ... COMMIT;`.
4. Ensaie numa cópia da produção (passo 2) e confira os dados e o drift:
   `npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --script`
   (saída vazia = banco e schema iguais).

## 4. Aplicar em produção

1. `.\scripts\backup-db.ps1`
2. Migration que só acrescenta: `npm run db:migrate:deploy` com o `DATABASE_URL` de produção e, depois, publique o código. Migration que remove ou muda coluna usada: publique primeiro e espere o deploy (`GET /api/v1/health` mostra o commit em `version`). Detalhes em [ARQUITETURA.md](ARQUITETURA.md#banco-de-dados).
3. Confira se o app em produção segue respondendo.
4. `npm run db:migrate:status` deve dizer que está tudo aplicado.

Rollback: `.\scripts\restore-db.ps1` com o backup do passo 1 e reverter o commit
(ver `docs/ROLLBACK-MIGRATIONS.md`).

## Histórico

- `0_init`: baseline do schema de produção em 14/11/2026 (marcado como aplicado, não roda).
- `20261114120000_fks_booleans_attempts`: FKs de revisões/manejos/notificações,
  flags `archived`/`read` como BOOLEAN, coluna `attempts` e remoção de 4 registros órfãos.
- `prisma/legacy/`: migration antiga (25/10/2026) nunca registrada, fora do fluxo. Ver o comentário no arquivo.
