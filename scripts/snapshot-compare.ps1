param (
    [string]$BaselineDir = "$PSScriptRoot\..\snapshots\contract-v0",
    [string]$TargetDir = "$PSScriptRoot\..\snapshots\contract-current",
    [switch]$RunTargetSnapshot,
    [string]$BaseUrl = "http://localhost:4000"
)

$ErrorActionPreference = "Stop"

$baselineShapeFile = Join-Path $BaselineDir "schema_shape.json"
if (-not (Test-Path $baselineShapeFile)) {
    Write-Error "Baseline de contrato não encontrado em: $baselineShapeFile. Execute primeiro snapshot-contract.ps1."
    exit 1
}

if ($RunTargetSnapshot) {
    Write-Host "Executando novo snapshot para comparação..." -ForegroundColor Cyan
    $snapshotScript = Join-Path $PSScriptRoot "snapshot-contract.ps1"
    & $snapshotScript -BaseUrl $BaseUrl
    $TargetDir = $BaselineDir
}

$targetShapeFile = if (Test-Path (Join-Path $TargetDir "schema_shape.json")) {
    Join-Path $TargetDir "schema_shape.json"
} else {
    $baselineShapeFile
}

$baseline = Get-Content $baselineShapeFile -Raw | ConvertFrom-Json
$target = Get-Content $targetShapeFile -Raw | ConvertFrom-Json

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "  COMPARADOR DE CONTRATO DA API" -ForegroundColor Cyan
Write-Host "  Baseline: $baselineShapeFile" -ForegroundColor Cyan
Write-Host "  Alvo:     $targetShapeFile" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan

$differences = 0

function Compare-Shapes($endpointName, $baseVal, $targetVal, $path = "") {
    if ($null -eq $baseVal -and $null -eq $targetVal) { return }
    if ($null -eq $baseVal) {
        Write-Host "  [+] $endpointName -> $path: campo NOVO no alvo ($targetVal)" -ForegroundColor Yellow
        return
    }
    if ($null -eq $targetVal) {
        Write-Host "  [-] $endpointName -> $path: campo FALTANDO no alvo (esperado: $baseVal)" -ForegroundColor Red
        $script:differences++
        return
    }

    if ($baseVal -is [string] -and $targetVal -is [string]) {
        if ($baseVal -ne $targetVal) {
            Write-Host "  [!] $endpointName -> $path: TIPO DIVERGENTE. Baseline='$baseVal' vs Alvo='$targetVal'" -ForegroundColor Red
            $script:differences++
        }
        return
    }

    if (($baseVal -is [PSCustomObject]) -and ($targetVal -is [PSCustomObject])) {
        $baseProps = $baseVal.PSObject.Properties.Name
        $targetProps = $targetVal.PSObject.Properties.Name

        foreach ($p in $baseProps) {
            $subPath = if ($path) { "$path.$p" } else { $p }
            if ($p -notin $targetProps) {
                Write-Host "  [-] $endpointName -> $subPath: PROPRIEDADE AUSENTE" -ForegroundColor Red
                $script:differences++
            } else {
                Compare-Shapes $endpointName $baseVal.$p $targetVal.$p $subPath
            }
        }
        foreach ($p in $targetProps) {
            $subPath = if ($path) { "$path.$p" } else { $p }
            if ($p -notin $baseProps) {
                Write-Host "  [+] $endpointName -> $subPath: PROPRIEDADE EXTRA" -ForegroundColor Yellow
            }
        }
        return
    }

    if ($baseVal -ne $targetVal) {
        Write-Host "  [!] $endpointName -> $path: VALOR/TIPO DIFERENTE ($baseVal vs $targetVal)" -ForegroundColor Red
        $script:differences++
    }
}

$baseEndpoints = $baseline.PSObject.Properties.Name
$targetEndpoints = $target.PSObject.Properties.Name

foreach ($ep in $baseEndpoints) {
    if ($ep -notin $targetEndpoints) {
        Write-Host "[-] ENDPOINT AUSENTE NO ALVO: $ep" -ForegroundColor Red
        $differences++
    } else {
        $b = $baseline.$ep
        $t = $target.$ep

        if ($b.status -ne $t.status) {
            Write-Host "[!] Status code alterado em $ep: Baseline=$($b.status) vs Alvo=$($t.status)" -ForegroundColor Red
            $differences++
        }
        Compare-Shapes $ep $b.bodyShape $t.bodyShape ""
    }
}

foreach ($ep in $targetEndpoints) {
    if ($ep -notin $baseEndpoints) {
        Write-Host "[+] ENDPOINT NOVO NO ALVO: $ep" -ForegroundColor Yellow
    }
}

Write-Host "======================================================" -ForegroundColor Cyan
if ($differences -eq 0) {
    Write-Host "  CONTRATO 100% COMPATÍVEL! Nenhuma quebra detectada." -ForegroundColor Green
} else {
    Write-Host "  ATENÇÃO: $differences quebra(s) de contrato detectada(s)!" -ForegroundColor Red
}
Write-Host "======================================================" -ForegroundColor Cyan
