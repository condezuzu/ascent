// ¿POR QUÉ SE PUEDE SCROLLEAR SI NO HAY NADA MÁS ABAJO?
//
// Con el entrenamiento iniciado, Inicio deja scrollear "un poco" por debajo del
// botón "Terminar". No hay contenido ahí: es un sobrante, y un sobrante que se
// mueve bajo el dedo se siente como un error de la app.
//
// Adivinar la causa mirando el CSS es exactamente lo que no hay que hacer acá:
// hay `position: fixed`, `100dvh`, `safe-area-inset` y una franja de sesión que
// se apoya sobre la barra. Cualquiera de esos cuatro puede ser, y se parecen.
//
// Esto lo MIDE: abre Inicio, arranca una sesión, y busca qué elemento llega más
// abajo que la ventana. Reporta el sobrante en píxeles y el culpable.
//
//   node --env-file=.env.local supabase/medir-scroll.mjs
import { chromium } from 'playwright';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createServer } from 'node:net';
import { pasarLaEntrada } from './utiles.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');

const librePara = (p) =>
  new Promise((r) => {
    const s = createServer();
    s.once('error', () => r(false));
    s.once('listening', () => s.close(() => r(true)));
    s.listen(p, '127.0.0.1');
  });
let PUERTO = 3051;
while (!(await librePara(PUERTO))) PUERTO++;
const BASE = `http://localhost:${PUERTO}`;

const entorno = { ...process.env, NEXT_DIST_DIR: '.next-scroll' };
console.log('compilando…');
const build = spawnSync('npx', ['next', 'build'], { cwd: RAIZ, shell: true, env: entorno, encoding: 'utf8' });
if (build.status !== 0) {
  console.log('NO COMPILA:\n' + (build.stdout ?? '').slice(-2500));
  process.exit(1);
}
const servidor = spawn('npx', ['next', 'start', '-p', String(PUERTO)], { cwd: RAIZ, shell: true, env: entorno, stdio: 'ignore' });
const cerrar = () => {
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(servidor.pid), '/f', '/t'], { stdio: 'ignore' });
  else servidor.kill('SIGTERM');
};
process.on('exit', cerrar);
for (let i = 0; i < 90; i++) {
  if (await fetch(BASE + '/login', { redirect: 'manual' }).then(() => true).catch(() => false)) break;
  await new Promise((r) => setTimeout(r, 1000));
}

// QUIÉN SE PASA DE LA VENTANA. Se recorre todo el árbol y se anota el borde de
// abajo de cada elemento. Los `position: fixed` se saltean: están anclados a la
// ventana y no empujan el scroll, pero su borde de abajo puede engañar.
const CULPABLES = () => {
  const alto = window.innerHeight;
  const doc = document.documentElement;
  const sobra = doc.scrollHeight - alto;
  const malos = [];
  for (const el of document.querySelectorAll('body *')) {
    const est = getComputedStyle(el);
    if (est.position === 'fixed' || est.display === 'none') continue;
    const r = el.getBoundingClientRect();
    if (r.height === 0) continue;
    // El borde de abajo en coordenadas del DOCUMENTO.
    const abajo = r.bottom + window.scrollY;
    if (abajo > alto + 1) {
      malos.push({
        etiqueta: el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(' ').join('.') : ''),
        abajo: Math.round(abajo),
        alto: Math.round(r.height),
        margenAbajo: est.marginBottom,
        padAbajo: est.paddingBottom,
        minAlto: est.minHeight,
      });
    }
  }
  // El que más abajo llega y que no tiene ningún hijo tan abajo: ese es el que
  // de verdad empuja; los de arriba solo lo contienen.
  malos.sort((a, b) => b.abajo - a.abajo);
  // LO QUE ESTÁ ANCLADO ABAJO. El hueco que `.pantalla` reserva con su
  // `padding-bottom` existe para que el contenido no quede tapado por esto.
  // Si el hueco es MÁS grande que lo anclado, sobra pantalla y se puede
  // scrollear sin que haya nada para ver — que es justo lo que se reportó.
  const anclado = [];
  for (const el of document.querySelectorAll('body *')) {
    const est = getComputedStyle(el);
    if (est.position !== 'fixed' || est.display === 'none') continue;
    const r = el.getBoundingClientRect();
    // Lo que vive en la franja de abajo. NO alcanza con pedir que toque el
    // borde inferior: la accion anclada ("Terminar") se apoya ENCIMA de la
    // barra de navegacion, asi que su borde de abajo queda a unos 60 px del
    // fondo y con ese filtro quedaba afuera. La primera version de esta
    // medicion dijo "hace falta reservar 62 px" contando solo la barra, que es
    // justo el numero que llevaria a tapar el boton.
    //
    // Se descarta lo que ocupa media pantalla o mas: eso es el fondo o un
    // dialogo, no algo anclado.
    if (r.height === 0 || r.height > alto * 0.5 || r.bottom < alto * 0.6) continue;
    anclado.push({
      etiqueta: el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(' ').join('.') : ''),
      alto: Math.round(r.height),
      arriba: Math.round(r.top),
    });
  }
  anclado.sort((a, b) => a.arriba - b.arriba);
  // Lo que de verdad hay que reservar: desde el borde de arriba del más alto
  // hasta el fondo de la ventana.
  const reservaNecesaria = anclado.length ? Math.round(alto - anclado[0].arriba) : 0;

  const pantalla = document.querySelector('.pantalla');
  const reservaActual = pantalla ? parseFloat(getComputedStyle(pantalla).paddingBottom) : 0;

  return {
    ventana: alto,
    documento: doc.scrollHeight,
    sobra,
    body: Math.round(document.body.getBoundingClientRect().height),
    primeros: malos.slice(0, 8),
    anclado,
    reservaNecesaria,
    reservaActual: Math.round(reservaActual),
  };
};

const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
await pasarLaEntrada(page);
await page.locator('input[type=email]').fill(process.env.CONEXION_EMAIL);
await page.locator('input[type=password]').fill(process.env.CONEXION_PASSWORD);
await page.getByRole('button', { name: 'Entrar', exact: true }).click();
await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 180000 });

// SE ESPERA EL DATO, NO UN RATO. Con `waitForTimeout(4000)` la sonda medía el
// ARMAZÓN —"RACHA ·", el esqueleto— y reportaba "sobra 0 px" como si fuera una
// respuesta. Un numero medido sobre la pantalla equivocada es peor que no
// tener numero: parece que contestó.
//
// `ascent:pantalla-lista` es la marca que pone Inicio cuando ya dibujó de
// verdad. Si no llega, se dice y se corta: quedarse en el armazón despues de
// entrar seria un bug mucho mas grave que el que vinimos a medir.
const dibujo = await page
  .waitForFunction(
    () => performance.getEntriesByName('ascent:pantalla-lista').length > 0,
    null,
    { timeout: 60000 }
  )
  .then(() => true)
  .catch(() => false);

if (!dibujo) {
  console.log('\n  LA PANTALLA NO TERMINO DE CARGAR en 60 s despues de entrar.');
  console.log(`  url: ${page.url()}`);
  console.log(`  se ve: ${(await page.locator('body').innerText()).replace(/\s+/g, ' ').trim().slice(0, 300)}`);
  console.log('  Eso NO es el bug del scroll: es algo peor y hay que mirarlo aparte.');
  await nav.close();
  process.exit(1);
}
await page.waitForTimeout(1200);

const medir = async (etiqueta) => {
  const d = await page.evaluate(CULPABLES);
  console.log(`\n──────── ${etiqueta} ────────`);
  console.log(`  ventana ${d.ventana}  ·  documento ${d.documento}  ·  SOBRA ${d.sobra} px`);
  console.log(`  anclado abajo: ${d.anclado.map((a) => `${a.etiqueta} (${a.alto}px)`).join(' + ') || '(nada)'}`);
  console.log(`  hueco reservado ${d.reservaActual} px  ·  hueco necesario ${d.reservaNecesaria} px` +
    `  ·  ${d.reservaActual - d.reservaNecesaria > 0 ? 'SOBRAN ' + (d.reservaActual - d.reservaNecesaria) : 'faltan ' + (d.reservaNecesaria - d.reservaActual)} px`);
  if (d.sobra <= 0) {
    console.log('  no se puede scrollear: bien');
    return d;
  }
  console.log('  los que pasan el borde de abajo:');
  for (const m of d.primeros) {
    console.log(
      `    ${String(m.abajo).padStart(5)} px  ${m.etiqueta.slice(0, 52).padEnd(52)}` +
        ` alto ${m.alto}  min-height ${m.minAlto}  pad-abajo ${m.padAbajo}  margen-abajo ${m.margenAbajo}`
    );
  }
  return d;
};

await medir('SIN sesión');

// QUÉ ESTADO ESTAMOS MIRANDO. Sin esto, "sobra 0 px" no dice nada: puede
// significar que no hay sobrante con la sesión abierta, o que la sesión nunca
// se abrió. La primera versión de esta sonda midió dos veces el mismo estado y
// no lo dijo, así que el número parecía una respuesta y no lo era.
const estado = async () => {
  const textos = (await page.locator('button').allInnerTexts()).map((t) => t.trim()).filter(Boolean);
  const hay = (t) => textos.some((x) => x.toLowerCase().includes(t));
  // El boton dice "Iniciar entrenamiento", no "Empezar": buscar por /Empezar/i
  // no matcheaba nada y la sonda daba por sentado que ya habia sesion abierta.
  return { corriendo: hay('terminar'), puedeEmpezar: hay('iniciar'), botones: textos };
};

// DÓNDE ESTAMOS PARADOS. "No hay botones" puede ser muchas cosas —el login no
// entró, rebotó a /onboarding, la pantalla quedó en el armazón— y sin esto las
// tres se ven igual desde acá.
console.log(`\n  url: ${page.url()}`);
const texto = (await page.locator('body').innerText()).replace(/\s+/g, ' ').trim();
console.log(`  se ve: ${texto.slice(0, 220) || '(nada)'}`);

// PRIMERO SE CIERRA LO QUE ESTÉ ABIERTO. La cuenta de prueba tenía el cartel
// de la racha salvada esperando, y su lienzo —`.salvada`, a pantalla completa—
// se come todos los clics. Playwright lo dijo con todas las letras ("subtree
// intercepts pointer events") recién en el cuarto intento; antes de eso el
// fallo se veía como "no encontré el botón", que es otra cosa.
for (const etiqueta of ['Entendido', 'Guardarla para después', 'Cerrar']) {
  const b = page.getByRole('button', { name: etiqueta, exact: true }).first();
  if (await b.count().catch(() => 0)) {
    await b.click({ timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(1200);
  }
}
// Y si quedó alguno, se avisa en vez de pelear con él en silencio.
const dialogos = await page.locator('[role="dialog"]').count();
if (dialogos > 0) console.log(`  (siguen abiertos ${dialogos} dialogos: pueden tapar los toques)`);

let e = await estado();
console.log(`  botones a la vista: ${e.botones.join(' | ') || '(ninguno)'}`);

if (e.puedeEmpezar && !e.corriendo) {
  console.log('  -> no hay sesion: se arranca una');
  await page.getByRole('button', { name: /Iniciar entrenamiento/i }).first().click();
  await page.waitForTimeout(4500);
  e = await estado();
  console.log(`  botones despues de arrancar: ${e.botones.join(' | ') || '(ninguno)'}`);
}

if (e.corriendo) {
  console.log('  -> LA SESION ESTA CORRIENDO: este es el caso que se reporto');
  await medir('CON la sesión iniciada');
} else {
  console.log('  -> NO se pudo dejar una sesion corriendo: lo de abajo NO responde la pregunta');
  await medir('sin sesión (NO concluyente)');
}

// SE CIERRA LA SESIÓN POR LA API, no por la interfaz.
//
// La primera versión tocaba el botón "Terminar" y daba por hecho que alcanzaba.
// No alcanzaba: el toque puede caer en un cartel abierto, puede pedir
// confirmación, o puede fallar en silencio con el `.catch(() => {})`. Después de
// nueve corridas la cuenta de prueba tenía una sesión abierta de hacía horas,
// y eso ensucia la medición siguiente (la pantalla arranca en otro estado) y
// cualquier prueba que use esa cuenta.
//
// Limpiar por la puerta de atrás no prueba nada de la interfaz, y justamente
// por eso sirve: que la limpieza dependa de que un toque funcione es cómo se
// acumula la basura.
await page.request
  .post(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/terminar_sesion`, {
    headers: {
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${await page.evaluate(() => {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.includes('auth-token')) {
            try {
              return JSON.parse(localStorage.getItem(k)).access_token;
            } catch {}
          }
        }
        return '';
      })}`,
      'Content-Type': 'application/json',
    },
    data: {},
  })
  .then((r) => console.log(`\n  sesion de prueba cerrada: ${r.ok() ? 'ok' : r.status()}`))
  .catch((e) => console.log(`\n  NO se pudo cerrar la sesion de prueba: ${e.message}`));

await nav.close();
