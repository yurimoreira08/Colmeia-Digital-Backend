# 🔄 Guia de Rollback de Migrations no Prisma

Este documento orienta como desfazer ou reverter alterações de esquema de banco de dados (schema) gerenciadas pelo **Prisma ORM** de forma segura, profissional e sem perda acidental de dados.

---

## 1. O Modelo do Prisma: *Forward-Only* (Apenas Avanço)

Diferente de alguns outros ORMs (como Knex ou TypeORM que geram pares `up` e `down`), o Prisma Migrate adota o modelo **forward-only**:
- Ele **NÃO** gera migrations reversas automáticas.
- Uma vez que uma migration foi aplicada em um banco compartilhado/remoto (como o Supabase), **nunca edite nem apague o arquivo SQL dessa migration** do histórico do Git nem da pasta `prisma/migrations`.
- A forma oficial e segura de desfazer qualquer mudança de schema é criar uma **NOVA migration que reverte a alteração**.

---

## 2. Fluxo Correto: Revertendo uma Alteração via Nova Migration

### Cenário de Exemplo: Reverter a adição de um campo/coluna

Imagine que você adicionou a coluna `tempo_clima` no modelo `ReviewReport` e rodou `npx prisma migrate dev --name adiciona_tempo_clima`. Agora você decidiu remover essa coluna.

#### Passo a Passo:

1. **Faça um backup do banco antes:**
   ```powershell
   .\scripts\backup-db.ps1
   ```

2. **Edite o arquivo `prisma/schema.prisma`:**
   Remova a linha da coluna que deseja desfazer:
   ```prisma
   // Remova a linha indesejada:
   // tempo_clima String?
   ```

3. **Gere e aplique a nova migration reversa:**
   ```powershell
   npx prisma migrate dev --name remove_tempo_clima
   ```

4. **Resultado:**
   - O Prisma gera um novo arquivo SQL dentro de `prisma/migrations/` contendo `ALTER TABLE "review_reports" DROP COLUMN "tempo_clima";`.
   - O histórico de migrations fica íntegro e sincronizado tanto localmente quanto no Supabase.

---

## 3. Desfazendo ou Destravando uma Migration com Falha: `prisma migrate resolve`

Se durante a execução de uma migration no Supabase ocorreu um erro no meio do caminho, ou você precisou intervir manualmente no SQL do banco, a migration pode ficar no estado `failed` na tabela de controle `_prisma_migrations`.

O comando `npx prisma migrate resolve` é a ferramenta para informar ao Prisma o status correto da migration.

### Opção A: A migration falhou e você desfez as alterações manualmente no banco
```powershell
npx prisma migrate resolve --rolled-back 20260929120000_nome_da_migration
```
> **O que faz:** Marca o registro dessa migration como revertido (`rolled_back`) na tabela `_prisma_migrations`. O Prisma não tentará mais aplicá-la como se estivesse pendente nem reclamará de migration corrompida.

### Opção B: Você aplicou a correção do SQL diretamente no Supabase e quer marcar como concluída
```powershell
npx prisma migrate resolve --applied 20260929120000_nome_da_migration
```
> **O que faz:** Registra a migration como aplicada com sucesso (`applied`) sem reexecutar o script SQL.

---

## 4. Comparativo: Comandos Seguros vs Comandos Perigosos

| Comando | Segurança | O que faz | Quando usar |
|---|---|---|---|
| `npx prisma migrate dev` | 🟢 Seguro | Aplica migrations pendentes ou cria nova | Dia a dia de desenvolvimento |
| `npx prisma migrate resolve` | 🟢 Seguro | Alinha o status de uma migration com falha | Recuperação de migration interrompida |
| `npx prisma migrate deploy` | 🟢 Seguro | Aplica migrations em produção/CI sem prompt | Deploys automatizados |
| `npx prisma migrate reset` | 🔴 **DESTRUTIVO** | **APAGA TODO O SCHEMA, TODAS AS TABELAS E DADOS**, recria do zero e roda o seed | Apenas quando você quer zerar o banco do zero de propósito |

---

## 5. Resumo das Boas Práticas

1. **Nunca apague pastas em `prisma/migrations/`** se elas já foram executadas no Supabase.
2. **Sempre faça backup (`.\scripts\backup-db.ps1`)** antes de rodar qualquer migration que envolva alteração de tipos, remoção de colunas ou migração de dados.
3. Para voltar atrás em uma alteração de schema: ajuste o `prisma/schema.prisma` e crie uma nova migration com `npx prisma migrate dev --name reverte_<nome>`.
