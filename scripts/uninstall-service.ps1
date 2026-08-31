# uninstall-service.ps1
# Para e remove o servico do Windows. Nada em disco e apagado -- nem o
# projeto, nem as anotacoes (que hoje moram fora da pasta do projeto, em
# DADOS_PATH ou no padrao de src\lib\caminhos.ts) -- so o registro do
# servico no Windows.
# Precisa rodar num PowerShell como Administrador.
#
# ATENCAO: este arquivo usa apenas caracteres ASCII de proposito.

$ErrorActionPreference = "Stop"

$NomeServico = "MeuOneNote"
$NssmExe = "C:\Users\rober\AppData\Local\Microsoft\WinGet\Packages\NSSM.NSSM_Microsoft.Winget.Source_8wekyb3d8bbwe\nssm-2.24-101-g897c7ad\win64\nssm.exe"

$identidade = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identidade)
$ehAdmin = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $ehAdmin) {
    Write-Host "ERRO: este script precisa rodar como Administrador." -ForegroundColor Red
    exit 1
}

$existente = Get-Service -Name $NomeServico -ErrorAction SilentlyContinue
if (-not $existente) {
    Write-Host "O servico '$NomeServico' nao esta instalado. Nada a fazer." -ForegroundColor Yellow
    exit 0
}

Write-Host "Parando o servico..." -ForegroundColor Cyan
& $NssmExe stop $NomeServico
Start-Sleep -Seconds 2

Write-Host "Removendo o servico..." -ForegroundColor Cyan
& $NssmExe remove $NomeServico confirm

Write-Host ""
Write-Host "Servico removido. O projeto em C:\DEV\meu-onenote e suas anotacoes" -ForegroundColor Green
Write-Host "continuam intactos, onde quer que DADOS_PATH aponte para eles." -ForegroundColor Green
