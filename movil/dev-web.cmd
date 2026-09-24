@echo off
REM La app nativa en el navegador: una herramienta para MIRAR sin el telefono,
REM no un producto (ver spec/etapa-nativa.md, "Como se verifica la app nativa").
REM
REM EL FLAG DE DIAGNOSTICO VA PRENDIDO ACA, como en las builds `dev` y
REM `telefono` de eas.json. El servidor dev ES un entorno interno: sin el flag,
REM el panel Diagnostico no se dibuja (26/9, item 14) y el barrido de dos apps
REM no puede llegar a la subida de rango, que se dispara desde ahi. La build de
REM `store` NO lo pone y no lee este archivo: en la tienda el panel no existe.
cd /d "%~dp0"
set "EXPO_PUBLIC_DIAGNOSTICO=1"
npx expo start --web --port 8090
