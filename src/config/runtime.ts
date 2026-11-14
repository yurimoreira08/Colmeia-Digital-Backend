/**
 * Indica se o processo está rodando em produção.
 *
 * Considera produção `NODE_ENV=production` **ou** o Render (que define
 * `RENDER=true` em todo serviço). Não exigimos `NODE_ENV=production` no
 * Render porque, com ele, o `npm install` do build pula as devDependencies
 * (TypeScript), e o deploy quebraria.
 *
 * Lê `process.env` a cada chamada (e não o `env` validado na inicialização),
 * para refletir o ambiente real também em testes.
 */
export function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';
}
