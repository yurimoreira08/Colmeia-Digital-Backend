# Contrato da API — Upload e Gestão de Fotos de Manejo

Este documento descreve as especificações do contrato de API para o upload e persistência de fotos de manejos técnicos no **Colmeia Digital**, integrados ao Supabase Storage.

---

## 1. Visão Geral da Mudança

- **Problema anterior:** O campo `photo_uri` armazenava o caminho do sistema de arquivos local do dispositivo (`file:///data/user/0/...` ou `file:///var/mobile/...`). Esse caminho não existia no servidor e não abria em outros dispositivos ou na sincronização em nuvem.
- **Novo Contrato:** O campo `photo_uri` armazena exclusivamente URLs públicas e persistentes hospedadas no Supabase Storage (ex: `https://<supabase-host>/storage/v1/object/public/colmeia-digital/manejos/<user_id>/...`). Caminhos locais (`file://`) são temporários no cliente e devem ser convertidos em URL do Supabase antes ou durante a sincronização em nuvem.

---

## 2. Endpoints

### 2.1 Upload de Foto de Manejo

Envia o arquivo binário da foto para armazenamento no Supabase Storage. O backend autentica a requisição, valida tipo e tamanho, organiza o arquivo no bucket por apicultor e retorna a URL pública permanente.

- **Método:** `POST`
- **Rota:** `/upload/manejo-photo`
- **Autenticação:** Obrigatória (`Authorization: Bearer <jwt_token>`)
- **Content-Type:** `multipart/form-data`

#### Parâmetros do Formulário (Form-Data)
| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `photo` | File (Binário) | Sim | Arquivo da foto. Tipos permitidos: `image/jpeg`, `image/png`, `image/webp`. Tamanho máximo: **5 MB**. |

#### Resposta de Sucesso (`200 OK`)
```json
{
  "success": true,
  "url": "https://wevqiawomhqasecbwefe.supabase.co/storage/v1/object/public/colmeia-digital/manejos/1/1740000000000_3fa85f64-5717-4562-b3fc-2c963f66afa6.jpg",
  "path": "manejos/1/1740000000000_3fa85f64-5717-4562-b3fc-2c963f66afa6.jpg"
}
```

#### Respostas de Erro
- `400 Bad Request`: `{"message": "Nenhuma foto enviada no campo multipart \"photo\"."}` ou `{"message": "Apenas imagens (JPEG, PNG, WebP) são permitidas."}` ou tamanho excedente.
- `401 Unauthorized`: `{"message": "Autenticação necessária para upload de fotos."}`
- `500 Internal Server Error`: `{"message": "Erro ao processar upload da foto de manejo."}`

---

### 2.2 Criação e Atualização de Manejos (`POST /manejos`, `PUT /manejos/:id`)

- **Autenticação:** Obrigatória (`Authorization: Bearer <jwt_token>`)
- **Payload (`photoUri`):**
  - **Tipo:** `string | null | undefined`
  - **Formato esperado:** URL pública HTTP/HTTPS (Supabase Storage).
  - **Exemplo:**
  ```json
  {
    "caixaId": 4,
    "caixaName": "Caixa 01",
    "apiaryId": 1,
    "apiaryName": "Apiário Principal",
    "tipo": "apiario",
    "revisaoId": 12,
    "checkedOptions": ["alimentacao", "troca-cera"],
    "observacoes": "Colocado xarope 1:1 e quadro novo de cera alveolada.",
    "indicacoes": "Verificar puxada em 7 dias.",
    "photoUri": "https://wevqiawomhqasecbwefe.supabase.co/storage/v1/object/public/colmeia-digital/manejos/1/1740000000000_3fa85f64-5717-4562-b3fc-2c963f66afa6.jpg"
  }
  ```

---

## 3. Diretrizes de Otimização e Compressão (Mobile)

Antes de realizar o upload para `/upload/manejo-photo`:
1. **Redimensionamento:** Largura máxima de **1200px** preservando aspect ratio.
2. **Compressão:** Formato JPEG com qualidade **0.7** (70%).
3. **Resiliência:** Se a compressão falhar localmente, o cliente envia a foto capturada sem travar a operação.

---

## 4. Política de Operação Offline-First

1. **Criação sem Conectividade:**
   - O registro do manejo é persistido no banco SQLite local com `synced = 0`.
   - O caminho local (`file://...`) é mantido no campo `photo_uri` local temporariamente.
2. **Ciclo de Sincronização (`syncService`):**
   - Antes de disparar `POST /manejos` ou `PUT /manejos/:id`, o sync identifica registros pendentes com `photo_uri` local.
   - Executa a compressão e envia para `POST /upload/manejo-photo`.
   - Atualiza o SQLite local com a nova URL do Supabase Storage.
   - Envia o payload do manejo com a URL em nuvem já resolvida.
   - Em caso de falha de conexão no upload da foto, o sync adia o envio daquele manejo para preservar a integridade da foto.
