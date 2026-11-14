import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/data/prisma.js', () => import('../helpers/prismaMock.js'));
vi.mock('@supabase/supabase-js', () => import('../helpers/supabaseMock.js'));

import { createApp } from '../../src/app.js';
import { resetPrismaMock } from '../helpers/prismaMock.js';
import { authHeader, mockSessionsFor } from '../helpers/fixtures.js';
import { IMAGE_SIGNATURES, resetSupabaseMock, uploadMock, uploads } from '../helpers/supabaseMock.js';

const USER_ID = 1;
const MALICIOUS_HTML = Buffer.from('<html><body><script>alert(document.cookie)</script></body></html>');

function asDataUrl(mime: string, bytes: Buffer): string {
  return `data:${mime};base64,${bytes.toString('base64')}`;
}

beforeEach(() => {
  resetPrismaMock();
  resetSupabaseMock();
  mockSessionsFor(USER_ID);
});

describe('POST /api/v1/upload (base64, foto de perfil)', () => {
  it('recusa HTML disfarçado de imagem e não envia nada ao bucket', async () => {
    const response = await request(createApp())
      .post('/api/v1/upload')
      .set('Authorization', authHeader(USER_ID))
      .send({ base64Data: asDataUrl('text/html', MALICIOUS_HTML), folder: 'profiles', mimeType: 'image/png' });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/JPEG, PNG e WEBP/);
    expect(uploads).toHaveLength(0);
  });

  it('recusa imagens acima de 5 MB', async () => {
    const oversized = Buffer.concat([IMAGE_SIGNATURES.jpeg, Buffer.alloc(5 * 1024 * 1024)]);

    const response = await request(createApp())
      .post('/api/v1/upload')
      .set('Authorization', authHeader(USER_ID))
      .send({ base64Data: asDataUrl('image/jpeg', oversized), folder: 'profiles' });

    expect(response.status).toBe(400);
    expect(uploads).toHaveLength(0);
  });

  it('salva JPEG válido com caminho e tipo gerados no servidor, sem sobrescrever', async () => {
    const response = await request(createApp())
      .post('/api/v1/upload')
      .set('Authorization', authHeader(USER_ID))
      .send({
        base64Data: asDataUrl('image/jpeg', IMAGE_SIGNATURES.jpeg),
        folder: 'profiles',
        mimeType: 'text/html',
        fileName: '../../index.html',
      });

    expect(response.status).toBe(200);
    expect(uploads).toHaveLength(1);
    expect(uploads[0].path).toMatch(/^profiles\/1\/\d+_[a-f0-9]{12}\.jpg$/);
    expect(uploads[0].options).toEqual({ contentType: 'image/jpeg', upsert: false });
    expect(response.body).toMatchObject({ success: true, path: uploads[0].path });
  });

  it('não expõe a mensagem interna quando o Supabase falha', async () => {
    uploadMock.mockResolvedValue({ data: {}, error: { message: 'bucket colmeia-test: service role key inválida' } });

    const response = await request(createApp())
      .post('/api/v1/upload')
      .set('Authorization', authHeader(USER_ID))
      .send({ base64Data: asDataUrl('image/png', IMAGE_SIGNATURES.png), folder: 'profiles' });

    expect(response.status).toBe(500);
    expect(JSON.stringify(response.body)).not.toMatch(/service role|bucket/i);
  });

  it('exige autenticação', async () => {
    const response = await request(createApp())
      .post('/api/v1/upload')
      .send({ base64Data: asDataUrl('image/jpeg', IMAGE_SIGNATURES.jpeg), folder: 'profiles' });

    expect(response.status).toBe(401);
    expect(uploads).toHaveLength(0);
  });
});

describe('POST /api/v1/upload/manejo-photo (multipart)', () => {
  it('recusa HTML enviado com MIME e extensão de imagem', async () => {
    const response = await request(createApp())
      .post('/api/v1/upload/manejo-photo')
      .set('Authorization', authHeader(USER_ID))
      .attach('photo', MALICIOUS_HTML, { filename: 'foto.jpg', contentType: 'image/jpeg' });

    expect(response.status).toBe(400);
    expect(uploads).toHaveLength(0);
  });

  it('salva WEBP válido na pasta de manejos do usuário', async () => {
    const response = await request(createApp())
      .post('/api/v1/upload/manejo-photo')
      .set('Authorization', authHeader(USER_ID))
      .attach('photo', IMAGE_SIGNATURES.webp, { filename: 'colmeia.webp', contentType: 'image/webp' });

    expect(response.status).toBe(200);
    expect(uploads).toHaveLength(1);
    expect(uploads[0].path).toMatch(/^manejos\/1\/\d+_[a-f0-9]{12}\.webp$/);
    expect(uploads[0].options).toEqual({ contentType: 'image/webp', upsert: false });
  });
});
