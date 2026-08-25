// Capturas de todas las pantallas, para mirar el trabajo visual desde el
// disco. Correr con: npm run capturas
//
// Existe porque el panel de preview del entorno se cuelga y dejo cinco tandas
// sin verificacion visual. Vive en `supabase/` con los otros scripts de
// verificacion, aunque no toque el schema.
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

// Si el puerto esta ocupado, `next dev` se corre solo a otro y este script le
// termina hablando a un servidor que no arranco el. Mejor cortar.
const libre = await fetch(BASE, { redirect: 'manual' })
  .then(() => false)
  .catch(() => true);
if (!libre) {
  console.log(
    `El puerto ${PUERTO} ya está ocupado. Cerrá lo que esté ahí, o corré con\n` +
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
  // spawnSYNC: con la version asincrona el `process.exit()` se lleva el proceso
  // antes de que taskkill corra, y el server queda vivo ocupando el puerto. /T
  // porque en Windows matar el shell deja al hijo.
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

  // La app dice "algo fallo" para lo que no reconoce; aca se guarda la
  // respuesta cruda del servidor.
  const respuestasAuth = [];
  page.on('response', async (r) => {
    if (!r.url().includes('/auth/v1/')) return;
    if (r.status() < 400) return;
    const cuerpo = await r.text().catch(() => '');
    respuestasAuth.push(`${r.status()} ${r.url().split('/auth/v1/')[1]} → ${cuerpo.slice(0, 300)}`);
  });

  // Aca SI `networkidle`, al reves que en las pantallas de abajo: hasta que
  // React no hidrata, escribir llena el DOM pero no el estado y el submit sale
  // sin correo ("missing email or phone"). Login es liviana y la red se queda
  // quieta de verdad. Comprobar el input con `inputValue()` NO sirve: lee el
  // DOM, que es la mitad que si se lleno.
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.locator('input[type=email]').fill(correo);
  await page.locator('input[type=password]').fill(clave);

  // `exact` porque sin él "Entrar" también matchea "Volver a entrar", que la
  // pantalla muestra en algunos estados, y ahí Playwright corta por ambiguo.
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  try {
    // Dos minutos: la primera entrada compila la principal entera, three.js
    // incluido.
    await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 120000 });
  } catch {
    // Deja todo para saber por que fallo. La clase es `.error-msg`: buscar
    // '.error' no encuentra nada y hace parecer que la pantalla estaba limpia.
    const enPantalla = await page
      .locator('.error-msg')
      .first()
      .textContent()
      .catch(() => null);
    const visible = await page.evaluate(() => document.body.innerText.slice(0, 600)).catch(() => '');
    mkdirSync(SALIDA, { recursive: true });
    const foto = join(SALIDA, 'login-fallido.png');
    await page.screenshot({ path: foto }).catch(() => {});
    console.log(
      `No se pudo entrar como ${correo}. Sigue en ${page.url()}\n` +
        (enPantalla ? `La app dice: "${enPantalla.trim()}"\n` : 'La app no mostró ningún error.\n') +
        `Texto en pantalla:\n${visible}\n` +
        (respuestasAuth.length
          ? `Lo que respondió el servidor:\n${respuestasAuth.join('\n')}\n`
          : 'El servidor de auth no devolvió ningún error: el problema no está de ese lado.\n') +
        `Foto: ${foto}`
    );
    process.exit(1);
  }

  for (const p of PANTALLAS) {
    // Una pantalla que falla se anota y se sigue.
    try {
      // `networkidle` NO sirve acá: el motor pide texturas y los RPC van
      // llegando, así que la red nunca se queda quieta y /fuerza se caía con la
      // pantalla ya dibujada. Timeout largo por la primera compilación.
      await page.goto(BASE + p.ruta, { waitUntil: 'domcontentloaded', timeout: 120000 });
      // El motor de planetas anima y los datos llegan por RPC: sin esta espera
      // se fotografía el estado de carga y no la pantalla.
      await page.waitForTimeout(3500);
      if (p.previo) {
        await p.previo(page);
        await page.waitForTimeout(600);
      }
      const revision = await page.evaluate(() => {
        const raiz = document.documentElement;
        // Contenido que se va por la DERECHA: el scroll horizontal clásico.
        const derecha = raiz.scrollWidth - raiz.clientWidth;
        // Y por la IZQUIERDA, que NO aparece en scrollWidth: lo que queda en x
        // negativo se recorta y el documento no se entera. Así vivió "TATS".
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

      // Los `fixed` se estampan sobre el contenido en una captura de página
      // completa. Se los ESCONDE, que es lo único que no puede mover nada:
      // están fuera del flujo. `static` y moverlos al final del body se
      // probaron y salieron peor (spec/trampas.md).
      const fijos = await page.evaluate(() => {
        const fijos = [...document.querySelectorAll('body *')].filter(
          (el) => getComputedStyle(el).position === 'fixed'
        );
        for (const el of fijos) el.setAttribute('data-oculto-para-captura', '');
        return fijos.length;
      });
      // `nextjs-portal` es el indicador de desarrollo de Next: un botón fijo
      // abajo a la izquierda que en la foto larga cae en el medio y tapa lo que
      // haya —se comía el número de DOTS—. Va aparte porque vive en un shadow
      // DOM y el barrido de `fixed` de arriba no lo alcanza.
      await page.addStyleTag({
        content:
          '[data-oculto-para-captura] { visibility: hidden !important; }' +
          ' nextjs-portal { display: none !important; }',
      });
      // Un minuto y sin animaciones: en movil la imagen va al doble de escala
      // y varios miles de pixeles de alto. Con los 30 s de fabrica se cayo.
      await page.screenshot({
        path: join(SALIDA, `${tamano.nombre}-${p.nombre}.png`),
        fullPage: true,
        animations: 'disabled',
        timeout: 60000,
      });

      // Una foto del tamano de la ventana con todo puesto, para ver la nav
      // donde va. Solo de la principal: es igual en todas.
      if (p.nombre === 'inicio') {
        await page.evaluate(() => {
          for (const el of document.querySelectorAll('[data-oculto-para-captura]')) {
            el.removeAttribute('data-oculto-para-captura');
          }
        });
        await page.screenshot({
          path: join(SALIDA, `${tamano.nombre}-inicio-ventana.png`),
          animations: 'disabled',
          timeout: 60000,
        });
      }
      void fijos;
      hechas++;
      console.log(`  ${tamano.nombre}/${p.nombre}`);
    } catch (e) {
      const linea = String(e).split('\n')[0].slice(0, 120);
      problemas.push(`${tamano.nombre}/${p.nombre}: NO se pudo capturar — ${linea}`);
      // En blanco antes de seguir: una navegacion a medias hace que la
      // siguiente muera con "interrupted by another navigation", en cascada.
      await page.goto('about:blank', { timeout: 30000 }).catch(() => {});
    }
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
