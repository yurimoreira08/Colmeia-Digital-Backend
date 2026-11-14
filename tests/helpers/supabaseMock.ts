import { vi } from 'vitest';

/**
 * Substituto do cliente Supabase usado pelo `storageService`.
 * Registra cada upload para os testes conferirem caminho, tipo e opções,
 * sem enviar nada ao bucket real.
 *
 * Uso: vi.mock('@supabase/supabase-js', () => import('../helpers/supabaseMock.js'));
 */

export interface RecordedUpload {
  bucket: string;
  path: string;
  body: unknown;
  options: { contentType?: string; upsert?: boolean };
}

export const uploads: RecordedUpload[] = [];

/** Arquivos que existem no bucket simulado (caminho completo). */
export const storedFiles = new Set<string>();

export const uploadMock = vi.fn(async () => ({ data: {}, error: null as null | { message: string } }));

export function createClient() {
  return {
    storage: {
      from(bucket: string) {
        return {
          async upload(path: string, body: unknown, options: RecordedUpload['options']) {
            uploads.push({ bucket, path, body, options });
            storedFiles.add(path);
            return uploadMock();
          },
          /** Filhos diretos de `prefix`, como o Supabase (pastas vêm sem id). */
          async list(prefix: string) {
            const files = [...storedFiles].filter((p) => p.startsWith(`${prefix}/`) && !p.slice(prefix.length + 1).includes('/'));
            return { data: files.map((p) => ({ id: p, name: p.slice(prefix.length + 1) })), error: null };
          },
          async remove(paths: string[]) {
            paths.forEach((p) => storedFiles.delete(p));
            return { data: paths.map((name) => ({ name })), error: null };
          },
          async createSignedUrls(paths: string[], expiresIn: number) {
            return {
              data: paths.map((path) => ({ path, signedUrl: `https://test-project.supabase.co/storage/v1/object/sign/${bucket}/${path}?token=t&ttl=${expiresIn}`, error: null })),
              error: null,
            };
          },
          getPublicUrl(path: string) {
            return { data: { publicUrl: `https://test-project.supabase.co/storage/v1/object/public/${bucket}/${path}` } };
          },
        };
      },
    },
  };
}

export function resetSupabaseMock(): void {
  uploads.length = 0;
  storedFiles.clear();
  uploadMock.mockReset();
  uploadMock.mockResolvedValue({ data: {}, error: null });
}

/** Bytes mínimos que passam pela detecção de cada formato. */
export const IMAGE_SIGNATURES = {
  jpeg: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]),
  png: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]),
  webp: Buffer.concat([Buffer.from('RIFF'), Buffer.from([0, 0, 0, 0]), Buffer.from('WEBPVP8 ')]),
};
