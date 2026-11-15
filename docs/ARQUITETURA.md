# Arquitetura — Colmeia Digital Backend

API REST do Colmeia Digital (projeto FAPEPI): apiários, caixas (colmeias), revisões e manejos de campo.
O cliente é o app mobile offline-first [Colmeia-Digital-Frontend](https://github.com/yurimoreira08/Colmeia-Digital-Frontend).

## Stack

- Node.js 22 + Express 4 + TypeScript (ESM, `"type": "module"`, `module: NodeNext`: imports relativos **com extensão `.js`**).
- Prisma 5 → PostgreSQL no Supabase (`DATABASE_URL`), com Prisma Migrate (`prisma/migrations`).
- Supabase Storage para fotos (bucket público).
- Zod 4 (env e todas as rotas, locale pt), bcryptjs, multer (memória, 5 MB), helmet, express-rate-limit.
- E-mail pela API do Resend ou por SMTP (nodemailer 10).
- Deploy no Render, automático no push para `main`. `GET /api/v1/health` mostra o commit em execução (`version`).

## Estrutura

```
src/server.ts            prisma.$connect() + app.listen
src/app.ts               trust proxy → helmet → cors(lista) → rate limits → json(1mb; 8mb em /upload)
                         → parseUserId → requireAuth → /api/v1 → 404 → errorHandler
src/config/              env.ts (Zod), runtime.ts (isProductionRuntime), trustedProxies.ts
src/errors/AppError.ts   AppError (mensagem para o usuário + status) e NotFoundError (404)
src/middlewares/         auth, validate (Zod → 422), authorize (posse por rota), rateLimit, errorHandler
src/validators/          schemas Zod por domínio (*.schema.ts)
src/routes/              api.routes.ts (todas as rotas), reports.routes.ts, index.ts (/health)
src/controllers/         um arquivo por domínio (auth, apiary, box, revision, manejo, notification,
                         upload, sync, reports); api.controller.ts só reexporta para api.routes.ts
src/services/            regras de negócio (authService, apiaryService, boxService, manejoService, ...)
src/data/repositories/   acesso ao Prisma + mapeamento snake_case (banco) → camelCase (API);
                         ownershipRepository concentra a regra de posse
src/data/prisma.ts       PrismaClient singleton
src/types/               mobile-models.ts (contratos com o app), express.d.ts (req.userId/token)
prisma/migrations/       0_init (baseline de 14/11/2026) + migrations
```

## Fluxo de uma requisição

`validate({ body, query, params })` (formato, 422) → `require*()` de `authorize.ts` (posse: 404 se não existe, 403 se é de outro usuário) → controller → service → repository → Prisma.

### Erros

- Services lançam `AppError`/`NotFoundError` com mensagem em português, escrita para o usuário.
- O `catch` do controller chama `sendErrorResponse(res, error, 'mensagem genérica', 'nomeDoController')`:
  - `AppError` → status e mensagem do próprio erro;
  - qualquer outro erro (Prisma, Supabase, bug) → registrado no log, e o cliente recebe 500 com a mensagem genérica.
- Formato de erro: `{ message }`. Erros de validação (422) trazem também `errors: [{ field, message }]`.
- O `errorHandler` final responde em JSON a JSON malformado (400), corpo grande demais (413) e rotas inexistentes (404).

## Autenticação

- O login gera um token aleatório (32 bytes, hex). Só o **SHA-256** dele fica em `sessions.token_hash` (validade de 30 dias). O cliente envia `Authorization: Bearer <token>`.
- **Sessão deslizante:** `authenticateToken` renova a validade para 30 dias a partir do uso, no máximo uma vez por dia por sessão. Quem usa o app nunca perde a sessão; antes a validade contava só do login, e o sync recebia 401 depois de 30 dias.
- `parseUserId` resolve `req.userId`; `requireAuth` bloqueia tudo, exceto a lista `publicPaths`.
- **Senhas:** senhas novas têm de 8 a 72 caracteres e valem **exatamente como digitadas** (sem trim), com bcrypt custo 12. O login não aplica a política (contas antigas podem ter senhas curtas) e regrava o hash quando o custo é antigo ou quando ele só bateu pela versão com trim (hashes antigos).
- **Respostas nunca trazem o hash da senha:** toda resposta com usuário usa `PublicUser`, via `toPublicUser()`.
- **Recuperação de senha:** código de 6 dígitos (guardado como SHA-256), válido por 15 minutos. Trocar a senha encerra todas as sessões. Depois de 5 códigos errados o código ativo é invalidado (coluna `password_resets.attempts`, que sobrevive a reinícios). O pedido de código responde sempre a mesma mensagem, exista o e-mail ou não.

## Autorização (posse)

- O dono do apiário é dono de tudo o que está nele.
- `authorize.ts` confere a posse em cada rota:
  - apiário, caixa, revisão e manejo pelo `:id`;
  - o apiário informado no body (`POST /boxes`, edição em `POST /apiaries`) e na query (`?apiaryId=`);
  - na criação de revisão ou manejo, a caixa precisa ser do usuário **e** do `apiaryId` informado (422 se não for).
- Os repositórios continuam filtrando por usuário (`findOwnedApiaryIds`) como segunda camada.
- Recurso de outro usuário responde **403** (e não 404): o sync do app trata 403 de apiário marcando o registro como resolvido.

## Proteções

- **Rate limit** (`middlewares/rateLimit.ts`, em memória, válido para uma instância):
  - geral: 1000 requisições a cada 15 min por IP;
  - login, cadastro e reset: 10 **falhas** a cada 15 min por IP (sucessos não contam, porque muitos usuários do interior saem pelo mesmo IP da operadora);
  - pedido de código: 3 por hora por e-mail.
  - Com mais de uma instância, troque o store por Redis.
- **IP do cliente:** `TRUST_PROXY` vazio confia na rede privada e nas faixas do Cloudflare (`src/config/trustedProxies.ts`). O caminho no Render é cliente → Cloudflare → proxies internos (10.x). `GET /api/v1/health/client-ip` (público) mostra o IP que a API enxerga; ele precisa bater com o IP público real.
- **Headers:** helmet com CSP `default-src 'none'`, HSTS e nosniff. CORS só para as origens de `CORS_ORIGINS`.
- **Uploads:** todos passam por `storageService.uploadBufferToStorage`, que confere os magic bytes (JPEG, PNG ou WEBP), limita a 5 MB e gera o caminho no servidor. Imagem inválida → `InvalidImageError` (400).
- **E-mail:** os logs nunca trazem o destinatário nem o conteúdo. Sem provedor configurado, em produção nada é impresso. Se o provedor configurado falhar, `sendEmail` devolve `false`.
- **Produção** = `isProductionRuntime()`: `NODE_ENV=production` **ou** `RENDER=true`. Não defina `NODE_ENV=production` no Render: o `npm install` do build pularia as devDependencies (TypeScript) e o deploy quebraria.

## Modelo de dados (`prisma/schema.prisma`)

- `User` 1-N `Session`, `PasswordReset`, `Apiary`, `Notification`.
- `Apiary` 1-N `Box`, `ReviewReport`, `Manejo`; `Box` 1-N `ReviewReport`, `Manejo` (todas com `onDelete: Cascade`).
- `Manejo` N-1 `ReviewReport` (`SetNull`).
- Revisões e manejos guardam também `caixa_name`/`apiary_name` (denormalizados) e o `user_id` de quem criou (pode ser nulo em dados antigos).
- `checked_options` é JSON em texto. `archived` e `read` são `Boolean`.
- `client_uuid` (único, gerado no aparelho) em apiários, caixas, revisões e manejos garante a idempotência do sync offline. Reenviar um `client_uuid` de outra conta responde 409 (achado S20).
- `DeletedRecord` (`deleted_records`): cada exclusão feita no servidor grava `entity` + `record_id` na mesma transação, para o pull incremental avisar os outros aparelhos. Apiário e caixa geram um registro só; o app apaga os filhos localmente.
- Exclusões e arquivamentos em cascata rodam em `prisma.$transaction` e apagam por `apiary_id`/`caixa_id`.
- `terms_version` e `terms_accepted_version` guardam a versão dos termos aceita; a migration `20261114210000_backfill_terms_version` preencheu o `terms_version` dos usuários antigos (a migration legada de 25/10/2026 nunca tinha rodado).

## Banco de dados

Existe **um único banco Supabase, e ele é a produção**. Desenvolvimento e ensaio de migrations usam um Postgres local: veja [BANCO-LOCAL.md](BANCO-LOCAL.md). Rollback em [ROLLBACK-MIGRATIONS.md](ROLLBACK-MIGRATIONS.md) e procedimento de testes em [AMBIENTE-DE-TESTES.md](AMBIENTE-DE-TESTES.md).

Fluxo de migration:
1. Alterar `schema.prisma`.
2. `npm run db:migrate:create -- --name x` contra o banco **local**.
3. **Ler e corrigir o SQL gerado.** Ao mudar o tipo de uma coluna, o Prisma apaga e recria; use `ALTER ... TYPE ... USING` dentro de `BEGIN/COMMIT`.
4. Ensaiar numa cópia restaurada do backup.
5. `scripts/backup-db.ps1`.
6. Ordem entre migration e deploy:
   - **Migration que só acrescenta** (tabela, coluna nula, índice): `db:migrate:deploy` em produção **antes** do push. O código antigo funciona com o banco novo, mas o código novo quebraria sem as colunas (o Prisma Client lê todas).
   - **Migration que remove ou muda** coluna usada pelo código atual: push primeiro (código que não depende dela), espere o `/health` mostrar o commit, depois a migration.
7. `npm run db:migrate:status` deve dizer que está tudo aplicado.

**Backup agendado** (`.github/workflows/backup.yml`): todo dia às 03:00 (Brasília) e sob demanda. Faz o `pg_dump` do schema public, restaura num Postgres vazio para provar que o backup abre (e avisa se faltar migration), criptografa com AES-256 (gpg) e guarda como artefato por 30 dias. O repositório é público: o dump nunca sai em texto puro, e o log não mostra dados nem contagens. Segredos: `BACKUP_DATABASE_URL` e `BACKUP_PASSPHRASE`. Para abrir: `gpg --decrypt backup.sql.gpg > backup.sql` e o passo 2 de [BANCO-LOCAL.md](BANCO-LOCAL.md).

## Observabilidade

- **Logs** (`src/lib/logger.ts`, pino): JSON, uma linha por evento. Senha, token, código de reset, e-mail e cabeçalhos de autenticação saem como "[oculto]". Use `logger` (ou `req.log`, que já traz o id da requisição), nunca `console`.
- **Id da requisição** (`middlewares/requestLogger.ts`): toda resposta traz `X-Request-Id` (gerado, ou o do cliente, se for seguro), e o log de acesso registra método, caminho sem query, status e duração.
- **Sentry** (`src/lib/sentry.ts`): só liga com `SENTRY_DSN`. Recebe os erros inesperados (500) de `sendErrorResponse`, com o id da requisição e do usuário. Sem IP, cookies, corpo, query nem cabeçalho de autenticação.
- **Desligamento gracioso** (`server.ts`): no SIGTERM do Render, para de aceitar conexões, espera as requisições em andamento (até 10 s), fecha o Prisma e esvazia a fila do Sentry.

## Dados pessoais (LGPD)

- `GET /auth/export`: perfil e tudo o que o usuário cadastrou (inclusive arquivados), num JSON para download.
- `DELETE /auth/account` com `{ password }`: confere a senha (com o rate limit da autenticação), apaga numa transação a conta e todos os dados (manejos, revisões, caixas, apiários, notificações, sessões, códigos de reset, registros de exclusão) e, depois, as fotos do usuário no storage. Se o storage falhar, os dados já saíram e o log registra as fotos para limpeza manual.

## Fotos e storage

- O banco guarda a URL **sem prazo** da foto (`toStoredPhotoUrl`): URLs assinadas recebidas do app voltam para essa forma ao salvar.
- Com `STORAGE_PRIVATE=true`, as respostas (manejos, pull do sync, conflito do lote, exportação, upload e foto de perfil) trazem URLs assinadas, válidas por `SIGNED_URL_TTL_SECONDS` (30 dias), geradas numa chamada só por resposta. O app faz um download completo a cada 7 dias, que renova as URLs.
- Para ativar: tornar o bucket privado no Supabase e definir `STORAGE_PRIVATE=true` no Render, nessa ordem e juntos (com a flag desligada e o bucket privado, as fotos param de abrir).

## Variáveis de ambiente

Modelo completo em `.env.example` (o `.env` real é ignorado pelo git).

| Variável | Uso |
|---|---|
| `PORT` | Porta do servidor (padrão 4000) |
| `DATABASE_URL` | PostgreSQL (hoje, a produção) |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (ou `SUPABASE_ANON_KEY`), `SUPABASE_BUCKET_NAME` | Storage das fotos |
| `RESEND_API_KEY`, `RESEND_FROM`, `SMTP_*` | E-mail de recuperação de senha |
| `NODE_ENV` | Não use `production` no Render (ver "Proteções") |
| `CORS_ORIGINS` | Origens web separadas por vírgula; vazio = nenhuma |
| `TRUST_PROXY` | Vazio = rede privada + Cloudflare |
| `RENDER_GIT_COMMIT` | Definida pelo Render; aparece no `/health` |
| `SENTRY_DSN` | Sentry; vazio = desligado |
| `LOG_LEVEL` | Nível dos logs; vazio = info (silent nos testes) |
| `STORAGE_PRIVATE`, `SIGNED_URL_TTL_SECONDS` | Fotos em bucket privado com URLs assinadas (ver "Fotos e storage") |

## Contrato com o app

Rotas, nomes de campo (`boxCount` é **texto** no `POST /apiaries`), formato de erro e `{ success: true, id }` nos saves fazem parte do contrato com o app. O app envia `null` em campos vazios vindos do SQLite, e os schemas aceitam. Mudanças de contrato precisam ser feitas junto no app e documentadas em `docs/CONTRATO-API-*.md`.

### Sync em lote (F3)

As rotas antigas (uma requisição por registro e as listagens completas) continuam para as versões instaladas do app. As novas:

- `GET /sync/changes?since=<serverTime>`: o que mudou desde o último sync (apiários, caixas, revisões e manejos com `updated_at` depois de `since`, com 2 minutos de margem), as exclusões do período (`deletions: [{ entity, id, deletedAt }]`) e as 50 notificações recentes, no formato das listagens. Sem `since`, devolve tudo (`full: true`). O app guarda o `serverTime` da resposta para o próximo pull.
- `POST /sync`: lote com `deletions`, `apiaries`, `boxes`, `revisions` e `manejos` (até 100 por lista). Cada item tem `localId` (id no SQLite; negativo se criado offline) e, se já existe no servidor, `id` e `baseUpdatedAt`. Pais podem ser referenciados por id negativo de um item do mesmo lote. Processa nessa ordem, com os mesmos services e regras de posse das rotas antigas, e responde 200 com o resultado de cada item:
  - `created`/`updated` com o `id` do servidor;
  - `conflict`: o registro mudou no servidor depois de `baseUpdatedAt`; nada é gravado e `server` traz a versão atual, que prevalece;
  - `rejected` (não encontrado, de outro usuário, pai recusado, dado inválido) com `message`;
  - `error`: falha inesperada; o app reenvia depois.
- Apiários, caixas, revisões e manejos trazem `updatedAt` (última alteração no servidor). O app guarda esse valor e o devolve como `baseUpdatedAt` ao enviar uma alteração.
- As fotos de manejo continuam subindo antes, por `POST /upload/manejo-photo`; no lote vai só a URL.
