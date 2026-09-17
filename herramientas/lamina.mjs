// PEGA VARIOS PNG EN UNA SOLA LÁMINA, para poder comparar de un vistazo.
//
// POR QUÉ ESTÁ SEPARADO de quien saca las fotos: componer no necesita ni build
// ni servidor ni sesión. Tenerlo aparte permite rehacer la lámina —cambiar el
// orden, el tamaño, los rótulos— sin volver a esperar cinco minutos de
// compilación cada vez.
//
// LAS IMÁGENES VAN COMO `data:`, NO COMO `file://`. La primera versión usaba
// rutas de archivo y salió una grilla de iconos rotos: una página creada con
// `setContent` vive en `about:blank`, y Chromium no le deja cargar recursos
// `file://` desde ahí. El navegador no avisa: simplemente no dibuja nada.
//
//   node supabase/lamina.mjs <carpeta> <prefijo> <salida.png>
import { chromium } from 'playwright';
import { readdirSync, readFileSync } from 'node:fs';
import { join, basename } from 'node:path';

const [carpeta, prefijo, salida] = process.argv.slice(2);
if (!carpeta || !salida) {
  console.log('uso: node supabase/lamina.mjs <carpeta> <prefijo> <salida.png>');
  process.exit(1);
}

const archivos = readdirSync(carpeta)
  .filter((f) => f.endsWith('.png') && (!prefijo || f.startsWith(prefijo)) && !f.startsWith('lamina'))
  .sort();

if (archivos.length === 0) {
  console.log(`no encontré PNG con el prefijo "${prefijo}" en ${carpeta}`);
  process.exit(1);
}

const piezas = archivos.map((f) => {
  const datos = readFileSync(join(carpeta, f)).toString('base64');
  // El rótulo sale del nombre, sin el prefijo ni la extensión.
  const rotulo = basename(f, '.png').replace(prefijo ?? '', '').replace(/^[-_]+/, '');
  return { rotulo, src: `data:image/png;base64,${datos}` };
});

const columnas = Math.min(5, piezas.length);
const nav = await chromium.launch();
const page = await (await nav.newContext({ deviceScaleFactor: 1 })).newPage();
await page.setViewportSize({ width: columnas * 300 + 40, height: 900 });
await page.setContent(`
  <style>
    body { margin:0; background:#05060a; font-family: system-ui, sans-serif; }
    .g { display:grid; grid-template-columns: repeat(${columnas}, 1fr); gap:6px; padding:6px; }
    figure { margin:0; }
    img { width:100%; display:block; background:#05060a; }
    figcaption { color:#9aa3b5; font-size:13px; letter-spacing:.09em;
                 text-transform:uppercase; text-align:center; padding:7px 0 12px; }
  </style>
  <div class="g">
    ${piezas.map((p) => `<figure><img src="${p.src}"><figcaption>${p.rotulo}</figcaption></figure>`).join('')}
  </div>
`);

// SE ESPERA A QUE LAS IMÁGENES ESTÉN DECODIFICADAS, no un rato fijo. Con un
// `waitForTimeout` la lámina salía a veces con huecos, y un hueco en una lámina
// de comparación parece un objeto que no se dibujó.
await page.waitForFunction(
  () => Array.from(document.images).every((i) => i.complete && i.naturalWidth > 0),
  null,
  { timeout: 30000 }
);

await page.locator('.g').screenshot({ path: salida });
console.log(`lámina con ${piezas.length}: ${salida}`);
await nav.close();
