@echo off
REM La app nativa en el navegador: una herramienta para MIRAR sin el telefono,
REM no un producto (ver spec/etapa-nativa.md, "Como se verifica la app nativa").
REM
REM SIN EL FLAG DE DIAGNOSTICO A PROPOSITO (26/9). Se probo prenderlo para que
REM el panel Diagnostico —ahora gateado, item 14— apareciera en la vista web y
REM el barrido pudiera llegar a la subida de rango. Salio peor: con el flag, la
REM CAJA NEGRA tambien se dibuja, se auto-abre con un error de three.js que solo
REM ocurre en la vista web (compileAsync/isReady, que el error-boundary atrapa y
REM no afecta al telefono) y TAPA la pantalla, rompiendo todo el barrido. En el
REM dispositivo el flag SI va (perfil `telefono` de eas.json); en la vista web
REM no aporta y estorba.
cd /d "%~dp0"
npx expo start --web --port 8090
