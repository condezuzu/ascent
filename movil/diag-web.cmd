@echo off
REM La nativa en el navegador SIMULANDO la variable de Supabase sin reemplazar,
REM para ver la caja negra (src/cajaNegra.ts). Solo para probarla: no es la app.
cd /d "%~dp0"
set EXPO_PUBLIC_SUPABASE_URL=$EXPO_PUBLIC_SUPABASE_URL
set EXPO_PUBLIC_DIAGNOSTICO=1
npx expo start --web --port 8091
