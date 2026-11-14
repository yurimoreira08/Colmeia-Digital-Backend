import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { env } from '../config/env.js';
import { AppError } from '../errors/AppError.js';
import { logger } from '../lib/logger.js';

let cachedClient: SupabaseClient | null = null;
let lastUsedUrl = '';
let lastUsedKey = '';

function getSupabaseClient(): SupabaseClient {
  let supabaseUrl = (env.SUPABASE_URL || process.env.SUPABASE_URL || '').trim().replace(/^["']|["']$/g, '');
  const supabaseKey = (
    env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    ''
  ).trim().replace(/^["']|["']$/g, '');

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'Configuração do Supabase ausente. Verifique se SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY estão definidos no arquivo .env.'
    );
  }

  // Sanitização de formato de URL
  if (supabaseUrl.startsWith('db.') && supabaseUrl.includes('.supabase.co')) {
    const projectRef = supabaseUrl.split('.')[1];
    supabaseUrl = `https://${projectRef}.supabase.co`;
  } else if (!supabaseUrl.startsWith('http://') && !supabaseUrl.startsWith('https://')) {
    supabaseUrl = `https://${supabaseUrl}`;
  }

  // Remove barras no final
  supabaseUrl = supabaseUrl.replace(/\/+$/, '');

  if (cachedClient && lastUsedUrl === supabaseUrl && lastUsedKey === supabaseKey) {
    return cachedClient;
  }

  lastUsedUrl = supabaseUrl;
  lastUsedKey = supabaseKey;

  cachedClient = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return cachedClient;
}

/** Nome do bucket das imagens. Lido a cada chamada, como as credenciais em getSupabaseClient. */
function bucketName(): string {
  return (process.env.SUPABASE_BUCKET_NAME || env.SUPABASE_BUCKET_NAME || 'colmeia-digital').trim();
}

/** Pastas permitidas no bucket. A pasta vem do cliente, então é sempre normalizada para uma destas. */
export type StorageFolder = 'manejos' | 'profiles' | 'geral';

/** Tamanho máximo de imagem aceito, igual ao limite do multer em `api.routes.ts`. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Tipos de imagem aceitos e a extensão usada no nome do arquivo salvo. */
const ALLOWED_IMAGE_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
} as const;

type AllowedImageMime = keyof typeof ALLOWED_IMAGE_TYPES;

/**
 * Erro de imagem enviada pelo cliente (tipo ou tamanho inválido).
 * Responde 400 com a mensagem (é um AppError). Qualquer outro erro vira 500
 * com mensagem genérica, para não expor detalhes do Supabase.
 */
export class InvalidImageError extends AppError {}

export interface UploadImageParams {
  userId: number;
  folder: StorageFolder;
  /** Imagem em base64, com ou sem o prefixo `data:<mime>;base64,`. */
  base64Data: string;
}

export interface UploadBufferParams {
  userId: number;
  folder: StorageFolder;
  buffer: Buffer;
}

export interface UploadResult {
  url: string;
  path: string;
}

/**
 * Descobre o tipo real da imagem pelos primeiros bytes (magic bytes).
 * O MIME e a extensão informados pelo cliente não são confiáveis: sem esta
 * checagem seria possível publicar HTML/SVG com script no bucket público.
 */
function detectImageMime(buffer: Buffer): AllowedImageMime | null {
  const isJpeg = buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (isJpeg) return 'image/jpeg';

  const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const isPng = buffer.length >= 8 && buffer.subarray(0, 8).equals(pngSignature);
  if (isPng) return 'image/png';

  const isWebp =
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP';
  if (isWebp) return 'image/webp';

  return null;
}

/**
 * Envia uma imagem codificada em base64 para o Supabase Storage.
 * Usado pela foto de perfil (`POST /upload`). Decodifica e reaproveita
 * `uploadBufferToStorage`, que faz toda a validação.
 */
export async function uploadImageToStorage(params: UploadImageParams): Promise<UploadResult> {
  const { userId, folder, base64Data } = params;

  if (!base64Data) {
    throw new InvalidImageError('Nenhum dado de imagem fornecido para upload.');
  }

  // Descarta o prefixo "data:<mime>;base64," se houver; o tipo é detectado pelos bytes.
  const commaIndex = base64Data.indexOf(',');
  const cleanBase64 = base64Data.startsWith('data:') && commaIndex >= 0
    ? base64Data.slice(commaIndex + 1)
    : base64Data;

  const buffer = Buffer.from(cleanBase64, 'base64');
  return uploadBufferToStorage({ userId, folder, buffer });
}

/**
 * Valida e envia uma imagem para o Supabase Storage (bucket público).
 *
 * Regras: só JPEG, PNG ou WEBP (verificado pelo conteúdo), até 5 MB, e o
 * caminho é sempre `<pasta>/<userId>/<timestamp>_<id>.<ext>`, gerado no
 * servidor. O nome enviado pelo cliente é ignorado e nunca há sobrescrita.
 *
 * @throws InvalidImageError se a imagem for vazia, grande demais ou de tipo não permitido.
 */
export async function uploadBufferToStorage(params: UploadBufferParams): Promise<UploadResult> {
  const { userId, folder, buffer } = params;

  if (!buffer || buffer.length === 0) {
    throw new InvalidImageError('Nenhuma imagem enviada.');
  }
  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new InvalidImageError('A imagem deve ter no máximo 5MB.');
  }

  const mimeType = detectImageMime(buffer);
  if (!mimeType) {
    throw new InvalidImageError('Tipo de arquivo inválido. Permitido apenas JPEG, PNG e WEBP.');
  }

  const client = getSupabaseClient();

  const uniqueId = randomUUID().replace(/-/g, '').slice(0, 12);
  const filePath = `${folder}/${userId}/${Date.now()}_${uniqueId}.${ALLOWED_IMAGE_TYPES[mimeType]}`;

  const { error: uploadError } = await client.storage
    .from(bucketName())
    .upload(filePath, buffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (uploadError) {
    logger.error({ storageError: uploadError.message }, 'Falha no upload para o Supabase Storage');
    throw new Error('Falha no upload para o Supabase Storage.');
  }

  const { data } = client.storage.from(bucketName()).getPublicUrl(filePath);

  // Bucket privado: o app recebe uma URL assinada para mostrar a foto já; ao salvar
  // o registro, ela volta para a forma sem prazo (toStoredPhotoUrl).
  return {
    url: (await signPhotoUrl(data.publicUrl)) ?? data.publicUrl,
    path: filePath,
  };
}

/**
 * Apaga todas as imagens do usuário no bucket (`manejos/<id>/`,
 * `profiles/<id>/` e `geral/<id>/`). Usado na exclusão da conta (LGPD).
 *
 * @returns quantos arquivos foram apagados.
 */
export async function deleteUserFiles(userId: number): Promise<number> {
  const client = getSupabaseClient();
  const bucket = client.storage.from(bucketName());
  let removed = 0;

  for (const folder of ['manejos', 'profiles', 'geral'] satisfies StorageFolder[]) {
    const prefix = `${folder}/${userId}`;
    // Lista em páginas: o Supabase devolve no máximo 1000 por chamada (até 50 páginas, por segurança).
    for (let page = 0; page < 50; page++) {
      const { data, error } = await bucket.list(prefix, { limit: 1000 });
      if (error) throw new Error(`Falha ao listar ${prefix}: ${error.message}`);
      const paths = (data ?? []).filter((file) => file.id).map((file) => `${prefix}/${file.name}`);
      if (paths.length === 0) break;
      const { error: removeError } = await bucket.remove(paths);
      if (removeError) throw new Error(`Falha ao apagar arquivos de ${prefix}: ${removeError.message}`);
      removed += paths.length;
    }
  }
  return removed;
}

/** Fotos em bucket privado? Lido a cada chamada, para poder virar sem reiniciar nos testes. */
function isStoragePrivate(): boolean {
  return (process.env.STORAGE_PRIVATE ?? String(env.STORAGE_PRIVATE)) === 'true';
}

/**
 * Caminho da imagem dentro do nosso bucket, a partir de uma URL pública ou
 * assinada do Supabase. `null` para qualquer outra URL (ou texto).
 */
export function storagePathFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = url.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/([^?#]+)/);
  if (!match || match[1] !== bucketName()) return null;
  return decodeURIComponent(match[2]);
}

/**
 * Forma guardada no banco: a URL pública "canônica" do arquivo, sem token.
 * O app pode devolver uma URL assinada (que vence); salvar a canônica evita
 * guardar um link que expira. URLs de fora do bucket passam como vieram.
 */
export function toStoredPhotoUrl<T extends string | null | undefined>(url: T): T | string {
  const path = storagePathFromUrl(url);
  if (!path) return url;
  return getSupabaseClient().storage.from(bucketName()).getPublicUrl(path).data.publicUrl;
}

/**
 * Troca as URLs do bucket por URLs assinadas (com prazo) quando o bucket é
 * privado. Com o bucket público, devolve as URLs como estão. Uma chamada ao
 * Supabase para todas as fotos.
 *
 * @returns mapa URL guardada → URL para o cliente.
 */
export async function signPhotoUrls(urls: Array<string | null | undefined>): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (!isStoragePrivate()) return result;

  const byPath = new Map<string, string>();
  for (const url of urls) {
    const path = storagePathFromUrl(url);
    if (path && url) byPath.set(path, url);
  }
  if (byPath.size === 0) return result;

  const ttl = Number(process.env.SIGNED_URL_TTL_SECONDS) || env.SIGNED_URL_TTL_SECONDS;
  const { data, error } = await getSupabaseClient().storage.from(bucketName()).createSignedUrls([...byPath.keys()], ttl);
  if (error) throw new Error(`Falha ao assinar as URLs das fotos: ${error.message}`);
  for (const item of data ?? []) {
    const original = item.path ? byPath.get(item.path) : undefined;
    if (original && item.signedUrl) result.set(original, item.signedUrl);
  }
  return result;
}

/** Aplica `signPhotoUrls` no campo de foto de uma lista de registros. */
export async function withSignedPhotos<T>(items: T[], field: keyof T): Promise<T[]> {
  const signed = await signPhotoUrls(items.map((item) => item[field] as unknown as string | undefined));
  if (signed.size === 0) return items;
  return items.map((item) => {
    const url = item[field] as unknown as string | undefined;
    return url && signed.has(url) ? { ...item, [field]: signed.get(url) } : item;
  });
}

/** URL para o cliente de uma imagem só (ex.: upload recém-feito, foto de perfil). */
export async function signPhotoUrl(url: string | null | undefined): Promise<string | null | undefined> {
  if (!url) return url;
  return (await signPhotoUrls([url])).get(url) ?? url;
}
