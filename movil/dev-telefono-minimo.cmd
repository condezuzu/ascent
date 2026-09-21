@echo off
REM LO MISMO, PERO CON LA PANTALLA MINIMA (src/Minimo.tsx): React Native y nada
REM mas, con botones para cargar las piezas de a una. Sirve para descartar cual
REM rompe la app sin volver a compilar.
cd /d "%~dp0"
set EXPO_PUBLIC_MINIMO=1
npx expo start --dev-client -c %*
