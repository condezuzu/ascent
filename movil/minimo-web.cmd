@echo off
REM La pantalla minima en el navegador, para mirarla sin el telefono.
cd /d "%~dp0"
set EXPO_PUBLIC_MINIMO=1
npx expo start --web --port 8092
