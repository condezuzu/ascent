// DERIVA LOS ICONOS DE ANDROID A PARTIR DEL PNG DE 1024.
//
// NO CORRER. Android NO esta en el plan: el producto va a iOS y no hay cuenta
// de Google Play. Esto queda escrito porque el analisis de por que el mismo
// archivo NO sirve para los dos sistemas vale, y el dia que Android entre no
// hay que volver a pensarlo. Hasta ese dia no se corre y no entra en ningun
// flujo: los PNG de Android que ya estan en `movil/assets` no se tocan.
//
// POR QUÉ NO SE PUEDE USAR EL MISMO ARCHIVO. En iOS el ícono se usa tal cual y
// el sistema le redondea las esquinas. En Android NO: el ícono adaptativo se
// recorta con la forma que elija el lanzador —círculo, cuadrado redondeado,
// gota— y el recorte se come hasta un 25% de cada lado. Solo el 66% CENTRAL
// está garantizado.
//
// El ícono de Ascent tiene el arco orbital llegando casi al borde. Puesto de
// frente como foreground, ese arco SE CORTA en cualquier lanzador que recorte
// en círculo. Por eso acá el dibujo se mete al 62% de un lienzo transparente:
// lo que se pierde es margen vacío, no el arco.
//
// SE DIBUJA CON EL NAVEGADOR, no con una biblioteca de imágenes. Playwright ya
// está instalado y sabe componer y exportar PNG; traer `sharp` para escalar una
// imagen sería sumar una dependencia nativa —con binarios por plataforma— a un
// proyecto que hoy no tiene ninguna.
//
//   node supabase/iconos.mjs [origen.png]
import { chromium } from 'playwright';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { limiteDeSonda } from '../supabase/utiles.mjs';

// Ninguna sonda corre sin limite (ver utiles.mjs).
limiteDeSonda(20);

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const ORIGEN = process.argv[2] ?? join(RAIZ, 'movil', 'assets', 'icono.png');
const DESTINO = join(RAIZ, 'movil', 'assets');

if (!existsSync(ORIGEN)) {
  console.log(`no existe ${ORIGEN}`);
  console.log('Guardá ahí el PNG de 1024x1024 y volvé a correr esto.');
  process.exit(1);
}

const src = `data:image/png;base64,${readFileSync(ORIGEN).toString('base64')}`;

const nav = await chromium.launch();
const page = await (await nav.newContext({ deviceScaleFactor: 1 })).newPage();
await page.setViewportSize({ width: 1024, height: 1024 });

// Cada salida dice qué es y cuánto ocupa el dibujo dentro del lienzo.
const SALIDAS = [
  {
    archivo: 'android-icon-foreground.png',
    // 62%: el dibujo entero entra en la zona segura del recorte adaptativo.
    escala: 0.62,
    fondo: 'transparent',
    filtro: 'none',
  },
  {
    archivo: 'android-icon-monochrome.png',
    // El monocromo lo usa el tema dinámico de Android 13+: el sistema lo pinta
    // de un solo color, así que lo único que importa es la SILUETA. Se manda a
    // blanco puro sobre transparente.
    escala: 0.62,
    fondo: 'transparent',
    filtro: 'grayscale(1) brightness(2.2) contrast(1.6)',
  },
];

for (const s of SALIDAS) {
  await page.setContent(`
    <style>
      html,body { margin:0; width:1024px; height:1024px; background:${s.fondo}; }
      .caja { width:1024px; height:1024px; display:grid; place-items:center; }
      img { width:${Math.round(1024 * s.escala)}px; height:${Math.round(1024 * s.escala)}px;
            filter:${s.filtro}; display:block; }
    </style>
    <div class="caja"><img src="${src}"></div>
  `);
  await page.waitForFunction(
    () => Array.from(document.images).every((i) => i.complete && i.naturalWidth > 0),
    null,
    { timeout: 30000 }
  );
  const destino = join(DESTINO, s.archivo);
  await page.screenshot({ path: destino, omitBackground: s.fondo === 'transparent' });
  console.log(`  ${s.archivo.padEnd(32)} dibujo al ${Math.round(s.escala * 100)}%`);
}

// EL FONDO DEL ADAPTATIVO es un color plano, no una imagen: el ícono ya vive
// sobre negro y una imagen de fondo solo agrega un archivo que mantener.
// `app.json` ya trae `backgroundColor: #05060a`.
console.log('\nOjo: android-icon-background.png queda sin usar si el fondo es color plano.');

await nav.close();
console.log('listo');
