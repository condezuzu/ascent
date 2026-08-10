@echo off
REM Arranca el servidor de desarrollo desde la carpeta de este archivo,
REM sin rutas absolutas: funciona en cualquier máquina.
cd /d "%~dp0"
npm run dev
