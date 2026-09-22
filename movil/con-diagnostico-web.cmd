@echo off
REM La app ENTERA y andando, con el boton de diagnostico a la vista: es la
REM unica forma de mirar las tres fuentes de la sesion sin el telefono.
REM No confundir con diag-web.cmd, que rompe la URL de Supabase a proposito
REM para ver la caja negra con la app muerta.
cd /d "%~dp0"
set EXPO_PUBLIC_DIAGNOSTICO=1
npx expo start --web --port 8092
