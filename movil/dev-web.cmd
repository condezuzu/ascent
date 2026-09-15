@echo off
REM La app nativa en el navegador: una herramienta para MIRAR sin el telefono,
REM no un producto (ver spec/etapa-nativa.md, "Como se verifica la app nativa").
cd /d "%~dp0"
npx expo start --web --port 8090
