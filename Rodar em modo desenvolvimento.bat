@echo off
rem Este arquivo e so para EDITAR O CODIGO (recarrega a cada mudanca, mais
rem lento). Para o uso do dia a dia, o servico do Windows ja fica sempre
rem ligado em http://localhost:3100 -- use o atalho na Area de Trabalho.
rem
rem Aqui roda numa porta diferente (3101) para nao brigar com o servico.

cd /d "%~dp0"

echo Modo desenvolvimento (porta 3101) - isto NAO e o uso do dia a dia.
echo Deixe esta janela aberta enquanto estiver editando o codigo.
echo.

start "" /b cmd /c "timeout /t 4 /nobreak >nul & start "" http://localhost:3101"

call npm run dev -- -p 3101

echo.
echo O servidor de desenvolvimento foi encerrado.
pause
