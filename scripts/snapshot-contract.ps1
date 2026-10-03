param (
    [string]$BaseUrl = "http://localhost:4000"
)

$ErrorActionPreference = "Stop"

# 1. Validação de Segurança: Apenas Localhost
$uri = [System.Uri]$BaseUrl
if ($uri.Host -notin @("localhost", "127.0.0.1")) {
    Write-Error "SEGURANÇA: Snapshot só pode ser executado contra localhost ou 127.0.0.1. Host fornecido: $($uri.Host)"
    exit 1
}

$ApiPrefix = "$BaseUrl/api/v1"
$OutputDir = Join-Path $PSScriptRoot "..\snapshots\contract-v0"
if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "  INICIANDO SNAPSHOT DE CONTRATO DA API (v0)" -ForegroundColor Cyan
Write-Host "  Base URL: $BaseUrl (Prefix: $ApiPrefix)" -ForegroundColor Cyan
Write-Host "  Destino: $OutputDir" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan

$results = @{}
$shapes = @{}

function Get-TypeShape($obj) {
    if ($null -eq $obj) { return "null" }
    if ($obj -is [System.Array] -or $obj -is [System.Collections.IList]) {
        if ($obj.Count -eq 0) { return "array[]" }
        return "array[" + (Get-TypeShape $obj[0]) + "]"
    }
    if ($obj -is [PSCustomObject] -or $obj -is [System.Collections.IDictionary]) {
        $map = [ordered]@{}
        $props = if ($obj -is [PSCustomObject]) { $obj.PSObject.Properties } else { $obj.Keys }
        foreach ($p in $props) {
            $name = if ($p -is [System.Management.Automation.PSPropertyInfo]) { $p.Name } else { $p }
            $val = if ($p -is [System.Management.Automation.PSPropertyInfo]) { $p.Value } else { $obj[$name] }
            $map[$name] = Get-TypeShape $val
        }
        return $map
    }
    if ($obj -is [bool]) { return "boolean" }
    if ($obj -is [int] -or $obj -is [long] -or $obj -is [double] -or $obj -is [decimal]) { return "number" }
    if ($obj -is [string]) { return "string" }
    return $obj.GetType().Name
}

function Invoke-ApiEndpoint {
    param (
        [string]$Name,
        [string]$Method,
        [string]$Path,
        [hashtable]$Headers = @{},
        $Body = $null
    )

    $url = "$ApiPrefix$Path"
    $headersToSend = $Headers.Clone()
    if (-not $headersToSend.ContainsKey("Content-Type")) {
        $headersToSend["Content-Type"] = "application/json"
    }

    $entry = [ordered]@{
        name = $Name
        method = $Method
        path = $Path
        status = 0
        contentType = ""
        body = $null
    }

    try {
        $params = @{
            Uri = $url
            Method = $Method
            Headers = $headersToSend
            UseBasicParsing = $true
        }
        if ($null -ne $Body) {
            if ($Body -is [string]) {
                $params["Body"] = $Body
            } else {
                $params["Body"] = ($Body | ConvertTo-Json -Depth 10 -Compress)
            }
        }

        $res = Invoke-WebRequest @params
        $entry.status = [int]$res.StatusCode
        $entry.contentType = $res.Headers["Content-Type"]
        try {
            $entry.body = ($res.Content | ConvertFrom-Json)
        } catch {
            $entry.body = $res.Content
        }
    } catch {
        if ($_.Exception.Response) {
            $resp = $_.Exception.Response
            $entry.status = [int]$resp.StatusCode
            $entry.contentType = $resp.ContentType
            $stream = $resp.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($stream)
            $content = $reader.ReadToEnd()
            try {
                $entry.body = ($content | ConvertFrom-Json)
            } catch {
                $entry.body = $content
            }
        } else {
            $entry.status = 500
            $entry.body = @{ error = $_.Exception.Message }
        }
    }

    $results[$Name] = $entry
    $shapes[$Name] = [ordered]@{
        method = $Method
        path = $Path
        status = $entry.status
        bodyShape = (Get-TypeShape $entry.body)
    }

    $fileJson = Join-Path $OutputDir "$Name.json"
    $entry | ConvertTo-Json -Depth 10 | Set-Content -Path $fileJson -Encoding UTF8
    Write-Host "  [$($entry.status)] $Method $Path -> $Name.json" -ForegroundColor (if ($entry.status -lt 400) { "Green" } else { "Yellow" })

    return $entry
}

# --- 2. CONFIGURAÇÃO DE USUÁRIOS DE TESTE FICTÍCIOS ---
$User1Id = "901"
$User2Id = "902"
$H1 = @{ "x-user-id" = $User1Id }
$H2 = @{ "x-user-id" = $User2Id }

# --- 3. EXECUÇÃO DOS ENDPOINTS DE SUCESSO (HAPPY PATH) ---

# POST /apiaries (User 1)
$newApiary = Invoke-ApiEndpoint -Name "apiaries_post_create" -Method "POST" -Path "/apiaries" -Headers $H1 -Body @{
    name = "SNAPSHOT_Apiario_Alpha"
    location = "Setor Ficticio"
    boxCount = 3
    description = "Apiario de teste do snapshot de contrato"
}
$apiaryId = if ($newApiary.body.id) { $newApiary.body.id } else { 1 }

# GET /apiaries
Invoke-ApiEndpoint -Name "apiaries_get_list" -Method "GET" -Path "/apiaries" -Headers $H1 | Out-Null

# GET /apiaries/:id
Invoke-ApiEndpoint -Name "apiaries_get_by_id" -Method "GET" -Path "/apiaries/$apiaryId" -Headers $H1 | Out-Null

# GET /boxes?includeArchived=true
$boxesList = Invoke-ApiEndpoint -Name "boxes_get_list" -Method "GET" -Path "/boxes?includeArchived=true&apiaryId=$apiaryId" -Headers $H1
$boxId = if ($boxesList.body -is [array] -and $boxesList.body.Count -gt 0) { $boxesList.body[0].id } else { 1 }

# PUT /boxes/:id/rename
Invoke-ApiEndpoint -Name "boxes_put_rename" -Method "PUT" -Path "/boxes/$boxId/rename" -Headers $H1 -Body @{
    name = "SNAPSHOT_Caixa_Renomeada"
} | Out-Null

# POST /boxes/:id/archive & unarchive
Invoke-ApiEndpoint -Name "boxes_post_archive" -Method "POST" -Path "/boxes/$boxId/archive" -Headers $H1 | Out-Null
Invoke-ApiEndpoint -Name "boxes_post_unarchive" -Method "POST" -Path "/boxes/$boxId/unarchive" -Headers $H1 | Out-Null

# POST /revisions
$rev = Invoke-ApiEndpoint -Name "revisions_post_create" -Method "POST" -Path "/revisions" -Headers $H1 -Body @{
    caixaId = $boxId
    caixaName = "SNAPSHOT_Caixa_Renomeada"
    apiaryId = $apiaryId
    apiaryName = "SNAPSHOT_Apiario_Alpha"
    tipo = "com-enxame"
    checkedOptions = @("rainha", "postura_regular")
    observacoes = "Snapshot observacao"
    indicacoes = "Snapshot indicacao"
}
$revId = if ($rev.body.id) { $rev.body.id } else { 1 }

# GET /revisions?includeArchived=true
Invoke-ApiEndpoint -Name "revisions_get_list" -Method "GET" -Path "/revisions?includeArchived=true&apiaryId=$apiaryId" -Headers $H1 | Out-Null

# PUT /revisions/:id
Invoke-ApiEndpoint -Name "revisions_put_update" -Method "PUT" -Path "/revisions/$revId" -Headers $H1 -Body @{
    observacoes = "Snapshot observacao editada"
    indicacoes = "Snapshot indicacao editada"
    checkedOptions = @("rainha")
} | Out-Null

# POST /revisions/:id/archive & unarchive
Invoke-ApiEndpoint -Name "revisions_post_archive" -Method "POST" -Path "/revisions/$revId/archive" -Headers $H1 | Out-Null
Invoke-ApiEndpoint -Name "revisions_post_unarchive" -Method "POST" -Path "/revisions/$revId/unarchive" -Headers $H1 | Out-Null

# POST /manejos
$man = Invoke-ApiEndpoint -Name "manejos_post_create" -Method "POST" -Path "/manejos" -Headers $H1 -Body @{
    caixaId = $boxId
    caixaName = "SNAPSHOT_Caixa_Renomeada"
    apiaryId = $apiaryId
    apiaryName = "SNAPSHOT_Apiario_Alpha"
    tipo = "apiario"
    checkedOptions = @(@{ id = "alimentacao"; label = "Alimentação" })
    observacoes = "Snapshot manejo obs"
    indicacoes = "Snapshot manejo ind"
}
$manId = if ($man.body.id) { $man.body.id } else { 1 }

# GET /manejos?includeArchived=true
Invoke-ApiEndpoint -Name "manejos_get_list" -Method "GET" -Path "/manejos?includeArchived=true&apiaryId=$apiaryId" -Headers $H1 | Out-Null

# PUT /manejos/:id
Invoke-ApiEndpoint -Name "manejos_put_update" -Method "PUT" -Path "/manejos/$manId" -Headers $H1 -Body @{
    checkedOptions = @(@{ id = "divisao"; label = "Divisão" })
    observacoes = "Snapshot manejo editado"
    indicacoes = ""
} | Out-Null

# POST /manejos/:id/archive & unarchive
Invoke-ApiEndpoint -Name "manejos_post_archive" -Method "POST" -Path "/manejos/$manId/archive" -Headers $H1 | Out-Null
Invoke-ApiEndpoint -Name "manejos_post_unarchive" -Method "POST" -Path "/manejos/$manId/unarchive" -Headers $H1 | Out-Null

# POST /notifications
Invoke-ApiEndpoint -Name "notifications_post_create" -Method "POST" -Path "/notifications" -Headers $H1 -Body @{
    title = "SNAPSHOT Notificação"
    subtitle = "Subtítulo do teste"
} | Out-Null

# GET /notifications
Invoke-ApiEndpoint -Name "notifications_get_list" -Method "GET" -Path "/notifications" -Headers $H1 | Out-Null

# POST /reports/stats
Invoke-ApiEndpoint -Name "reports_post_stats" -Method "POST" -Path "/reports/stats" -Headers $H1 -Body @{
    revisoes = @(
        @{
            id = 1
            caixaId = $boxId
            caixaName = "SNAPSHOT_Caixa"
            apiaryId = $apiaryId
            apiaryName = "SNAPSHOT_Apiario"
            tipo = "com-enxame"
            checkedOptions = @("rainha")
            observacoes = "Teste stats"
            indicacoes = ""
            createdAt = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
        }
    )
    manejos = @(
        @{
            id = 1
            caixaId = $boxId
            caixaName = "SNAPSHOT_Caixa"
            apiaryId = $apiaryId
            apiaryName = "SNAPSHOT_Apiario"
            tipo = "apiario"
            checkedOptions = @(@{ id = "alimentacao"; label = "Alimentação" })
            observacoes = "Manejo stats"
            indicacoes = ""
            createdAt = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
        }
    )
} | Out-Null

# --- 4. EXECUÇÃO DE RESPOSTAS DE ERRO ---

# 400 Bad Request (dados inválidos)
Invoke-ApiEndpoint -Name "error_400_invalid_body" -Method "POST" -Path "/apiaries" -Headers $H1 -Body @{
    name = ""
    boxCount = -5
} | Out-Null

# 401 Unauthorized (sem header de identificação)
Invoke-ApiEndpoint -Name "error_401_no_auth" -Method "GET" -Path "/apiaries" -Headers @{} | Out-Null

# 403 Forbidden (User 2 tentando acessar/deletar recurso do User 1)
Invoke-ApiEndpoint -Name "error_403_other_user_resource" -Method "DELETE" -Path "/apiaries/$apiaryId" -Headers $H2 | Out-Null

# 404 Not Found (ID inexistente)
Invoke-ApiEndpoint -Name "error_404_not_found" -Method "GET" -Path "/apiaries/9999999" -Headers $H1 | Out-Null

# --- 5. CLEANUP / DELETES DOS DADOS CRIADOS NO HAPPY PATH ---
Invoke-ApiEndpoint -Name "manejos_delete" -Method "DELETE" -Path "/manejos/$manId" -Headers $H1 | Out-Null
Invoke-ApiEndpoint -Name "revisions_delete" -Method "DELETE" -Path "/revisions/$revId" -Headers $H1 | Out-Null
Invoke-ApiEndpoint -Name "boxes_delete" -Method "DELETE" -Path "/boxes/$boxId" -Headers $H1 | Out-Null
Invoke-ApiEndpoint -Name "apiaries_delete" -Method "DELETE" -Path "/apiaries/$apiaryId" -Headers $H1 | Out-Null

# --- 6. SALVAR ARQUIVO DE SHAPE GLOBAL ---
$shapeFile = Join-Path $OutputDir "schema_shape.json"
$shapes | ConvertTo-Json -Depth 10 | Set-Content -Path $shapeFile -Encoding UTF8
Write-Host "`nShape das respostas salvo em: $shapeFile" -ForegroundColor Cyan
Write-Host "Snapshot do contrato finalizado com sucesso ($($results.Count) endpoints testados)!" -ForegroundColor Green
