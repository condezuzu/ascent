# El sonido del aviso de fin de descanso — de dónde salió

Anotado el 13/10/2026, por si alguna vez hace falta el dato.

## Qué es

`movil/assets/aviso-descanso.wav` (en la rama `build-8-nativo`; llega a `main`
cuando exista la build 8). Un toque solo, suave, de 0,8 segundos.

## De dónde salió

- **El archivo de origen** lo trajo el humano el 12/10/2026:
  `Soft Alarm Sound Effect – No Copyright.mp3`, de su carpeta de descargas.
  Dura 9,17 s y son cuatro toques separados por silencios.
- **Lo que se usa** es el primero de esos cuatro toques (del segundo 0,76 al
  1,56), pasado a WAV PCM de 16 bits, mono, 44,1 kHz, con 5 ms de entrada y
  40 ms de salida para que no haga clic, y subido 6,5 dB: −9,5 dBFS mientras
  suena, 4,2 dB por encima de la campana anterior (−13,7). El pico queda en
  0,97: no recorta. Hasta el 14/10 iba a la par de la campana (+2,1 dB); el
  humano pidió subir el volumen del aviso y se subió hasta casi el techo. Igual
  energía no es igual
  volumen al oído; es lo que se puede medir sin escucharlo.
- **Cómo se rehace:** `node herramientas/hacer-sonidos.mjs <recorte.wav> [dB]`.
  Sin número, lo iguala a la campana.

## La licencia: SIN VERIFICAR

**No se pudo confirmar de quién es ni con qué licencia se distribuye.**

- El archivo no trae autor ni licencia en sus etiquetas. Lo único que dicen es
  que fue convertido desde un video.
- Se buscó el título exacto (12/10/2026) y no apareció ninguna página con ese
  nombre y una licencia.
- "No Copyright" en el nombre de un archivo no es una licencia.

**El humano decidió usarlo igual y asume esa decisión** (13/10/2026).

## Si alguna vez hay que cambiarlo

Es un archivo. Se reemplaza `movil/assets/aviso-descanso.wav` por otro WAV PCM
de 16 bits de menos de 30 segundos, con el mismo nombre, y sale en la build
siguiente (el sonido de un aviso viaja en la build, no por OTA). `test:db`
comprueba el formato.
