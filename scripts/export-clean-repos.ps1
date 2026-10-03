param (
    [string]$TargetBackendDir = "C:\Users\yurik\Codigos\ColmeiaDigitalBackend",
    [string]$TargetMobileDir = "C:\Users\yurik\Codigos\ColmeiaDigitalMobile"
)

$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  EXPORTAÇÃO LIMPA DOS REPOSITÓRIOS — COLMEIA DIGITAL" -ForegroundColor Cyan
Write-Host "  Backend Destino: $TargetBackendDir" -ForegroundColor Cyan
Write-Host "  Mobile Destino:  $TargetMobileDir" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$sourceBackend = "C:\Users\yurik\Codigos\AppicolaExpress"
$sourceMobile = "C:\Users\yurik\Codigos\AppicolaReactNative"

# 1. EXPORTAÇÃO BACKEND
Write-Host "`n1. Exportando Backend limpo..." -ForegroundColor Yellow
if (-not (Test-Path $TargetBackendDir)) {
    New-Item -ItemType Directory -Path $TargetBackendDir -Force | Out-Null
}

$backendExcludes = @(".git", "node_modules", "dist", ".gemini")
robocopy $sourceBackend $TargetBackendDir /E /XD $backendExcludes /XF "*.db" "*.log" /R:1 /W:1 /NP /NFL /NDL

Write-Host "   -> Backend copiado com sucesso para $TargetBackendDir" -ForegroundColor Green

# 2. EXPORTAÇÃO MOBILE
Write-Host "`n2. Exportando Mobile limpo..." -ForegroundColor Yellow
if (-not (Test-Path $TargetMobileDir)) {
    New-Item -ItemType Directory -Path $TargetMobileDir -Force | Out-Null
}

$mobileExcludes = @(".git", "node_modules", ".expo", "dist", "build", ".gemini")
robocopy $sourceMobile $TargetMobileDir /E /XD $mobileExcludes /XF "*.db" "*.log" /R:1 /W:1 /NP /NFL /NDL

Write-Host "   -> Mobile copiado com sucesso para $TargetMobileDir" -ForegroundColor Green

# 3. INICIALIZAÇÃO GIT INDEPENDENTE
Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host "  PRÓXIMOS PASSOS: INICIALIZAR REPOSITÓRIOS GIT LIMPOS" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

Write-Host @"
Execute no seu terminal PowerShell para iniciar o versionamento novo (sem histórico legado):

# --- BACKEND ---
cd $TargetBackendDir
git init
git add .
git commit -m "feat: initial commit of Colmeia Digital Backend (Supabase + Prisma)"

# --- MOBILE ---
cd $TargetMobileDir
git init
git add .
git commit -m "feat: initial commit of Colmeia Digital Mobile (Expo 54 + Offline-First)"

"@ -ForegroundColor White

Write-Host "Exportação concluída com sucesso!" -ForegroundColor Green
