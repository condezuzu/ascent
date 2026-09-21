@echo off
REM METRO PARA LA BUILD DE DESARROLLO EN EL IPHONE (21/9).
REM
REM Se usa con la build del perfil `dev` (eas.json), que trae el cliente de
REM desarrollo: la app se conecta a esta computadora, muestra los errores en
REM pantalla y los escribe en esta terminal. Cambiar el JS no necesita otra
REM build: se recarga solo.
REM
REM El telefono y la computadora TIENEN que estar en la misma red. Si no
REM aparece, probar:  dev-telefono.cmd --tunnel
cd /d "%~dp0"
npx expo start --dev-client %*
