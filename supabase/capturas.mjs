// Capturas de todas las pantallas, para mirar el trabajo visual desde el
// disco. Correr con: npm run capturas
//
// POR QUÉ EXISTE: el panel de preview del entorno se cuelga —los clicks por
// píxel se traban y `read_page` da timeout—, así que cinco tandas seguidas
// quedaron sin verificación visual. Esto no depende de él: levanta la app,
// entra con la cuenta de prueba, recorre las pantallas y deja los PNG en
// `capturas/`.
//
// Va a `supabase/` porque ahí viven los otros scripts de verificación, aunque
// no toque el schema.
import { chromium } from 'playwright';
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const SALIDA = join(RAIZ, 'capturas');
const PUERTO = Number(process.env.CAPTURAS_PUERTO ?? 3021);
const BASE = `http://localhost:${PUERTO}`;

const correo = process.env.CONEXION_EMAIL;
const clave = process.env.CONEXION_PASSWORD;
if (!correo || !clave) {
  console.log('Falta CONEXION_EMAIL / CONEXION_PASSWORD en .env.local.');
  process.exit(1);
}

// Si el puerto ya está ocupado, `next dev` se corre solo a otro y este script
// termina hablándole a un servidor que no arrancó él —quedó uno colgado y pasó
// exactamente eso—. Mejor cortar y decirlo.
const libre = await fetch(BASE, { redirect: 'manual' })
  .then(() => false)
  .catch(() => true);
if (!libre) {
  console.log(
    `El puerto ${PUERTO} ya está ocupado. Cerrá lo que esté ahí, o corré con
` +
      `  CAPTURAS_PUERTO=3022 npm run capturas`
  );
  process.exit(1);
}

// Puerto propio Y carpeta propia: el 3020 puede tener el dev server del humano
// corriendo, y dos procesos de Next sobre la misma `.next` la corrompen.
const dev = spawn('npx', ['next', 'dev', '-p', String(PUERTO)], {
  cwd: RAIZ,
  shell: true,
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, NEXT_DIST_DIR: '.next-capturas' },
});
let salidaDev = '';
dev.stdout.on('data', (d) => (salidaDev += d));
dev.stderr.on('data', (d) => (salidaDev += d));

let cerrado = false;
const cerrar = () => {
  if (cerrado) return;
  cerrado = true;
  // spawnSYNC a propósito: con la versión asíncrona, el `process.exit()` de
  // abajo se llevaba el proceso antes de que taskkill llegara a correr, y el
  // dev server quedaba vivo ocupando el puerto hasta la próxima corrida.
  //
  // Y en Windows matar el proceso del shell deja al hijo vivo, así que /T, que
  // se lleva el árbol entero.
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(dev.pid), '/f', '/t'], { stdio: 'ignore' });
  } else {
    dev.kill('SIGTERM');
  }
};
process.on('exit', cerrar);
process.on('SIGINT', () => { cerrar(); process.exit(1); });

async function esperarAlServidor() {
  for (let i = 0; i < 90; i++) {
    try {
      const r = await fetch(BASE, { redirect: 'manual' });
      if (r.status > 0) return;
    } catch {
      /* todavía no levantó */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  console.log(`El dev server no levantó en 90 s.\n${salidaDev.slice(-1500)}`);
  process.exit(1);
}

/**
 * Las pantallas a capturar. `previo` corre antes de la foto para abrir lo que
 * está plegado: si no, media app se fotografía cerrada y la captura no muestra
 * justamente lo que se cambió.
 */
const PANTALLAS = [
  { nombre: 'inicio', ruta: '/' },
  { nombre: 'stats', ruta: '/stats' },
  { nombre: 'fuerza', ruta: '/fuerza' },
  { nombre: 'ranking', ruta: '/social' },
  { nombre: 'album', ruta: '/album' },
  { nombre: 'yo', ruta: '/yo' },
  { nombre: 'ajustes', ruta: '/ajustes' },
  {
    nombre: 'ajustes-como-se-compara',
    ruta: '/ajustes',
    previo: async (page) => {
      const b = page.getByRole('button', { name: /cómo se compara|como se compara/i }).first();
      if (await b.count()) await b.click();
    },
  },
];

// Los dos tamaños que importan: el teléfono es el caso real (§ mobile-first) y
// el escritorio es donde se rompen los anchos.
const TAMANOS = [
  { nombre: 'movil', viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 },
  { nombre: 'escritorio', viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 },
];

await esperarAlServidor();

rmSync(SALIDA, { recursive: true, force: true });
mkdirSync(SALIDA, { recursive: true });

const navegador = await chromium.launch();
const problemas = [];
let hechas = 0;

for (const tamano of TAMANOS) {
  const contexto = await navegador.newContext({
    viewport: tamano.viewport,
    deviceScaleFactor: tamano.deviceScaleFactor,
    locale: 'es-UY',
    timezoneId: 'America/Montevideo',
  });
  const page = await contexto.newPage();

  // Un error de consola en una pantalla que "se ve bien" es justo lo que la
  // captura sola no muestra.
  page.on('console', (m) => {
    if (m.type() === 'error') problemas.push(`${tamano.nombre}: consola — ${m.text().slice(0, 160)}`);
  });
  page.on('pageerror', (e) => problemas.push(`${tamano.nombre}: excepción — ${String(e).slice(0, 160)}`));

  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.locator('input[type=email]').fill(correo);
  await page.locator('input[type=password]').fill(clave);
  await page.getByRole('button', { name: 'Entrar' }).click();
  try {
    // Dos minutos y no treinta segundos: la primera vez que se entra, el dev
    // server tiene que compilar la principal entera —three.js incluido— y con
    // la carpeta de build recién creada eso pasa del medio minuto. Se cayó así
    // una vez, con un timeout pelado que no decía nada de esto.
    await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 120000 });
  } catch {
    // Si la app mostró un error —clave mal, rate limit de Supabase—, decirlo,
    // que es la diferencia entre arreglarlo y adivinar.
    const enPantalla = await page
      .locator('[role=alert], .error, .aviso')
      .first()
      .textContent()
      .catch(() => null);
    console.log(
      `No se pudo entrar como ${correo}.` +
        (enPantalla ? ` La app dice: "${enPantalla.trim()}"` : ' La pantalla no mostró ningún error.')
    );
    process.exit(1);
  }

  for (const p of PANTALLAS) {
    await page.goto(BASE + p.ruta, { waitUntil: 'networkidle' });
    // El motor de planetas anima y los datos llegan por RPC: sin esta espera
    // se fotografía el estado de carga y no la pantalla.
    await page.waitForTimeout(2500);
    if (p.previo) {
      await p.previo(page);
      await page.waitForTimeout(600);
    }
    const revision = await page.evaluate(() => {
      const raiz = document.documentElement;
      // Contenido que se va por la DERECHA: el scroll horizontal clásico.
      const derecha = raiz.scrollWidth - raiz.clientWidth;
      // Y por la IZQUIERDA, que NO aparece en scrollWidth: lo que queda en x
      // negativo simplemente se recorta y el documento no se entera. Así se
      // vivió un tiempo con la primera letra de cada título cortada.
      const cortados = [];
      for (const el of document.querySelectorAll('body *')) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (r.left < -0.5) {
          const t = (el.textContent ?? '').trim().slice(0, 24);
          cortados.push(`${el.tagName.toLowerCase()}${t ? ' "' + t + '"' : ''} en x=${Math.round(r.left)}`);
        }
      }
      return { derecha, cortados: [...new Set(cortados)].slice(0, 4) };
    });
    if (revision.derecha > 0) {
      problemas.push(`${tamano.nombre}/${p.nombre}: se va ${revision.derecha}px por la derecha`);
    }
    for (const c of revision.cortados) {
      problemas.push(`${tamano.nombre}/${p.nombre}: cortado por la izquierda — ${c}`);
    }

    // La nav es `fixed`, así que en una captura de página completa se dibuja
    // en el medio de la imagen y tapa lo que haya debajo —la primera vez se
    // comió el número de DOTS—. Para la foto se la pasa a `static`, que la
    // manda al lugar que le toca en el documento: el final. Con `absolute` no
    // alcanzaba, porque el `bottom: 0` se resolvía contra un ancestro del alto
    // de la ventana y volvía a caer en el medio.
    await page.addStyleTag({
      content:
        '.fijo-para-captura { position: static !important;' +
        ' top: auto !important; bottom: auto !important;' +
        ' left: auto !important; right: auto !important; }',
    });
    await page.evaluate(() => {
      const fijos = [...document.querySelectorAll('body *')].filter(
        (el) => getComputedStyle(el).position === 'fixed'
      );
      for (const el of fijos) {
        el.classList.add('fijo-para-captura');
        // Al final del body además de `static`: si no, cada uno cae donde lo
        // puso el DOM y el logo flotante quedaba justo encima del número de
        // DOTS. Así se apilan todos abajo y no tapan nada.
        document.body.appendChild(el);
      }
    });
    await page.screenshot({
      path: join(SALIDA, `${tamano.nombre}-${p.nombre}.png`),
      fullPage: true,
    });
    hechas++;
    console.log(`  ${tamano.nombre}/${p.nombre}`);
  }
  await contexto.close();
}

await navegador.close();
cerrar();

console.log(`\n${hechas} capturas en ${SALIDA}`);
console.log(readdirSync(SALIDA).join('  '));
if (problemas.length) {
  console.log('\nProblemas:');
  for (const p of [...new Set(problemas)]) console.log(' - ' + p);
}
process.exit(0);
