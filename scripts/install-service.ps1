# install-service.ps1
# Registra o Meu Bloco de Anotacoes como servico do Windows via NSSM.
# Precisa rodar num PowerShell como Administrador.
#
# ATENCAO: este arquivo usa apenas caracteres ASCII de proposito.
# Nao adicione acentos, til, cedilha ou aspas curvas aqui.

$ErrorActionPreference = "Stop"

$NomeServico = "MeuOneNote"
$PastaProjeto = "C:\DEV\meu-onenote"
$NodeExe = "C:\Program Files\nodejs\node.exe"
$NextBin = Join-Path $PastaProjeto "node_modules\next\dist\bin\next"
$NssmExe = "C:\Users\rober\AppData\Local\Microsoft\WinGet\Packages\NSSM.NSSM_Microsoft.Winget.Source_8wekyb3d8bbwe\nssm-2.24-101-g897c7ad\win64\nssm.exe"
$Porta = 3100
$PastaLogs = Join-Path $PastaProjeto "logs"

# Onde as anotacoes ficam guardadas. Vazio = usa o padrao ja embutido no
# codigo (src/lib/caminhos.ts), hoje C:\Users\rober\OneDrive\Documentos\notas.
# Preencha aqui so se quiser um lugar diferente nesta maquina.
$PastaDados = ""

# --- checa se esta rodando como administrador ---
$identidade = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identidade)
$ehAdmin = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $ehAdmin) {
    Write-Host "ERRO: este script precisa rodar como Administrador." -ForegroundColor Red
    Write-Host "Abra o PowerShell com 'Executar como administrador' e rode de novo." -ForegroundColor Red
    exit 1
}

# --- checagens basicas ---
if (-not (Test-Path $NssmExe)) {
    Write-Host "ERRO: nssm.exe nao encontrado em $NssmExe" -ForegroundColor Red
    exit 1
}
if (-not (Test-Path $NodeExe)) {
    Write-Host "ERRO: node.exe nao encontrado em $NodeExe" -ForegroundColor Red
    exit 1
}
if (-not (Test-Path (Join-Path $PastaProjeto "node_modules"))) {
    Write-Host "ERRO: node_modules nao existe em $PastaProjeto" -ForegroundColor Red
    Write-Host "Rode 'npm install' na pasta do projeto antes de instalar o servico." -ForegroundColor Red
    exit 1
}

# --- servico ja existe? ---
$existente = Get-Service -Name $NomeServico -ErrorAction SilentlyContinue
if ($existente) {
    Write-Host "O servico '$NomeServico' ja esta instalado." -ForegroundColor Yellow
    Write-Host "Use update-service.ps1 para atualizar depois de mudar o codigo," -ForegroundColor Yellow
    Write-Host "ou uninstall-service.ps1 para remover antes de reinstalar." -ForegroundColor Yellow
    exit 1
}

if (-not (Test-Path $PastaLogs)) {
    New-Item -ItemType Directory -Path $PastaLogs -Force | Out-Null
}

# --- build de producao ---
Write-Host "Gerando build de producao (pode levar de 1 a 3 minutos)..." -ForegroundColor Cyan
Push-Location $PastaProjeto
try {
    & npm run build
    if ($LASTEXITCODE -ne 0) {
        throw "npm run build terminou com erro (codigo $LASTEXITCODE)"
    }
} finally {
    Pop-Location
}

if (-not (Test-Path $NextBin)) {
    Write-Host "ERRO: nao encontrei o binario do Next em $NextBin" -ForegroundColor Red
    exit 1
}

# --- registra o servico ---
Write-Host "Registrando o servico '$NomeServico'..." -ForegroundColor Cyan
& $NssmExe install $NomeServico $NodeExe
& $NssmExe set $NomeServico AppParameters "`"$NextBin`" start -H 127.0.0.1 -p $Porta"
& $NssmExe set $NomeServico AppDirectory $PastaProjeto
& $NssmExe set $NomeServico DisplayName "Meu Bloco de Anotacoes"
& $NssmExe set $NomeServico Description "Servidor local do bloco de anotacoes pessoal (porta $Porta). Iniciado pelo NSSM."
& $NssmExe set $NomeServico Start SERVICE_AUTO_START
$VariaveisExtra = "NODE_ENV=production"
if ($PastaDados -ne "") {
    $VariaveisExtra = "$VariaveisExtra`r`nDADOS_PATH=$PastaDados"
}
& $NssmExe set $NomeServico AppEnvironmentExtra $VariaveisExtra
& $NssmExe set $NomeServico AppStdout (Join-Path $PastaLogs "stdout.log")
& $NssmExe set $NomeServico AppStderr (Join-Path $PastaLogs "stderr.log")
& $NssmExe set $NomeServico AppRotateFiles 1
& $NssmExe set $NomeServico AppRotateOnline 1
& $NssmExe set $NomeServico AppRotateBytes 10485760
& $NssmExe set $NomeServico AppRotateSeconds 0
& $NssmExe set $NomeServico AppExit Default Restart
& $NssmExe set $NomeServico AppRestartDelay 3000

Write-Host "Iniciando o servico..." -ForegroundColor Cyan
& $NssmExe start $NomeServico

Start-Sleep -Seconds 3
$status = Get-Service -Name $NomeServico
Write-Host ""
Write-Host "Status do servico: $($status.Status)" -ForegroundColor Green

Write-Host ""
Write-Host "Testando resposta em http://localhost:$Porta/ ..." -ForegroundColor Cyan
try {
    $resp = Invoke-WebRequest -Uri "http://localhost:$Porta/" -UseBasicParsing -TimeoutSec 10
    Write-Host "Respondeu com status $($resp.StatusCode). Tudo certo." -ForegroundColor Green
} catch {
    Write-Host "Nao respondeu ainda. Confira os logs em $PastaLogs" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Pronto. Abra http://localhost:$Porta/ no navegador." -ForegroundColor Green
Write-Host "O servico inicia sozinho no proximo boot do Windows." -ForegroundColor Green
if ($PastaDados -ne "") {
    Write-Host "Anotacoes em: $PastaDados" -ForegroundColor Green
} else {
    Write-Host "Anotacoes no local padrao definido em src\lib\caminhos.ts." -ForegroundColor Green
}
