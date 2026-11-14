# Desenvolvimento — Colmeia Digital Backend

Convenções de código e de testes. A arquitetura está em [ARQUITETURA.md](ARQUITETURA.md).

## Ao alterar código

- **Rota nova:**
  1. `validate()` com o schema em `src/validators/`, aceitando `null` nos campos que o app manda do SQLite;
  2. o `require*()` de posse adequado, de `authorize.ts`;
  3. uma linha na matriz de `tests/integration/authorization.test.ts`.
- Queries de escrita sempre filtram pelo dono (`where: { id, user_id }` ou via `apiary: { user_id }`). Nunca `update({ where: { id } })` só pelo id.
- Respostas com usuário usam `PublicUser` via `toPublicUser()`. O hash da senha nunca sai do servidor.
- Uploads passam por `storageService.uploadBufferToStorage`.
- Operações que mexem em mais de uma tabela vão em `prisma.$transaction`.
- Configuração só via `src/config/env.ts`: adicione a variável no schema Zod e evite `process.env` direto.
- Não registre no log tokens, códigos de reset, e-mails completos nem payloads com dados pessoais.
- Mudou rota, contrato, variável de ambiente ou comando? Atualize o README e os `docs/` na mesma entrega.

## Organização e legibilidade

- **Uma responsabilidade por arquivo e por função.** Respeite as camadas (rota → controller → service → repository) sem pular nenhuma.
  - Controllers: um arquivo por domínio (`<dominio>.controller.ts`), com `req: Request` e `res: Response` do Express (sem `any`). Em rota protegida, use `authenticatedUserId(req)` para obter o id do usuário já tipado.
  - Criação responde **201**; leitura, edição e exclusão, **200**. Rotas mantidas só para versões antigas do app respondem com o cabeçalho `Deprecation`.
  - Funções com mais de ~50 linhas ou mais de 3 níveis de aninhamento devem ser quebradas.
- **Nomes** descritivos e no vocabulário do domínio (`apiary`, `box`/`caixa`, `revision`, `manejo`). Nada de `data`, `tmp`, `x`. Booleanos começam com `is`, `has` ou `should`.
- **Tipos:** sem `any` em código novo. Tipe `req`/`res` com `Request`/`Response` e crie DTOs explícitos de entrada (schema Zod com `z.infer`) e de saída. O código antigo ainda usa `req: any, res: any`.
- **Documentação:**
  - JSDoc curto em toda função exportada de service e repository: o que faz, regras de negócio e de autorização, erros lançados.
  - Comentários explicam o **porquê** (regra de negócio, contorno, decisão de segurança), não repetem o código.
  - Tudo em português, como o resto do projeto.
- **Sem código morto:** nada de código comentado, stubs `export {}`, `console.log` de debug ou arquivos temporários. Remova o que estiver comprovadamente sem uso (confirme com busca).
- **Sem duplicação:** a mesma lógica 2 ou 3 vezes vira um helper.
- **Consistência:** siga o padrão do arquivo vizinho (formato de erro `{ message }`, mapeadores `mapPrisma*`, mensagens em português).

## Testes (Vitest + Supertest)

- `tests/integration/`: testes HTTP sobre `createApp()` com supertest. `tests/unit/`: services e configuração.
- **Os testes nunca acessam o banco nem o bucket reais.** O `vitest.config.ts` injeta variáveis de ambiente falsas, e os módulos são trocados por mocks:
  - `vi.mock('../../src/data/prisma.js', () => import('../helpers/prismaMock.js'))`, com `resetPrismaMock()` no `beforeEach`;
  - `tests/helpers/fakeDb.ts` (`useFakeDb`): apiários, caixas, revisões, manejos e notificações em memória, respeitando o `where` do Prisma (igualdade, `in`, comparações, `OR`/`AND`, texto sem diferenciar maiúsculas, filtro de relação `apiary`), com **rollback de verdade** no `$transaction`;
  - `tests/helpers/userTable.ts` (`useAuthTables`): usuários, sessões e códigos de reset; aceita o estado anterior para simular reinício do servidor;
  - `vi.mock('@supabase/supabase-js', () => import('../helpers/supabaseMock.js'))` registra os uploads em `uploads`;
  - `tests/helpers/fixtures.ts`: `userRow`, `apiaryRow`, `mockSessionsFor(...ids)` e `authHeader(id)` para autenticar.
- `authorization.test.ts` é a matriz de acesso cruzado (IDOR). Toda rota nova com `:id` ou dono ganha uma linha lá.
- Verifique o **efeito** nas tabelas em memória, não a query montada.
- **Teste de correção de bug:** mostre que ele falha sem a correção (`git stash push -- src` → `npm test` → `git stash pop`).
- Um teste que passa pelo motivo errado não prova nada. Confira que o payload é válido: senão a validação recusa antes da regra que se quer testar.

## Verificação e CI

Antes de qualquer commit, tudo precisa passar, parando no primeiro erro:

```bash
npm run typecheck && npm run build && npm test && npm run lint
```

O lint precisa ter 0 erros; os avisos de `any` do código antigo são tolerados.

O CI (`.github/workflows/ci.yml`, GitHub Actions) roda typecheck, lint, testes, build e `npm audit --omit=dev --audit-level=high`. Ele também tem um job que aplica todas as migrations num Postgres vazio e confere que o banco ficou igual ao `schema.prisma`.

## Scripts úteis

- `npm run seed`: dados de exemplo (`prisma/seed.ts`).
- `npm run check-db`: contagens das tabelas.
- `npm run dry-run-cleanup` / `npm run cleanup-db`: deduplicação de caixas (o `cleanup-db` **executa**).
- `scripts/test-full-suite.ps1`: suíte manual via HTTP. Bate no servidor real: não use contra produção.
- `scripts/backup-db.ps1` / `scripts/restore-db.ps1`: backup e restauração do banco.
