# update-service.ps1
# Para o servico, gera um novo build de producao e sobe o servico de novo.
# Rode isso depois de qualquer mudanca no codigo.
# Precisa rodar num PowerShell como Administrador.
#
# ATENCAO: este arquivo usa apenas caracteres ASCII de proposito.

$ErrorActionPreference = "Stop"

$NomeServico = "MeuOneNote"
$PastaProjeto = "C:\DEV\meu-onenote"
$NextBin = Join-Path $PastaProjeto "node_modules\next\dist\bin\next"
$NssmExe = "C:\Users\rober\AppData\Local\Microsoft\WinGet\Packages\NSSM.NSSM_Microsoft.Winget.Source_8wekyb3d8bbwe\nssm-2.24-101-g897c7ad\win64\nssm.exe"
$Porta = 3100

$identidade = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identidade)
$ehAdmin = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $ehAdmin) {
    Write-Host "ERRO: este script precisa rodar como Administrador." -ForegroundColor Red
    exit 1
}

$existente = Get-Service -Name $NomeServico -ErrorAction SilentlyContinue
if (-not $existente) {
    Write-Host "ERRO: o servico '$NomeServico' nao esta instalado." -ForegroundColor Red
    Write-Host "Rode install-service.ps1 primeiro." -ForegroundColor Red
    exit 1
}

Write-Host "Parando o servico..." -ForegroundColor Cyan
& $NssmExe stop $NomeServico
Start-Sleep -Seconds 2

Write-Host "Gerando novo build de producao (pode levar de 1 a 3 minutos)..." -ForegroundColor Cyan
Push-Location $PastaProjeto
try {
    & npm run build
    if ($LASTEXITCODE -ne 0) {
        throw "npm run build terminou com erro (codigo $LASTEXITCODE)"
    }
} finally {
    Pop-Location
}

Write-Host "Conferindo se o servico so escuta em 127.0.0.1 (nao na rede)..." -ForegroundColor Cyan
& $NssmExe set $NomeServico AppParameters "`"$NextBin`" start -H 127.0.0.1 -p $Porta"

Write-Host "Subindo o servico de novo..." -ForegroundColor Cyan
& $NssmExe start $NomeServico

Start-Sleep -Seconds 3
$status = Get-Service -Name $NomeServico
Write-Host ""
Write-Host "Status do servico: $($status.Status)" -ForegroundColor Green

try {
    $resp = Invoke-WebRequest -Uri "http://localhost:$Porta/" -UseBasicParsing -TimeoutSec 10
    Write-Host "Respondeu com status $($resp.StatusCode). Atualizado com sucesso." -ForegroundColor Green
} catch {
    Write-Host "Nao respondeu ainda. Confira os logs em $PastaProjeto\logs" -ForegroundColor Yellow
}
