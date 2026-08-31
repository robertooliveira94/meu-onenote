# desinstalar-tudo.ps1
# Remove o servico do Windows e a pasta do projeto (codigo). As anotacoes em
# dados/ moram fora do projeto por padrao (DADOS_PATH ou o local definido em
# src\lib\caminhos.ts) e por isso NAO sao apagadas automaticamente -- o
# script pergunta separadamente se voce tambem quer apaga-las.
#
# Se quiser manter tudo (ou so tirar o servico de segundo plano, sem apagar
# nada), use uninstall-service.ps1 em vez deste.
#
# Precisa rodar num PowerShell como Administrador.
#
# ATENCAO: este arquivo usa apenas caracteres ASCII de proposito.
# Nao adicione acentos, til, cedilha ou aspas curvas aqui.

$ErrorActionPreference = "Stop"

$NomeServico = "MeuOneNote"
$PastaProjeto = "C:\DEV\meu-onenote"
$NssmExe = "C:\Users\rober\AppData\Local\Microsoft\WinGet\Packages\NSSM.NSSM_Microsoft.Winget.Source_8wekyb3d8bbwe\nssm-2.24-101-g897c7ad\win64\nssm.exe"
# Mesmo padrao de src\lib\caminhos.ts -- usado so se o servico nao tiver
# DADOS_PATH proprio registrado (ou se o servico ja nao existir mais).
$PastaDadosPadrao = "C:\Users\rober\OneDrive\Documentos\notas"

# --- checa se esta rodando como administrador ---
$identidade = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identidade)
$ehAdmin = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $ehAdmin) {
    Write-Host "ERRO: este script precisa rodar como Administrador." -ForegroundColor Red
    Write-Host "Abra o PowerShell com 'Executar como administrador' e rode de novo." -ForegroundColor Red
    exit 1
}

# --- descobre onde as anotacoes estao de verdade ---
$PastaDados = $PastaDadosPadrao
$existente = Get-Service -Name $NomeServico -ErrorAction SilentlyContinue
if ($existente) {
    try {
        $variaveis = & $NssmExe get $NomeServico AppEnvironmentExtra 2>$null
        foreach ($linha in ($variaveis -split "`r`n|`n")) {
            if ($linha -like "DADOS_PATH=*") {
                $PastaDados = $linha.Substring("DADOS_PATH=".Length).Trim()
            }
        }
    } catch {
        # Sem variavel customizada registrada -- fica no padrao mesmo.
    }
}

Write-Host "======================================================" -ForegroundColor Yellow
Write-Host " DESINSTALAR O MEU BLOCO DE ANOTACOES" -ForegroundColor Yellow
Write-Host "======================================================" -ForegroundColor Yellow
Write-Host ""
Write-Host "Este passo remove:" -ForegroundColor Yellow
Write-Host "  - O servico do Windows '$NomeServico'"
Write-Host "  - A pasta do projeto (codigo): $PastaProjeto"
Write-Host ""
Write-Host "NAO remove suas anotacoes -- elas estao em:" -ForegroundColor Green
Write-Host "  $PastaDados" -ForegroundColor Green
Write-Host "(pergunto separadamente mais abaixo se voce tambem quer apaga-las)" -ForegroundColor Green
Write-Host ""

$confirmacao = Read-Host "Digite APAGAR (tudo maiusculo) para confirmar servico + codigo"
if ($confirmacao -ne "APAGAR") {
    Write-Host "Cancelado. Nada foi alterado." -ForegroundColor Green
    exit 0
}

# --- para e remove o servico, se existir ---
if ($existente) {
    Write-Host ""
    Write-Host "Parando o servico..." -ForegroundColor Cyan
    & $NssmExe stop $NomeServico
    Start-Sleep -Seconds 2

    Write-Host "Removendo o servico..." -ForegroundColor Cyan
    & $NssmExe remove $NomeServico confirm
} else {
    Write-Host "O servico '$NomeServico' ja nao estava instalado." -ForegroundColor Yellow
}

# --- apaga a pasta do projeto (codigo) ---
if (Test-Path $PastaProjeto) {
    Write-Host ""
    Write-Host "Apagando $PastaProjeto ..." -ForegroundColor Cyan
    Remove-Item -Path $PastaProjeto -Recurse -Force
    Write-Host "Pasta removida." -ForegroundColor Green
} else {
    Write-Host "A pasta $PastaProjeto ja nao existe." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Servico e codigo removidos. Node.js e NSSM continuam instalados" -ForegroundColor Green
Write-Host "(sao ferramentas gerais, nao so deste projeto) -- tire-os pelo" -ForegroundColor Green
Write-Host "Painel de Controle se quiser." -ForegroundColor Green

# --- pergunta separadamente sobre as anotacoes ---
Write-Host ""
Write-Host "======================================================" -ForegroundColor Yellow
Write-Host " SUAS ANOTACOES AINDA ESTAO EM: $PastaDados" -ForegroundColor Yellow
Write-Host "======================================================" -ForegroundColor Yellow

if (-not (Test-Path $PastaDados)) {
    Write-Host ""
    Write-Host "(essa pasta nem existe -- nada a fazer aqui)" -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "Isto e IRREVERSIVEL. Sem um backup feito antes, as anotacoes se" -ForegroundColor Yellow
Write-Host "perdem para sempre." -ForegroundColor Yellow
Write-Host ""
$confirmacaoDados = Read-Host "Digite APAGAR NOTAS (tudo maiusculo) para tambem apagar essa pasta, ou Enter para deixar como esta"
if ($confirmacaoDados -ne "APAGAR NOTAS") {
    Write-Host ""
    Write-Host "Anotacoes preservadas em $PastaDados" -ForegroundColor Green
    exit 0
}

Write-Host ""
Write-Host "Apagando $PastaDados ..." -ForegroundColor Cyan
Remove-Item -Path $PastaDados -Recurse -Force
Write-Host "Anotacoes removidas. Desinstalacao completa." -ForegroundColor Green
