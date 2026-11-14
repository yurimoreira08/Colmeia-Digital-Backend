import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { env } from '../config/env.js';
import { AppError } from '../errors/AppError.js';

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
  const bucketName = (env.SUPABASE_BUCKET_NAME || 'colmeia-digital').trim();

  const uniqueId = randomUUID().replace(/-/g, '').slice(0, 12);
  const filePath = `${folder}/${userId}/${Date.now()}_${uniqueId}.${ALLOWED_IMAGE_TYPES[mimeType]}`;

  const { error: uploadError } = await client.storage
    .from(bucketName)
    .upload(filePath, buffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (uploadError) {
    console.error('[StorageService] Erro no upload para o Supabase:', uploadError.message);
    throw new Error('Falha no upload para o Supabase Storage.');
  }

  const { data } = client.storage.from(bucketName).getPublicUrl(filePath);

  return {
    url: data.publicUrl,
    path: filePath,
  };
}
