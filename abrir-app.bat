@echo off
REM Levanta un servidor local en esta carpeta y abre la app en el navegador.
REM Cierra esta ventana para detener el servidor.
cd /d "%~dp0"
set PUERTO=8765
start "" "http://localhost:%PUERTO%/"
where python >nul 2>nul && (python -m http.server %PUERTO% --bind 127.0.0.1 & goto :eof)
where py >nul 2>nul && (py -m http.server %PUERTO% --bind 127.0.0.1 & goto :eof)
where npx >nul 2>nul && (npx --yes serve -l %PUERTO% . & goto :eof)
echo No se encontro Python ni Node. Instala Python desde https://www.python.org/ y vuelve a intentar.
pause
