# Colmeia Digital — Backend API

API REST do **Colmeia Digital** (projeto FAPEPI) para gestão de apiários, caixas (colmeias), revisões e manejos de campo.
O cliente é o app mobile offline-first [Colmeia-Digital-Frontend](https://github.com/yurimoreira08/Colmeia-Digital-Frontend).

## Tecnologias

- **Runtime:** Node.js (ES Modules) + Express 4 + TypeScript
- **Banco de dados:** PostgreSQL no Supabase, acessado pelo Prisma
- **Arquivos:** Supabase Storage (fotos de manejo e de perfil)
- **E-mail:** Resend ou SMTP (recuperação de senha)
- **Testes:** Vitest + Supertest · **Lint:** ESLint (typescript-eslint)
- **Deploy:** Render

## Módulos

1. **Autenticação:** cadastro, login por token, recuperação de senha por código enviado por e-mail.
2. **Apiários:** cadastro e edição das unidades apícolas de cada apicultor.
3. **Caixas (colmeias):** caixas de cada apiário, com arquivamento.
4. **Revisões:** parâmetros biológicos da colmeia (rainha, postura, crias, mel, pólen, sanidade).
5. **Manejos:** intervenções de campo (alimentação, divisão, cera, melgueiras, defesa), com foto.
6. **Relatórios:** estatísticas consolidadas por período.

## Como executar

```bash
npm install
cp .env.example .env     # preencha as variáveis (o banco configurado hoje é o de produção!)
npm run dev              # http://localhost:4000/api/v1/health
```

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor em modo watch (porta 4000) |
| `npm run build` / `npm start` | Compila para `dist/` e inicia |
| `npm run typecheck` | Verifica os tipos |
| `npm test` | Testes (não acessam banco nem storage reais) |
| `npm run lint` | ESLint |

## Segurança

- Senhas com bcrypt (custo 12) e sessões por token aleatório, guardado só como hash.
- Rate limit nas rotas de autenticação, headers de segurança (helmet) e CORS por lista.
- Erros internos nunca são expostos ao cliente.

Veja `.env.example` para todas as variáveis de ambiente.
