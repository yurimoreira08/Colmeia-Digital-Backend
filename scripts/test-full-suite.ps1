param (
    [string]$BaseUrl = 'http://localhost:4000'
)

$ErrorActionPreference = 'Stop'

# Validacao de seguranca: apenas localhost
$uri = [System.Uri]$BaseUrl
if ($uri.Host -notin @('localhost', '127.0.0.1')) {
    Write-Error "SEGURANCA: Testes so podem ser executados contra localhost. Host: $($uri.Host)"
    exit 1
}

$ApiPrefix = "$BaseUrl/api/v1"
$timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()

Write-Host '==========================================================' -ForegroundColor Cyan
Write-Host '  SUITE DE TESTES E VALIDACAO AUTOMATIZADA - COLMEIA DIGITAL' -ForegroundColor Cyan
Write-Host "  Base URL: $BaseUrl (Prefix: $ApiPrefix)" -ForegroundColor Cyan
Write-Host "  Execucao: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Cyan
Write-Host '==========================================================' -ForegroundColor Cyan

$passed = 0
$failed = 0

function Assert-Test {
    param (
        [string]$Description,
        [scriptblock]$TestBlock
    )

    try {
        & $TestBlock
        Write-Host "  [PASS] $Description" -ForegroundColor Green
        $script:passed++
    } catch {
        Write-Host "  [FAIL] $Description" -ForegroundColor Red
        Write-Host "         Erro: $($_.Exception.Message)" -ForegroundColor DarkRed
        $script:failed++
    }
}

function Invoke-Api {
    param (
        [string]$Method,
        [string]$Path,
        [hashtable]$Headers = @{},
        $Body = $null
    )

    $url = "$ApiPrefix$Path"
    $headersToSend = $Headers.Clone()
    if (-not $headersToSend.ContainsKey('Content-Type')) {
        $headersToSend['Content-Type'] = 'application/json'
    }

    $params = @{
        Uri = $url
        Method = $Method
        Headers = $headersToSend
        UseBasicParsing = $true
    }

    if ($null -ne $Body) {
        if ($Body -is [string]) {
            $params['Body'] = $Body
        } else {
            $params['Body'] = ($Body | ConvertTo-Json -Depth 10 -Compress)
        }
    }

    try {
        $res = Invoke-WebRequest @params
        $json = $null
        try {
            $json = ($res.Content | ConvertFrom-Json)
        } catch {
            $json = $res.Content
        }
        return @{
            Status = [int]$res.StatusCode
            Body = $json
        }
    } catch {
        if ($_.Exception.Response) {
            $resp = $_.Exception.Response
            $statusCode = [int]$resp.StatusCode
            $content = ''
            try {
                $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
                $content = $reader.ReadToEnd()
            } catch {}
            $json = $null
            try { $json = ($content | ConvertFrom-Json) } catch { $json = $content }
            return @{
                Status = $statusCode
                Body = $json
            }
        }
        throw $_
    }
}

Write-Host ''
Write-Host '--- 1. HEALTH CHECK E INFRAESTRUTURA ---' -ForegroundColor Yellow

Assert-Test 'GET /health responde status 200' {
    $res = Invoke-Api -Method 'GET' -Path '/health'
    if ($res.Status -ne 200) { throw "Status esperado 200, recebido $($res.Status)" }
    if ($res.Body.status -ne 'ok') { throw 'Corpo esperado status: ok' }
}

Write-Host ''
Write-Host '--- 2. AUTENTICACAO, BCRYPT E BEARER TOKENS ---' -ForegroundColor Yellow

$user1Email = "test_user1_$timestamp@colmeiadigital.local"
$user1Pass = 'SenhaForte123!'
$user1Name = "Apicultor Teste 1 $timestamp"
$user1Token = ''
$user1Id = 0

Assert-Test 'Registro de Usuario 1 (POST /auth/register)' {
    $res = Invoke-Api -Method 'POST' -Path '/auth/register' -Body @{
        name = $user1Name
        email = $user1Email
        password = $user1Pass
    }
    if ($res.Status -ne 200) { throw "Status esperado 200, recebido $($res.Status): $($res.Body.message)" }
    if (-not $res.Body.token) { throw 'Token Bearer nao retornado no registro' }
    if (-not $res.Body.id) { throw 'ID do usuario nao retornado' }
    $script:user1Token = $res.Body.token
    $script:user1Id = $res.Body.id
}

Assert-Test 'Tentativa de login com senha incorreta retorna 400' {
    $res = Invoke-Api -Method 'POST' -Path '/auth/login' -Body @{
        email = $user1Email
        password = 'SenhaIncorreta'
    }
    if ($res.Status -ne 400) { throw "Status esperado 400, recebido $($res.Status)" }
}

Assert-Test 'Login com credenciais corretas (POST /auth/login) gera novo token' {
    $res = Invoke-Api -Method 'POST' -Path '/auth/login' -Body @{
        email = $user1Email
        password = $user1Pass
    }
    if ($res.Status -ne 200) { throw "Status esperado 200, recebido $($res.Status)" }
    if (-not $res.Body.token) { throw 'Token nao retornado no login' }
    $script:user1Token = $res.Body.token
}

$authHeaders = @{
    'Authorization' = "Bearer $user1Token"
}

Assert-Test 'Consulta de sessao autenticada (GET /auth/me) com Bearer Token' {
    $res = Invoke-Api -Method 'GET' -Path '/auth/me' -Headers $authHeaders
    if ($res.Status -ne 200) { throw "Status esperado 200, recebido $($res.Status)" }
    if ($res.Body.email -ne $user1Email) { throw "E-mail retornado divergente: $($res.Body.email)" }
}

Assert-Test 'Requisicao sem token em rota privada retorna 401' {
    $res = Invoke-Api -Method 'GET' -Path '/apiaries'
    if ($res.Status -ne 401) { throw "Status esperado 401, recebido $($res.Status)" }
}

Assert-Test 'Requisicao com Bearer Token invalido retorna 401' {
    $res = Invoke-Api -Method 'GET' -Path '/apiaries' -Headers @{ 'Authorization' = 'Bearer token_falso_invalido' }
    if ($res.Status -ne 401) { throw "Status esperado 401, recebido $($res.Status)" }
}

Assert-Test 'Recuperacao de senha: envio de codigo para email cadastrado (POST /auth/forgot-password)' {
    $res = Invoke-Api -Method 'POST' -Path '/auth/forgot-password' -Body @{
        email = $user1Email
    }
    if ($res.Status -ne 200) { throw "Status esperado 200, recebido $($res.Status): $($res.Body.message)" }
    if ($res.Body.success -ne $true) { throw "Esperado success: true, recebido: $($res.Body.success)" }
}

Assert-Test 'Recuperacao de senha: email nao cadastrado retorna sucesso generico sem enumeracao (POST /auth/forgot-password)' {
    $res = Invoke-Api -Method 'POST' -Path '/auth/forgot-password' -Body @{
        email = "inexistente_$timestamp@naoexiste.com"
    }
    if ($res.Status -ne 200) { throw "Status esperado 200, recebido $($res.Status): $($res.Body.message)" }
    if ($res.Body.success -ne $true) { throw "Esperado success: true, recebido: $($res.Body.success)" }
}

Assert-Test 'Recuperacao de senha: codigo com formato incorreto retorna 400 (POST /auth/reset-password)' {
    $res = Invoke-Api -Method 'POST' -Path '/auth/reset-password' -Body @{
        email = $user1Email
        code = '123'
        newPassword = 'NovaSenhaValida123!'
    }
    if ($res.Status -ne 400) { throw "Status esperado 400, recebido $($res.Status)" }
}

Assert-Test 'Recuperacao de senha: codigo de 6 digitos invalido/expirado retorna 400 (POST /auth/reset-password)' {
    $res = Invoke-Api -Method 'POST' -Path '/auth/reset-password' -Body @{
        email = $user1Email
        code = '999999'
        newPassword = 'NovaSenhaValida123!'
    }
    if ($res.Status -ne 400) { throw "Status esperado 400, recebido $($res.Status)" }
}

Write-Host ''
Write-Host '--- 3. APIARIOS E CAIXAS (CRUD E INTEGRIDADE) ---' -ForegroundColor Yellow

$apiaryId = 0
$box1Id = 0
$box1Name = ''

Assert-Test 'Passo 1: Criacao de Apiario com boxCount=2 (POST /apiaries)' {
    $res = Invoke-Api -Method 'POST' -Path '/apiaries' -Headers $authHeaders -Body @{
        name = 'Apiario Teste Automacao'
        location = 'Serra do Mel, KM 12'
        boxCount = '2'
        description = 'Apiario para validacao automatica'
    }
    if ($res.Status -ne 200) { throw "Status esperado 200, recebido $($res.Status)" }
    if (-not $res.Body.id) { throw 'ID do apiario nao retornado' }
    $script:apiaryId = $res.Body.id
}

Assert-Test 'Passo 2: Backend NAO cria caixas sozinho (GET /boxes retorna EXATAMENTE 0)' {
    $res = Invoke-Api -Method 'GET' -Path "/boxes?apiaryId=$apiaryId" -Headers $authHeaders
    if ($res.Status -ne 200) { throw "Status esperado 200, recebido $($res.Status)" }
    $count = if ($null -eq $res.Body) { 0 } elseif ($res.Body -is [array]) { $res.Body.Count } else { @($res.Body).Count }
    if ($count -ne 0) { throw "Esperado EXATAMENTE 0 caixas no backend antes do sync do mobile, recebido $count" }
}

Assert-Test 'Passo 3: Mobile envia 2 caixas criadas localmente (2x POST /boxes)' {
    $res1 = Invoke-Api -Method 'POST' -Path '/boxes' -Headers $authHeaders -Body @{
        apiaryId = $apiaryId
        name = 'Nova Caixa 01'
        position = 1
    }
    if ($res1.Status -ne 200) { throw "Falha ao criar Caixa 1: $($res1.Body.message)" }
    $script:box1Id = $res1.Body.id
    $script:box1Name = $res1.Body.name

    $res2 = Invoke-Api -Method 'POST' -Path '/boxes' -Headers $authHeaders -Body @{
        apiaryId = $apiaryId
        name = 'Nova Caixa 02'
        position = 2
    }
    if ($res2.Status -ne 200) { throw "Falha ao criar Caixa 2: $($res2.Body.message)" }
}

Assert-Test 'Passo 4: Verificacao de quantidade e sem duplicatas (GET /boxes retorna EXATAMENTE 2)' {
    $res = Invoke-Api -Method 'GET' -Path "/boxes?apiaryId=$apiaryId" -Headers $authHeaders
    if ($res.Status -ne 200) { throw "Status esperado 200, recebido $($res.Status)" }
    $count = if ($res.Body -is [array]) { $res.Body.Count } else { @($res.Body).Count }
    if ($count -ne 2) { throw "Esperado EXATAMENTE 2 caixas (nem 0, nem 4), recebido $count" }
}

Assert-Test 'Listagem de Apiarios (GET /apiaries)' {
    $res = Invoke-Api -Method 'GET' -Path '/apiaries' -Headers $authHeaders
    if ($res.Status -ne 200) { throw "Status esperado 200, recebido $($res.Status)" }
    $found = $res.Body | Where-Object { $_.id -eq $apiaryId }
    if (-not $found) { throw 'Apiario recem-criado nao encontrado na lista' }
}

Assert-Test 'Criacao explicita de nova Caixa (POST /boxes)' {
    $res = Invoke-Api -Method 'POST' -Path '/boxes' -Headers $authHeaders -Body @{
        apiaryId = $apiaryId
        name = 'Caixa Extra 99'
        position = 99
    }
    if ($res.Status -ne 200) { throw "Status esperado 200, recebido $($res.Status): $($res.Body.message)" }
    if ($res.Body.name -ne 'Caixa Extra 99') { throw 'Nome da caixa retornado divergente' }
    $script:boxExtraId = $res.Body.id
}

Assert-Test 'Renomear Caixa (PUT /boxes/:id/rename)' {
    $res = Invoke-Api -Method 'PUT' -Path "/boxes/$box1Id/rename" -Headers $authHeaders -Body @{
        name = 'Colmeia Principal 01'
    }
    if ($res.Status -ne 200) { throw "Status esperado 200, recebido $($res.Status)" }
}

Assert-Test 'Arquivar e Desarquivar Caixa (/archive e /unarchive)' {
    # Arquivar
    $res = Invoke-Api -Method 'POST' -Path "/boxes/$box1Id/archive" -Headers $authHeaders
    if ($res.Status -ne 200) { throw "Falha ao arquivar: status $($res.Status)" }

    # Verificar que sumiu da lista ativa
    $listActive = Invoke-Api -Method 'GET' -Path "/boxes?apiaryId=$apiaryId" -Headers $authHeaders
    $foundActive = $listActive.Body | Where-Object { $_.id -eq $box1Id }
    if ($foundActive) { throw 'Caixa arquivada ainda apareceu na lista ativa' }

    # Verificar que aparece com includeArchived=true
    $listAll = Invoke-Api -Method 'GET' -Path "/boxes?apiaryId=$apiaryId&includeArchived=true" -Headers $authHeaders
    $foundAll = $listAll.Body | Where-Object { $_.id -eq $box1Id }
    if (-not $foundAll) { throw 'Caixa arquivada nao apareceu com includeArchived=true' }

    # Desarquivar
    $resUnarchive = Invoke-Api -Method 'POST' -Path "/boxes/$box1Id/unarchive" -Headers $authHeaders
    if ($resUnarchive.Status -ne 200) { throw "Falha ao desarquivar: status $($resUnarchive.Status)" }
}

Write-Host ''
Write-Host '--- 4. INSPECOES (REVISOES) E MANEJOS ---' -ForegroundColor Yellow

$revisionId = 0
$manejoId = 0

Assert-Test 'Criacao de Inspecao (POST /revisions)' {
    $res = Invoke-Api -Method 'POST' -Path '/revisions' -Headers $authHeaders -Body @{
        caixaId = $box1Id
        caixaName = 'Colmeia Principal 01'
        apiaryId = $apiaryId
        apiaryName = 'Apiario Teste Automacao'
        tipo = 'apiario'
        checkedOptions = @('postura_boa', 'rainha_vista', 'alimento_suficiente')
        observacoes = 'Enxame forte e saudavel'
        indicacoes = 'Revisar em 15 dias'
    }
    if ($res.Status -ne 200) { throw "Status esperado 200, recebido $($res.Status): $($res.Body.message)" }
    $script:revisionId = $res.Body.id
}

Assert-Test 'Listagem de Inspecoes (GET /revisions)' {
    $res = Invoke-Api -Method 'GET' -Path "/revisions?apiaryId=$apiaryId" -Headers $authHeaders
    if ($res.Status -ne 200) { throw "Status esperado 200, recebido $($res.Status)" }
    $found = $res.Body | Where-Object { $_.id -eq $revisionId }
    if (-not $found) { throw 'Inspecao criada nao encontrada' }
}

Assert-Test 'Criacao de Manejo (POST /manejos)' {
    $res = Invoke-Api -Method 'POST' -Path '/manejos' -Headers $authHeaders -Body @{
        caixaId = $box1Id
        caixaName = 'Colmeia Principal 01'
        apiaryId = $apiaryId
        apiaryName = 'Apiario Teste Automacao'
        tipo = 'apiario'
        revisaoId = $revisionId
        checkedOptions = @('alimentacao_energetica', 'troca_cera')
        observacoes = 'Fornecido xarope 1:1'
        indicacoes = 'Verificar consumo em 3 dias'
    }
    if ($res.Status -ne 200) { throw "Status esperado 200, recebido $($res.Status): $($res.Body.message)" }
    $script:manejoId = $res.Body.id
}

Assert-Test 'Listagem de Manejos (GET /manejos)' {
    $res = Invoke-Api -Method 'GET' -Path "/manejos?apiaryId=$apiaryId" -Headers $authHeaders
    if ($res.Status -ne 200) { throw "Status esperado 200, recebido $($res.Status)" }
    $found = $res.Body | Where-Object { $_.id -eq $manejoId }
    if (-not $found) { throw 'Manejo criado nao encontrado' }
}

Write-Host ''
Write-Host '--- 5. RELATORIOS E ESTATISTICAS ANALITICAS ---' -ForegroundColor Yellow

Assert-Test 'Estatisticas de Relatorios (POST /reports/stats)' {
    $todayIso = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.fffZ')
    $pastIso = (Get-Date).ToUniversalTime().AddDays(-30).ToString('yyyy-MM-ddTHH:mm:ss.fffZ')

    $res = Invoke-Api -Method 'POST' -Path '/reports/stats' -Headers $authHeaders -Body @{
        fromIso = $pastIso
        toIso = $todayIso
        chartFilter = 'revisoes'
    }
    if ($res.Status -ne 200) { throw "Status esperado 200, recebido $($res.Status)" }
    if ($null -eq $res.Body.metrics) { throw 'Objeto metrics ausente' }
    if ($res.Body.metrics.totalApiaries -lt 1) { throw 'Total de apiarios menor que 1' }
    if ($res.Body.metrics.totalBoxes -lt 1) { throw 'Total de caixas menor que 1' }
}

Write-Host ''
Write-Host '--- 6. MULTI-TENANCY E ISOLAMENTO DE DADOS ---' -ForegroundColor Yellow

$user2Email = "test_user2_$timestamp@colmeiadigital.local"
$user2Pass = 'SenhaForte456!'
$user2Name = "Apicultor Teste 2 $timestamp"
$user2Token = ''

Assert-Test 'Registro e Login de Usuario 2' {
    $res = Invoke-Api -Method 'POST' -Path '/auth/register' -Body @{
        name = $user2Name
        email = $user2Email
        password = $user2Pass
    }
    if ($res.Status -ne 200) { throw "Status $($res.Status)" }
    $script:user2Token = $res.Body.token
}

Assert-Test 'Isolamento: Usuario 2 nao enxerga apiarios do Usuario 1' {
    $res = Invoke-Api -Method 'GET' -Path '/apiaries' -Headers @{ 'Authorization' = "Bearer $user2Token" }
    if ($res.Status -ne 200) { throw "Status $($res.Status)" }
    $leaked = $res.Body | Where-Object { $_.id -eq $apiaryId }
    if ($leaked) { throw "VAZAMENTO DE DADOS: Usuario 2 enxergou o apiario $apiaryId do Usuario 1!" }
}

Write-Host ''
Write-Host '--- 7. EXCLUSAO EM CASCATA ---' -ForegroundColor Yellow

Assert-Test 'Excluir Apiario do Usuario 1 remove em cascata caixas, inspecoes e manejos' {
    $res = Invoke-Api -Method 'DELETE' -Path "/apiaries/$apiaryId" -Headers $authHeaders
    if ($res.Status -ne 200) { throw "Falha ao excluir apiario: $($res.Status)" }

    # Verificar que as caixas sumiram
    $boxesRes = Invoke-Api -Method 'GET' -Path "/boxes?apiaryId=$apiaryId&includeArchived=true" -Headers $authHeaders
    $boxCountAfter = if ($null -eq $boxesRes.Body) { 0 } elseif ($boxesRes.Body -is [array]) { $boxesRes.Body.Count } else { @($boxesRes.Body).Count }
    if ($boxCountAfter -gt 0) { throw 'Caixas do apiario ainda existem apos exclusao em cascata' }

    # Verificar que as revisoes sumiram
    $revsRes = Invoke-Api -Method 'GET' -Path "/revisions?apiaryId=$apiaryId&includeArchived=true" -Headers $authHeaders
    $revCountAfter = if ($null -eq $revsRes.Body) { 0 } elseif ($revsRes.Body -is [array]) { $revsRes.Body.Count } else { @($revsRes.Body).Count }
    if ($revCountAfter -gt 0) { throw 'Revisoes do apiario ainda existem apos exclusao em cascata' }

    # Verificar que os manejos sumiram
    $manejosRes = Invoke-Api -Method 'GET' -Path "/manejos?apiaryId=$apiaryId&includeArchived=true" -Headers $authHeaders
    $manejosCountAfter = if ($null -eq $manejosRes.Body) { 0 } elseif ($manejosRes.Body -is [array]) { $manejosRes.Body.Count } else { @($manejosRes.Body).Count }
    if ($manejosCountAfter -gt 0) { throw 'Manejos do apiario ainda existem apos exclusao em cascata' }
}

Write-Host ''
Write-Host '--- 8. ENCERRAMENTO DE SESSAO (LOGOUT) ---' -ForegroundColor Yellow

Assert-Test 'Logout invalida o Bearer Token (POST /auth/logout)' {
    $res = Invoke-Api -Method 'POST' -Path '/auth/logout' -Headers $authHeaders
    if ($res.Status -ne 200) { throw "Falha no logout: $($res.Status)" }

    # Tentar usar o token apos logout deve retornar 401
    $meRes = Invoke-Api -Method 'GET' -Path '/auth/me' -Headers $authHeaders
    if ($meRes.Status -ne 401) { throw "Token continuou valido apos logout! Status retornado: $($meRes.Status)" }
}

Write-Host ''
Write-Host '==========================================================' -ForegroundColor Cyan
Write-Host '  RESULTADO FINAL DOS TESTES:' -ForegroundColor Cyan
Write-Host "  Passaram:  $passed" -ForegroundColor Green
Write-Host "  Falharam:  $failed" -ForegroundColor $(if ($failed -gt 0) { 'Red' } else { 'Green' })
Write-Host '==========================================================' -ForegroundColor Cyan

if ($failed -gt 0) {
    exit 1
}
