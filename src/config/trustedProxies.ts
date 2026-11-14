/**
 * Proxies confiáveis para descobrir o IP real do cliente (`trust proxy`).
 *
 * Caminho em produção, conferido com GET /api/v1/health/client-ip:
 *   cliente → Cloudflare (borda) → proxies internos do Render (10.x) → API
 *
 * O Express lê o X-Forwarded-For da direita para a esquerda e para no
 * primeiro endereço que não está nesta lista: esse é o IP do cliente. O que
 * o cliente escreve no header fica à esquerda do IP real e é ignorado.
 *
 * Limitação: requisições vindas de dentro do Cloudflare (ex.: um Worker de
 * terceiros) poderiam escolher o IP. Para o rate limit isso é aceitável.
 */

/** Rede privada e loopback (proxies internos do Render). */
const PRIVATE_NETWORKS = ['loopback', 'linklocal', 'uniquelocal'];

/**
 * Faixas publicadas pelo Cloudflare. Fonte: https://www.cloudflare.com/ips-v4
 * e https://www.cloudflare.com/ips-v6 (conferidas em 14/11/2026). Mudam
 * raramente; se o client-ip passar a mostrar um IP 172.64–172.71, 104.16–
 * 104.27 ou 162.158–162.159, atualize esta lista.
 */
const CLOUDFLARE_RANGES = [
  '173.245.48.0/20',
  '103.21.244.0/22',
  '103.22.200.0/22',
  '103.31.4.0/22',
  '141.101.64.0/18',
  '108.162.192.0/18',
  '190.93.240.0/20',
  '188.114.96.0/20',
  '197.234.240.0/22',
  '198.41.128.0/17',
  '162.158.0.0/15',
  '104.16.0.0/13',
  '104.24.0.0/14',
  '172.64.0.0/13',
  '131.0.72.0/22',
  '2400:cb00::/32',
  '2606:4700::/32',
  '2803:f800::/32',
  '2405:b500::/32',
  '2405:8100::/32',
  '2a06:98c0::/29',
  '2c0f:f248::/32',
];

/** Valor padrão de `trust proxy` quando TRUST_PROXY não está definido. */
export const DEFAULT_TRUSTED_PROXIES: string[] = [...PRIVATE_NETWORKS, ...CLOUDFLARE_RANGES];

/**
 * Converte o texto da variável TRUST_PROXY no valor de `trust proxy`.
 * - vazio: DEFAULT_TRUSTED_PROXIES (rede privada + Cloudflare)
 * - número ("1"): quantidade de saltos
 * - "true" / "false"
 * - lista separada por vírgula: IPs, CIDRs ou nomes (loopback, uniquelocal...)
 */
export function parseTrustProxy(value: string): boolean | number | string[] {
  const trimmed = value.trim();
  if (trimmed === '') return DEFAULT_TRUSTED_PROXIES;
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  return trimmed.split(',').map((entry) => entry.trim()).filter(Boolean);
}
