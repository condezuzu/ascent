// Capturas de todas las pantallas, para mirar el trabajo visual desde el
// disco. Correr con: npm run capturas
//
// Existe porque el panel de preview del entorno se cuelga y dejo cinco tandas
// sin verificacion visual. Vive en `supabase/` con los otros scripts de
// verificacion, aunque no toque el schema.
import { chromium } from 'playwright';
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, readdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const SALIDA = join(RAIZ, 'capturas');
// El puerto se BUSCA, no se fija. Antes era 3021 fijo y, si estaba ocupado, el
// script se negaba a arrancar — cosa razonable, salvo que el que lo ocupaba era
// casi siempre el `next start` de una corrida ANTERIOR de este mismo script que
// no llegó a limpiarse. Tres corridas seguidas murieron así, y las dos primeras
// veces me llevó un rato entender que las capturas que estaba mirando eran las
// viejas.
const PRIMER_PUERTO = Number(process.env.CAPTURAS_PUERTO ?? 3021);

const correo = process.env.CONEXION_EMAIL;
const clave = process.env.CONEXION_PASSWORD;
if (!correo || !clave) {
  console.log('Falta CONEXION_EMAIL / CONEXION_PASSWORD en .env.local.');
  process.exit(1);
}

// Se prueban unos cuantos hasta encontrar uno libre. Lo que NO se puede hacer
// es dejar que Next elija solo: se corre a otro puerto en silencio y este
// script termina hablándole a un servidor que no arrancó él —o peor, al de la
// corrida anterior, con el código VIEJO— y las capturas salen bien y mienten.
async function buscarPuerto() {
  for (let p = PRIMER_PUERTO; p < PRIMER_PUERTO + 8; p++) {
    const ocupado = await fetch(`http://localhost:${p}`, { redirect: 'manual' })
      .then(() => true)
      .catch(() => false);
    if (!ocupado) return p;
  }
  return null;
}
const PUERTO = await buscarPuerto();
if (PUERTO === null) {
  console.log(`No hay ningun puerto libre entre ${PRIMER_PUERTO} y ${PRIMER_PUERTO + 7}.`);
  process.exit(1);
}
if (PUERTO !== PRIMER_PUERTO) {
  console.log(`  (el ${PRIMER_PUERTO} estaba ocupado; uso el ${PUERTO})`);
}
const BASE = `http://localhost:${PUERTO}`;

// BUILD DE PRODUCCION, NO `next dev`.
//
// Con dev, Next compila cada ruta la primera vez que se la pide, y esa
// compilacion pasa ADENTRO del `page.goto`, que tiene limite de tiempo. Varias
// corridas seguidas perdieron pantallas por eso: `movil/ajustes` y
// `movil/fuerza` tardaban mas de 120 segundos en compilar, y el informe decia
// "no se pudo capturar" cuando el problema no era de la app sino del modo en
// que se la estaba levantando. Compilando una sola vez al principio, todas las
// pantallas responden al instante.
//
// Y de paso se fotografia lo que la gente ve de verdad: el build de produccion
// tiene otro CSS, otro empaquetado y ninguno de los indicadores de desarrollo.
//
// Carpeta propia: el 3020 puede tener el dev server del humano corriendo, y dos
// procesos de Next sobre la misma `.next` la corrompen.
const entorno = { ...process.env, NEXT_DIST_DIR: '.next-capturas' };

console.log('  compilando (una sola vez)…');
const compilacion = spawnSync('npx', ['next', 'build'], {
  cwd: RAIZ,
  shell: true,
  stdio: ['ignore', 'pipe', 'pipe'],
  env: entorno,
  encoding: 'utf8',
});
if (compilacion.status !== 0) {
  console.log('NO COMPILA. Las capturas no dicen nada de una app que no compila:\n');
  console.log((compilacion.stdout ?? '') + (compilacion.stderr ?? ''));
  process.exit(1);
}

const dev = spawn('npx', ['next', 'start', '-p', String(PUERTO)], {
  cwd: RAIZ,
  shell: true,
  stdio: ['ignore', 'pipe', 'pipe'],
  env: entorno,
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
// `listo` es lo que tiene que estar EN PANTALLA para que la foto valga.
//
// Sin esto se esperaba un rato fijo y se disparaba. Las pantallas que piden
// datos antes de dibujar nada — /yo y /album devuelven un `<div>` vacío
// mientras cargan — salían en NEGRO, y la herramienta las contaba como
// capturadas: `movil-yo.png` era un rectángulo negro de 780x1688.
//
// Cada pantalla dice qué significa "ya cargó" para ella. Es la misma
// diferencia que en el resto del código: esperar la condición, no dormir un
// rato y confiar.
const PANTALLAS = [
  { nombre: 'inicio', ruta: '/', listo: '.tira-semanal' },
  { nombre: 'stats', ruta: '/stats', listo: '.escalera-rangos' },
  { nombre: 'fuerza', ruta: '/fuerza', listo: '.titulo-pantalla' },
  { nombre: 'ranking', ruta: '/social', listo: '#buscar' },
  { nombre: 'album', ruta: '/album', listo: '.album-grilla, .vacio-cosmico' },
  { nombre: 'yo', ruta: '/yo', listo: '.yo-cabecera' },
  { nombre: 'ajustes', ruta: '/ajustes', listo: '.seccion' },
  {
    // El calendario vive plegado, así que NUNCA salía en ninguna captura: la
    // pantalla que el humano señaló como la peor de las tres era justamente la
    // única que este script no fotografiaba.
    nombre: 'ajustes-corregir-dias',
    ruta: '/ajustes',
    // `.seccion` y NO `.calendario`. El `listo` se espera ANTES de correr el
    // `previo`, así que poner acá algo que recién existe DESPUÉS del clic son
    // sesenta segundos esperando lo imposible y la captura salteada. Lo hice y
    // perdí un rato largo buscándole la culpa a la app.
    listo: '.seccion',
    previo: async (page) => {
      const b = page.locator('button.fila-plegable', { hasText: /corregir/i }).first();
      try {
        await b.waitFor({ state: 'visible', timeout: 20000 });
      } catch {
        return 'no apareció el plegable de "Corregir días"';
      }
      await b.click();
      return null;
    },
  },
  {
    nombre: 'ajustes-como-se-compara',
    ruta: '/ajustes',
    listo: '.seccion',
    // Devuelve el problema si no pudo hacer lo suyo. Antes hacía
    // `if (count) click()` y se iba en silencio: la captura salía igual,
    // IDÉNTICA a la de `ajustes`, y se contaba como una pantalla más.
    previo: async (page) => {
      // Se ESPERA al botón en vez de contarlo y seguir: Ajustes pide el perfil
      // y hasta que llega no dibuja ninguna sección, así que "no está" y
      // "todavía no está" se veían igual. Los 3,5 s de antes eran una apuesta.
      //
      // Y por clase + texto, no por rol: el nombre accesible de un botón que
      // adentro tiene un <h3> depende de cómo lo calcule el navegador, y acá no
      // hace falta esa vuelta.
      const b = page.locator('button.fila-plegable', { hasText: /compara/i }).first();
      try {
        await b.waitFor({ state: 'visible', timeout: 20000 });
      } catch {
        const cuantos = await page.locator('button.fila-plegable').count();
        return `no apareció el botón de "Cómo se compara" (había ${cuantos} desplegables en ${page.url()})`;
      }
      await b.click();
      return null;
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
  // La app dice "algo fallo" para lo que no reconoce; aca se guarda la
  // respuesta cruda del servidor.
  const respuestasAuth = [];

  // La pagina se arma aca porque hay que poder REHACERLA: cuando una pantalla
  // se cae por timeout deja una navegacion en vuelo, y la siguiente muere con
  // "interrupted by another navigation" — y la siguiente, y la siguiente. Una
  // sola pantalla lenta se llevaba puestas cinco. Una pagina nueva no tiene
  // nada en vuelo, y las cookies —o sea la sesion— viven en el CONTEXTO.
  const armarPagina = async () => {
    const nueva = await contexto.newPage();
    // Un error de consola en una pantalla que "se ve bien" es justo lo que la
    // captura sola no muestra.
    nueva.on('console', (m) => {
      if (m.type() === 'error') problemas.push(`${tamano.nombre}: consola — ${m.text().slice(0, 160)}`);
    });
    nueva.on('pageerror', (e) =>
      problemas.push(`${tamano.nombre}: excepción — ${String(e).slice(0, 160)}`)
    );
    // Cualquier respuesta fallada, no solo las de auth: un 401 en un dato es
    // tan grave como uno en el login, y antes solo se veia el mensaje generico
    // del navegador —"Failed to load resource"— sin decir QUE recurso.
    nueva.on('response', async (r) => {
      if (r.status() >= 400 && !r.url().includes('/auth/v1/')) {
        problemas.push(
          `${tamano.nombre}: ${r.status()} en ${r.url().replace(/^https?:[/][/][^/]+/, '')}`
        );
        return;
      }
      if (!r.url().includes('/auth/v1/')) return;
      if (r.status() < 400) return;
      const cuerpo = await r.text().catch(() => '');
      respuestasAuth.push(`${r.status()} ${r.url().split('/auth/v1/')[1]} → ${cuerpo.slice(0, 300)}`);
    });
    return nueva;
  };

  let page = await armarPagina();

  // Aca SI `networkidle`, al reves que en las pantallas de abajo: hasta que
  // React no hidrata, escribir llena el DOM pero no el estado y el submit sale
  // sin correo ("missing email or phone"). Login es liviana y la red se queda
  // quieta de verdad. Comprobar el input con `inputValue()` NO sirve: lee el
  // DOM, que es la mitad que si se lleno.
  // Todo esto adentro de un try: el login del SEGUNDO tamaño se caía por su
  // cuenta y con él la herramienta entera, sin llegar a imprimir el informe de
  // lo que ya había encontrado. Un fallo al entrar es un problema para anotar,
  // no una excepción sin atrapar.
  // DOS INTENTOS. El primer tamaño entra siempre; el segundo fallaba a veces
  // con la pantalla de login perfectamente dibujada — se ve en
  // `login-fallido.png` — y el `fill` igual daba "no editable". Recargar y
  // volver a probar sale mucho más barato que perder el tamaño entero, y si
  // falla dos veces seguidas ya no es una carrera y hay que mirarlo.
  let entro = false;
  let ultimoError = null;
  for (const intento of [1, 2]) {
    try {
      await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 60000 });
      await page.locator('input[type=email]').fill(correo, { timeout: 30000 });
      await page.locator('input[type=password]').fill(clave, { timeout: 30000 });

      // `exact` porque sin él "Entrar" también matchea "Volver a entrar", que la
      // pantalla muestra en algunos estados, y ahí Playwright corta por ambiguo.
      await page.getByRole('button', { name: 'Entrar', exact: true }).click();
      // Dos minutos: la primera entrada compila la principal entera, three.js
      // incluido.
      await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 120000 });
      entro = true;
      break;
    } catch (e) {
      ultimoError = e;
      if (intento === 1) {
        console.log(`  (${tamano.nombre}: no entró a la primera, reintento)`);
        await page.waitForTimeout(1500);
      }
    }
  }

  if (!entro) {
    const e = ultimoError;
    // Deja todo para saber por que fallo. La clase es `.error-msg`: buscar
    // '.error' no encuentra nada y hace parecer que la pantalla estaba limpia.
    const enPantalla = await page
      .locator('.error-msg')
      .first()
      .textContent()
      .catch(() => null);
    const visible = await page.evaluate(() => document.body.innerText.slice(0, 600)).catch(() => '');
    // El estado REAL del campo. "No editable" con la pantalla dibujada no dice
    // nada; esto dice cuál de las tres condiciones es la que falla.
    const campo = await page
      .locator('input[type=email]')
      .evaluate((el) => {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return {
          existe: true,
          deshabilitado: el.disabled,
          soloLectura: el.readOnly,
          caja: `${Math.round(r.width)}x${Math.round(r.height)}`,
          visibility: cs.visibility,
          display: cs.display,
          pointerEvents: cs.pointerEvents,
        };
      })
      .catch(() => ({ existe: false }));
    mkdirSync(SALIDA, { recursive: true });
    const foto = join(SALIDA, 'login-fallido.png');
    await page.screenshot({ path: foto }).catch(() => {});
    console.log(
      `No se pudo entrar como ${correo} en ${tamano.nombre}. Sigue en ${page.url()}\n` +
        `  ${String(e).split('\n')[0]}\n` +
        (enPantalla ? `La app dice: "${enPantalla.trim()}"\n` : 'La app no mostró ningún error.\n') +
        `Texto en pantalla:\n${visible}\n` +
        `El campo de correo: ${JSON.stringify(campo)}
` +
        (respuestasAuth.length
          ? `Lo que respondió el servidor:\n${respuestasAuth.join('\n')}\n`
          : 'El servidor de auth no devolvió ningún error: el problema no está de ese lado.\n') +
        `Foto: ${foto}`
    );
    problemas.push(`${tamano.nombre}: NO se pudo entrar, no se capturó nada de este tamaño`);
    await contexto.close();
    continue;
  }

  for (const p of PANTALLAS) {
    // PAGINA NUEVA PARA CADA PANTALLA, no una sola para todas.
    //
    // Con una sola, tres pantallas se caian siempre —las mismas tres, en el
    // mismo orden— y no era ni lentitud ni compilacion ni el service worker:
    // se probaron las tres cosas. Era estado que quedaba en la pagina despues
    // de la captura anterior. Una pagina limpia por pantalla cuesta unos
    // milisegundos y saca la clase entera de problema.
    //
    // Las cookies viven en el CONTEXTO, asi que la sesion no se pierde.
    await page.close().catch(() => {});
    page = await armarPagina();

    // Una pantalla que falla se anota y se sigue.
    try {
      // `networkidle` NO sirve acá: el motor pide texturas y los RPC van
      // llegando, así que la red nunca se queda quieta y /fuerza se caía con la
      // pantalla ya dibujada.
      //
      // Treinta segundos y no ciento veinte: con el build ya hecho, una ruta
      // que tarda más de eso en RESPONDER es un problema de verdad, no la
      // compilación. El límite generoso estaba tapando eso.
      await page.goto(BASE + p.ruta, { waitUntil: 'domcontentloaded', timeout: 30000 });

      // ¿LLEGAMOS A DONDE PEDIMOS? `page.goto` resuelve igual de contento si el
      // middleware nos rebotó a /login, y entonces esto sacaba una foto de la
      // pantalla de entrada, la guardaba como `movil-album.png` y la contaba
      // como capturada. Cuatro pantallas de una corrida eran el mismo PNG del
      // login, byte por byte, y la herramienta decía que todo bien.
      //
      // Una herramienta de verificación que no verifica es peor que no
      // tenerla: da permiso para dejar de mirar.
      if (page.url().includes('/login') && !p.ruta.startsWith('/login')) {
        const detalle = respuestasAuth.length
          ? ` El servidor de auth dijo: ${respuestasAuth.slice(-2).join(' | ')}`
          : ' El servidor de auth no devolvió ningún error: la sesión se perdió del lado del cliente.';
        problemas.push(
          `${tamano.nombre}/${p.nombre}: REBOTADO a /login, no se capturó.${detalle}`
        );
        continue;
      }

      // Se espera a que la pantalla TENGA lo suyo, no a que pase un rato.
      if (p.listo) {
        try {
          await page.locator(p.listo).first().waitFor({ state: 'visible', timeout: 60000 });
        } catch {
          problemas.push(
            `${tamano.nombre}/${p.nombre}: se quedó cargando, nunca apareció "${p.listo}" — la foto habría salido en blanco`
          );
          continue;
        }
      }
      // Y recién ahora el rato: el motor de planetas anima, y en /yo y /album
      // los estados vacíos aparecen después de la cabecera, que es lo que
      // esperó el selector. Esto es el margen, no la espera de verdad.
      await page.waitForTimeout(2500);
      if (p.previo) {
        const falla = await p.previo(page);
        if (falla) {
          problemas.push(`${tamano.nombre}/${p.nombre}: ${falla}, la foto sería igual a la anterior`);
          continue;
        }
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
      // No hace falta recambiar acá: la vuelta siguiente arranca con una
      // página nueva de todos modos. Antes esto era `about:blank`, que dejaba
      // OTRA navegación en vuelo y era justo lo que rompía la siguiente.
    }
  }

  await contexto.close();
}

await navegador.close();
cerrar();

console.log(`\n${hechas} capturas en ${SALIDA}`);
console.log(readdirSync(SALIDA).join('  '));
// DOS FOTOS IGUALES SON UN AVISO, no una casualidad. Dos capturas distintas
// que dan el MISMO byte significan que la herramienta fotografió dos veces lo
// mismo y lo contó como dos pantallas. Encontró dos bugs de una: cuatro
// pantallas que eran todas la foto del login, y un `previo` que no abría el
// desplegable y sacaba de nuevo la misma pantalla.
//
// Es la comprobación más barata que hay y la que más engaño destapa: no sabe
// nada de la app, solo que dos cosas distintas no pueden salir iguales.
{
  const porHuella = new Map();
  for (const archivo of readdirSync(SALIDA)) {
    if (!archivo.endsWith('.png')) continue;
    const huella = createHash('sha1').update(readFileSync(join(SALIDA, archivo))).digest('hex');
    porHuella.set(huella, [...(porHuella.get(huella) ?? []), archivo]);
  }
  for (const iguales of porHuella.values()) {
    if (iguales.length > 1) {
      problemas.push(`estas capturas son el MISMO archivo: ${iguales.join(', ')}`);
    }
  }
}

if (problemas.length) {
  console.log('\nProblemas:');
  for (const p of [...new Set(problemas)]) console.log(' - ' + p);
}
process.exit(0);
