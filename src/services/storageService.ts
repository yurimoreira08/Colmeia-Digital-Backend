import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { env } from '../config/env.js';

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

export interface UploadImageParams {
  userId: number;
  folder: 'manejos' | 'profiles' | 'geral';
  base64Data: string;
  mimeType?: string;
  fileName?: string;
}

export interface UploadResult {
  url: string;
  path: string;
}

/**
 * Envia uma imagem codificada em base64 para o Supabase Storage
 */
export async function uploadImageToStorage(params: UploadImageParams): Promise<UploadResult> {
  const { userId, folder, base64Data, mimeType, fileName } = params;

  if (!base64Data) {
    throw new Error('Nenhum dado de imagem fornecido para upload.');
  }

  const client = getSupabaseClient();
  const bucketName = (env.SUPABASE_BUCKET_NAME || process.env.SUPABASE_BUCKET_NAME || 'colmeia-digital').trim();

  // Detectar MIME type e limpar prefixo base64 se presente
  let cleanBase64 = base64Data;
  let detectedMime = mimeType || 'image/jpeg';

  const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  if (matches && matches.length === 3) {
    detectedMime = matches[1];
    cleanBase64 = matches[2];
  }

  const extension = detectedMime.split('/')[1] || 'jpg';
  const fileBuffer = Buffer.from(cleanBase64, 'base64');
  const fileData = new Uint8Array(fileBuffer);

  // Gerar nome de arquivo seguro e único
  const uniqueId = randomUUID().replace(/-/g, '').slice(0, 12);
  const timestamp = Date.now();
  const safeFileName = fileName
    ? `${timestamp}_${uniqueId}_${fileName.replace(/[^a-zA-Z0-9._-]/g, '')}`
    : `${timestamp}_${uniqueId}.${extension}`;

  const filePath = `${folder}/${userId}/${safeFileName}`;

  console.log(`[StorageService] Enviando para bucket "${bucketName}" caminho "${filePath}" (${fileData.length} bytes)...`);

  const { error: uploadError } = await client.storage
    .from(bucketName)
    .upload(filePath, fileData, {
      contentType: detectedMime,
      upsert: true,
    });

  if (uploadError) {
    console.error('[StorageService] Erro detalhado no upload para Supabase:', uploadError);
    throw new Error(`Falha no upload para o Supabase Storage: ${uploadError.message || JSON.stringify(uploadError)}`);
  }

  const { data } = client.storage.from(bucketName).getPublicUrl(filePath);

  console.log(`[StorageService] Upload concluído com sucesso. URL: ${data.publicUrl}`);

  return {
    url: data.publicUrl,
    path: filePath,
  };
}
