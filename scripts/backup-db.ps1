<#
.SYNOPSIS
    Script de Backup do Banco de Dados PostgreSQL (Supabase) - Apenas Schema Public.
.DESCRIPTION
    Realiza o dump completo das tabelas da aplicacao (schema public) usando pg_dump e DATABASE_URL.
    Ignora schemas internos do Supabase (auth, storage, realtime, vault, extensions).
#>

[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

Write-Host '=========================================' -ForegroundColor Cyan
Write-Host '  Colmeia Digital - Backup de Banco      ' -ForegroundColor Cyan
Write-Host '  (Escopo: Exclusivo Schema Public)      ' -ForegroundColor Cyan
Write-Host '=========================================' -ForegroundColor Cyan

# 1. Localizar pg_dump
$pgDumpCmd = $null
$foundCommand = Get-Command pg_dump -ErrorAction SilentlyContinue

if ($foundCommand) {
    $pgDumpCmd = $foundCommand.Source
} else {
    $commonPaths = @(
        'C:\Program Files\PostgreSQL\*\bin\pg_dump.exe',
        'C:\Program Files (x86)\PostgreSQL\*\bin\pg_dump.exe',
        'C:\tools\postgresql\bin\pg_dump.exe',
        "$env:LOCALAPPDATA\Programs\PostgreSQL\*\bin\pg_dump.exe"
    )

    foreach ($pattern in $commonPaths) {
        $matchesList = Get-ChildItem -Path $pattern -ErrorAction SilentlyContinue | Sort-Object FullName -Descending
        if ($matchesList -and $matchesList.Count -gt 0) {
            $pgDumpCmd = $matchesList[0].FullName
            $binDir = Split-Path -Parent $pgDumpCmd
            $env:PATH = $binDir + ';' + $env:PATH
            Write-Host "[INFO] pg_dump localizado em: $pgDumpCmd" -ForegroundColor DarkGray
            break
        }
    }
}

if (-not $pgDumpCmd) {
    Write-Host ''
    Write-Host '[ERRO] O utilitario pg_dump nao foi encontrado no sistema!' -ForegroundColor Red
    Write-Host ''
    Write-Host 'Como instalar o pg_dump no Windows:' -ForegroundColor Yellow
    Write-Host '  Opcao 1 (Terminal Windows):' -ForegroundColor White
    Write-Host '    winget install PostgreSQL.PostgreSQL' -ForegroundColor Green
    Write-Host '  Opcao 2 (Instalador Oficial):' -ForegroundColor White
    Write-Host '    https://www.postgresql.org/download/windows/' -ForegroundColor Green
    Write-Host '    (Marque a opcao Command Line Tools durante a instalacao)' -ForegroundColor DarkGray
    Write-Host '  Opcao 3 (Adicionar ao PATH caso ja tenha instalado):' -ForegroundColor White
    Write-Host '    Adicione a pasta bin do PostgreSQL nas Variaveis de Ambiente do Windows.' -ForegroundColor DarkGray
    Write-Host ''
    exit 1
}

# 2. Localizar e ler o arquivo .env
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir = Split-Path -Parent $scriptDir
$envFile = Join-Path $rootDir '.env'

if (-not (Test-Path $envFile)) {
    Write-Host "[ERRO] Arquivo .env nao encontrado na raiz: $rootDir" -ForegroundColor Red
    exit 1
}

$databaseUrl = $null
foreach ($rawLine in (Get-Content $envFile)) {
    $line = $rawLine.Trim()
    if ($line -match '^DATABASE_URL\s*=\s*(.*)$') {
        $val = $matches[1].Trim()
        if (($val.StartsWith('"') -and $val.EndsWith('"')) -or ($val.StartsWith("'") -and $val.EndsWith("'"))) {
            $val = $val.Substring(1, $val.Length - 2)
        }
        $databaseUrl = $val
        break
    }
}

if (-not $databaseUrl) {
    Write-Host '[ERRO] DATABASE_URL nao foi encontrada no arquivo .env!' -ForegroundColor Red
    exit 1
}

# 3. Mascarar URL para exibicao no console
try {
    $uri = [System.Uri]$databaseUrl
    $maskedHost = $uri.Scheme + '://' + $uri.Host + ':' + $uri.Port + $uri.AbsolutePath
    Write-Host "[INFO] Banco alvo: $maskedHost" -ForegroundColor DarkCyan
} catch {
    Write-Host '[INFO] Banco alvo: PostgreSQL (Supabase)' -ForegroundColor DarkCyan
}

# 4. Criar diretorio de backups
$backupDir = Join-Path $rootDir 'backups'
if (-not (Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
    Write-Host "[INFO] Pasta de backups criada: $backupDir" -ForegroundColor DarkGray
}

# 5. Gerar nome do arquivo com data e hora
$timestamp = Get-Date -Format 'yyyy-MM-dd_HHmm'
$backupFile = Join-Path $backupDir "backup_$timestamp.sql"

if (Test-Path $backupFile) {
    $timestamp = Get-Date -Format 'yyyy-MM-dd_HHmmss'
    $backupFile = Join-Path $backupDir "backup_$timestamp.sql"
}

Write-Host '[INFO] Gerando dump do schema public (tabelas do app)...' -ForegroundColor Yellow

# 6. Executar pg_dump com filtro restrito ao schema public
# --schema=public: exclui schemas internos do Supabase (auth, storage, realtime, extensions)
# --clean --if-exists: recria tabelas limpas na restauracao
# --no-owner --no-privileges: sem conflitos de permissoes
$dumpArgs = @(
    '--schema=public',
    '--clean',
    '--if-exists',
    '--no-owner',
    '--no-privileges',
    "--dbname=$databaseUrl",
    "--file=$backupFile"
)

& $pgDumpCmd @dumpArgs

if ($LASTEXITCODE -ne 0 -or -not (Test-Path $backupFile)) {
    Write-Host '[ERRO] Falha ao gerar o backup. Verifique a conexao e as credenciais no .env.' -ForegroundColor Red
    exit 1
}

$fileItem = Get-Item $backupFile
$sizeKB = [math]::Round($fileItem.Length / 1KB, 2)
$sizeMB = [math]::Round($fileItem.Length / 1MB, 2)
$displaySize = if ($sizeMB -ge 1) { "$sizeMB MB" } else { "$sizeKB KB" }

Write-Host ''
Write-Host '[OK] Backup do schema public concluido com sucesso!' -ForegroundColor Green
Write-Host "Arquivo: $($fileItem.Name) ($displaySize)" -ForegroundColor White
Write-Host "Caminho: $backupFile" -ForegroundColor DarkGray
Write-Host ''

# 7. Listar todos os backups existentes
Write-Host '---------------------------------------------------------' -ForegroundColor DarkGray
Write-Host 'Backups disponiveis em backups/ (mais recente primeiro):' -ForegroundColor Cyan
Write-Host '---------------------------------------------------------' -ForegroundColor DarkGray

$backups = Get-ChildItem -Path $backupDir -Filter '*.sql' | Sort-Object LastWriteTime -Descending

if ($backups.Count -eq 0) {
    Write-Host 'Nenhum backup encontrado.' -ForegroundColor Gray
} else {
    $index = 1
    foreach ($b in $backups) {
        $sKB = [math]::Round($b.Length / 1KB, 2)
        $sMB = [math]::Round($b.Length / 1MB, 2)
        $sz = if ($sMB -ge 1) { "$sMB MB" } else { "$sKB KB" }
        $isCurrent = if ($b.FullName -eq $fileItem.FullName) { ' (NOVO)' } else { '' }
        Write-Host "  [$index] $($b.Name) - $sz - $($b.LastWriteTime.ToString('yyyy-MM-dd HH:mm:ss'))$isCurrent" -ForegroundColor $(if ($isCurrent) { 'Green' } else { 'White' })
        $index++
    }
}

Write-Host '---------------------------------------------------------' -ForegroundColor DarkGray
Write-Host 'Para restaurar um backup, execute:' -ForegroundColor Gray
Write-Host '  .\scripts\restore-db.ps1' -ForegroundColor Yellow
Write-Host ''
