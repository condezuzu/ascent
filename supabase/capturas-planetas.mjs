// LOS DIEZ PLANETAS DEL RANGO 4, JUNTOS EN UNA LÁMINA.
//
// POR QUÉ. El rango 4 dura diez días y cada día es un planeta distinto: es una
// mecánica que el humano construyó a propósito. Si el cuerpo pasa a dibujarse
// SIEMPRE en cara nocturna —al 5,5% de superficie— hay que saber si los diez
// se siguen distinguiendo entre sí, porque apagados podrían volverse diez
// medialunas iguales y la progresión dejaría de leerse.
//
// Eso no se contesta razonando. Se contesta poniéndolos uno al lado del otro.
//
// CÓMO ARMA LA LÁMINA, sin sumar ninguna dependencia: saca los diez recortes y
// después abre una página con una grilla de <img> y la fotografía. El navegador
// ya está abierto; pedir una biblioteca de imágenes para pegar diez PNG sería
// traer un paquete para algo que la herramienta que tenemos hace sola.
//
//   node --env-file=.env.local supabase/capturas-planetas.mjs [nivel] [etiqueta]
//
//   nivel:    el texto del botón de la galería ("0.055 (descanso)" por omisión)
//   etiqueta: sufijo del archivo, para poder guardar un ANTES y un DESPUÉS
import { chromium } from 'playwright';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { createServer } from 'node:net';
import { cerrarPuerto, limpiarPuertosDeSondas, pasarLaEntrada, limiteDeSonda, LIMITE_DE_COMPILACION_MS } from './utiles.mjs';

// Ninguna sonda corre sin limite (ver utiles.mjs).
limiteDeSonda(20);

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const SALIDA = join(RAIZ, 'capturas', 'planetas');
mkdirSync(SALIDA, { recursive: true });

const NIVEL = process.argv[2] ?? '0.055 (descanso)';
const ETIQUETA = process.argv[3] ?? 'antes';

const PLANETAS = [
  'Ceres', 'Plutón', 'Mercurio', 'Marte', 'Venus',
  'Tierra', 'Neptuno', 'Urano', 'Saturno', 'Júpiter',
];

const librePara = (p) =>
  new Promise((r) => {
    const s = createServer();
    s.once('error', () => r(false));
    s.once('listening', () => s.close(() => r(true)));
    // En 0.0.0.0 y no en 127.0.0.1: ver el comentario en las otras sondas.
    // Con 127.0.0.1 este chequeo decía "libre" sobre un puerto ocupado.
    s.listen(p, '0.0.0.0');
  });
// SE LIMPIA ANTES DE LEVANTAR NADA, siempre. Si la corrida anterior se cayo
// a la mitad, su servidor quedo vivo sirviendo un build viejo, y esta sonda
// terminaria hablandole a el sin enterarse. Ver `limpiarPuertosDeSondas`.
limpiarPuertosDeSondas();
let PUERTO = 3081;
while (!(await librePara(PUERTO))) PUERTO++;
const BASE = `http://localhost:${PUERTO}`;

const entorno = { ...process.env, NEXT_DIST_DIR: '.next-planetas' };
console.log('compilando…');
const build = spawnSync('npx', ['next', 'build'], { timeout: LIMITE_DE_COMPILACION_MS, cwd: RAIZ, shell: true, env: entorno, encoding: 'utf8' });
if (build.status !== 0) {
  console.log('NO COMPILA:\n' + (build.stdout ?? '').slice(-2500));
  process.exit(1);
}
const servidor = spawn('npx', ['next', 'start', '-p', String(PUERTO)], { cwd: RAIZ, shell: true, env: entorno, stdio: 'ignore' });
const cerrar = () => {
  // POR PID **Y** POR PUERTO. El pid es el del shell que lanza npx; el servidor
  // es un nieto y sobrevive. Matar por puerto no depende del arbol de procesos.
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(servidor.pid), '/f', '/t'], { stdio: 'ignore' });
  else servidor.kill('SIGTERM');
  cerrarPuerto(PUERTO);
};
process.on('exit', cerrar);
for (let i = 0; i < 90; i++) {
  if (await fetch(BASE + '/login', { redirect: 'manual' }).then(() => true).catch(() => false)) break;
  await new Promise((r) => setTimeout(r, 1000));
}

const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
await pasarLaEntrada(page);
await page.locator('input[type=email]').fill(process.env.CONEXION_EMAIL);
await page.locator('input[type=password]').fill(process.env.CONEXION_PASSWORD);
await page.getByRole('button', { name: 'Entrar', exact: true }).click();
await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 180000 });

await page.goto(BASE + '/galeria', { waitUntil: 'domcontentloaded' });
await page.getByRole('heading', { name: 'Rango', exact: true }).waitFor({ timeout: 60000 });

await page.getByRole('button', { name: 'Planeta', exact: false }).first().click();
await page.waitForTimeout(700);
await page.getByRole('button', { name: NIVEL, exact: true }).first().click();
await page.waitForTimeout(700);

// SOLO LA ESQUINA DONDE VIVE EL CUERPO. La lámina tiene que mostrar planetas,
// no diez copias de los mismos botones.
const RECORTE = { x: 96, y: 470, width: 294, height: 374 };

const hechos = [];
console.log(`\nnivel: ${NIVEL}\n`);
for (const nombre of PLANETAS) {
  await page.getByRole('button', { name: nombre, exact: true }).first().click();
  // El motor remonta con `key`: hay que darle tiempo a dibujar de nuevo.
  await page.waitForTimeout(2200);
  const archivo = join(SALIDA, `${ETIQUETA}-${nombre.toLowerCase().replace(/[^a-z]/g, '')}.png`);
  await page.screenshot({ path: archivo, clip: RECORTE });
  hechos.push({ nombre, archivo });
  console.log(`  ${nombre.padEnd(12)} ${archivo.slice(RAIZ.length + 1)}`);
}

// LA LAMINA LA ARMA `herramientas/lamina.mjs`, aparte.
//
// Estaba acá y salia rota: las imagenes iban como `file://` dentro de una
// pagina creada con `setContent`, que vive en `about:blank`, y Chromium no le
// deja cargar recursos de archivo desde ahi. No avisa: dibuja iconos rotos.
//
// Y separarlo tiene otra ventaja: componer no necesita build ni servidor ni
// sesion, asi que rehacer la lamina —otro orden, otro tamano— no cuesta los
// cinco minutos de compilar que cuesta sacar las fotos.
//
//   node herramientas/lamina.mjs capturas/planetas <prefijo> <salida.png>

await nav.close();
console.log('listo');
