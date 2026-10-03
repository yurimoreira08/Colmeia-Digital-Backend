<#
.SYNOPSIS
    Script de Restauracao / Rollback do Banco de Dados PostgreSQL (Supabase) - Schema Public.
.DESCRIPTION
    Restaura um dump SQL no banco de dados com validacao estrita de erros.
    Realiza backup de seguranca do schema public e valida que nao ha erros durante a execucao do psql.
.PARAMETER BackupFile
    Caminho opcional para o arquivo .sql. Se omitido, lista os backups para selecao.
#>

[CmdletBinding()]
param(
    [Parameter(Position = 0, Mandatory = $false)]
    [string]$BackupFile
)

$ErrorActionPreference = 'Stop'

Write-Host '=========================================' -ForegroundColor Magenta
Write-Host '  Colmeia Digital - Restore de Banco     ' -ForegroundColor Magenta
Write-Host '  (Escopo: Exclusivo Schema Public)      ' -ForegroundColor Magenta
Write-Host '=========================================' -ForegroundColor Magenta

# 1. Localizar ferramentas PostgreSQL
function Find-PostgresTool([string]$toolName) {
    $found = Get-Command $toolName -ErrorAction SilentlyContinue
    if ($found) {
        return $found.Source
    }

    $commonPaths = @(
        "C:\Program Files\PostgreSQL\*\bin\$toolName.exe",
        "C:\Program Files (x86)\PostgreSQL\*\bin\$toolName.exe",
        "C:\tools\postgresql\bin\$toolName.exe",
        "$env:LOCALAPPDATA\Programs\PostgreSQL\*\bin\$toolName.exe"
    )

    foreach ($pattern in $commonPaths) {
        $matchesList = Get-ChildItem -Path $pattern -ErrorAction SilentlyContinue | Sort-Object FullName -Descending
        if ($matchesList -and $matchesList.Count -gt 0) {
            $binDir = Split-Path -Parent $matchesList[0].FullName
            $env:PATH = $binDir + ';' + $env:PATH
            return $matchesList[0].FullName
        }
    }

    return $null
}

$psqlCmd = Find-PostgresTool 'psql'
$pgDumpCmd = Find-PostgresTool 'pg_dump'

if (-not $psqlCmd) {
    Write-Host ''
    Write-Host '[ERRO] O utilitario psql nao foi encontrado no sistema!' -ForegroundColor Red
    Write-Host ''
    Write-Host 'Como instalar no Windows:' -ForegroundColor Yellow
    Write-Host '  Opcao 1: winget install PostgreSQL.PostgreSQL' -ForegroundColor Green
    Write-Host '  Opcao 2: Instalador de https://www.postgresql.org/download/windows/' -ForegroundColor Green
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
Get-Content $envFile | ForEach-Object {
    $line = $_.Trim()
    if ($line -match '^DATABASE_URL\s*=\s*(.*)$') {
        $val = $matches[1].Trim()
        if (($val.StartsWith('"') -and $val.EndsWith('"')) -or ($val.StartsWith("'") -and $val.EndsWith("'"))) {
            $val = $val.Substring(1, $val.Length - 2)
        }
        $databaseUrl = $val
    }
}

if (-not $databaseUrl) {
    Write-Host '[ERRO] DATABASE_URL nao foi encontrada no arquivo .env!' -ForegroundColor Red
    exit 1
}

# 3. Selecionar o arquivo de backup
$backupDir = Join-Path $rootDir 'backups'
$selectedFile = $null

if ($BackupFile) {
    if (Test-Path $BackupFile) {
        $selectedFile = (Get-Item $BackupFile).FullName
    } elseif (Test-Path (Join-Path $backupDir $BackupFile)) {
        $selectedFile = (Get-Item (Join-Path $backupDir $BackupFile)).FullName
    } else {
        Write-Host "[ERRO] Arquivo de backup nao encontrado: $BackupFile" -ForegroundColor Red
        exit 1
    }
} else {
    if (-not (Test-Path $backupDir)) {
        Write-Host "[ERRO] A pasta de backups '$backupDir' nao existe. Execute .\scripts\backup-db.ps1 primeiro." -ForegroundColor Red
        exit 1
    }

    $availableBackups = Get-ChildItem -Path $backupDir -Filter '*.sql' | Sort-Object LastWriteTime -Descending

    if ($availableBackups.Count -eq 0) {
        Write-Host "[ERRO] Nenhum arquivo .sql encontrado em $backupDir" -ForegroundColor Red
        exit 1
    }

    Write-Host 'Selecione o backup que deseja restaurar:' -ForegroundColor Cyan
    Write-Host ''
    for ($i = 0; $i -lt $availableBackups.Count; $i++) {
        $b = $availableBackups[$i]
        $sKB = [math]::Round($b.Length / 1KB, 2)
        $sMB = [math]::Round($b.Length / 1MB, 2)
        $sz = if ($sMB -ge 1) { "$sMB MB" } else { "$sKB KB" }
        $num = $i + 1
        Write-Host "  [$num] $($b.Name) ($sz - $($b.LastWriteTime.ToString('yyyy-MM-dd HH:mm:ss')))" -ForegroundColor White
    }
    Write-Host ''

    $choice = Read-Host "Digite o numero do backup desejado (1-$($availableBackups.Count)) ou 'C' para cancelar"
    if ($choice -match '^[Cc]$' -or -not $choice) {
        Write-Host '[INFO] Operacao cancelada pelo usuario.' -ForegroundColor Yellow
        exit 0
    }

    $choiceIndex = 0
    if ([int]::TryParse($choice, [ref]$choiceIndex) -and $choiceIndex -ge 1 -and $choiceIndex -le $availableBackups.Count) {
        $selectedFile = $availableBackups[$choiceIndex - 1].FullName
    } else {
        Write-Host "[ERRO] Opcao invalida: $choice" -ForegroundColor Red
        exit 1
    }
}

$selectedItem = Get-Item $selectedFile
Write-Host ''
Write-Host '[INFO] Backup selecionado para restauracao:' -ForegroundColor Yellow
Write-Host "  Nome: $($selectedItem.Name)" -ForegroundColor White
Write-Host "  Data: $($selectedItem.LastWriteTime.ToString('yyyy-MM-dd HH:mm:ss'))" -ForegroundColor DarkGray
Write-Host ''

# 4. Confirmacao explicita de seguranca
Write-Host '[ATENCAO] ESTA OPERACAO E DESTRUTIVA!' -ForegroundColor Red
Write-Host 'Todos os dados atuais das tabelas do app serao substituidos pelos dados deste backup.' -ForegroundColor Yellow
Write-Host ''
$confirmation = Read-Host "Digite exatamente 'SIM' em maiusculas para confirmar o restore"

if ($confirmation -ne 'SIM') {
    Write-Host "[INFO] Confirmacao nao recebida ('$confirmation'). Restore CANCELADO com seguranca." -ForegroundColor Yellow
    exit 0
}

# 5. Backup automatico de seguranca pre-restore (apenas schema public)
Write-Host ''
Write-Host '[SEGURANCA] Gerando backup do estado atual antes do restore...' -ForegroundColor Cyan
$preRestoreFile = $null
if ($pgDumpCmd) {
    $preTimestamp = Get-Date -Format 'yyyy-MM-dd_HHmmss'
    $preRestoreFile = Join-Path $backupDir "pre_restore_backup_$preTimestamp.sql"
    
    $preDumpArgs = @(
        '--schema=public',
        '--clean',
        '--if-exists',
        '--no-owner',
        '--no-privileges',
        "--dbname=$databaseUrl",
        "--file=$preRestoreFile"
    )

    & $pgDumpCmd @preDumpArgs
    if ($LASTEXITCODE -eq 0 -and (Test-Path $preRestoreFile)) {
        Write-Host "[OK] Backup de seguranca pre-restore salvo em: $(Split-Path -Leaf $preRestoreFile)" -ForegroundColor Green
    } else {
        Write-Host '[AVISO] Nao foi possivel gerar o backup de seguranca pre-restore. Prosseguindo com o restore solicitado...' -ForegroundColor Yellow
    }
}

# 6. Executar Restauracao via psql com captura estrita de erros
Write-Host ''
Write-Host '[INFO] Restaurando schema public a partir do arquivo selecionado...' -ForegroundColor Magenta

$psqlArgs = @(
    '-v', 'ON_ERROR_STOP=1',
    "--dbname=$databaseUrl",
    "--file=$selectedFile"
)

# Captura stdout e stderr
$rawOutput = & $psqlCmd @psqlArgs 2>&1
$exitCode = $LASTEXITCODE

$outputLines = @()
if ($rawOutput) {
    foreach ($item in $rawOutput) {
        $outputLines += $item.ToString()
    }
}

$errorLines = $outputLines | Where-Object { $_ -match 'ERROR:\s+' -or $_ -match 'FATAL:\s+' }

if ($exitCode -ne 0 -or ($errorLines -and $errorLines.Count -gt 0)) {
    Write-Host ''
    Write-Host '=========================================' -ForegroundColor Red
    Write-Host '[ERRO] FALHA NA RESTAURACAO DO BANCO!' -ForegroundColor Red
    Write-Host '=========================================' -ForegroundColor Red
    Write-Host 'Erros encontrados durante a execucao do psql:' -ForegroundColor Yellow
    foreach ($err in $errorLines) {
        Write-Host "  $err" -ForegroundColor Red
    }
    if ($preRestoreFile -and (Test-Path $preRestoreFile)) {
        Write-Host ''
        Write-Host "[INFO] Caso precise, o backup de seguranca anterior ao restore esta salvo em:" -ForegroundColor Cyan
        Write-Host "       $(Split-Path -Leaf $preRestoreFile)" -ForegroundColor White
    }
    exit 1
}

Write-Host ''
Write-Host '=========================================' -ForegroundColor Green
Write-Host '[OK] BANCO RESTAURADO COM SUCESSO (0 ERROS)!' -ForegroundColor Green
Write-Host '=========================================' -ForegroundColor Green
Write-Host "Restaurado a partir de: $($selectedItem.Name)" -ForegroundColor White
Write-Host 'Dica: Inicie o servidor (npm run dev) ou use npx prisma studio para verificar os dados.' -ForegroundColor Cyan
Write-Host ''
