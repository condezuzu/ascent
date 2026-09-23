// ¿ARRANCA LA APP CON LO NATIVO NUEVO, Y SE VEN LAS DOS SECCIONES? (24/9)
//
// LO QUE ESTA SONDA PUEDE Y LO QUE NO, que hay que tener claro antes de creerle:
//
//  - **NO puede probar el geofencing.** Que el teléfono despierte a la app al
//    llegar al gimnasio no existe en un navegador: no hay zona, no hay
//    despertar y no hay app cerrada. Eso se prueba caminando hasta un gimnasio
//    con el teléfono, y por eso todo lo que pasa ahí queda anotado en la
//    bitácora (`Ajustes → diagnóstico`) en vez de en una consola.
//  - **NO puede probar Apple Health.** HealthKit no existe fuera de un iPhone;
//    acá la librería contesta "no disponible", que es justo el camino que
//    también recorre la web.
//
// LO QUE SÍ PRUEBA, y es lo que se rompe de verdad al meter dos módulos
// nativos nuevos: **que la app siga arrancando**. Un paquete que no resuelve,
// un import que tira al evaluarse o una pantalla que revienta al dibujarse
// dejan la app en negro, y eso sí se ve desde acá. Es la diferencia entre
// descubrirlo ahora y descubrirlo después de instalar la build.
//
// Además comprueba que las dos secciones de Ajustes se dibujen y digan lo que
// tienen que decir — incluido que la de salud sepa contestar "en este aparato
// no hay", que es el estado honesto en cualquier cosa que no sea un iPhone.
//
// No escribe nada en la cuenta: solo mira.
//
//   node --env-file=.env.local herramientas/probar-gimnasio-salud-nativa.mjs [--puerto=8090]
//
// Necesita la nativa prendida.
import { chromium } from 'playwright';
import { limiteDeSonda } from '../supabase/utiles.mjs';

limiteDeSonda(10);

const PUERTO = (process.argv.find((a) => a.startsWith('--puerto=')) ?? '--puerto=8090').split('=')[1];
const BASE = `http://localhost:${PUERTO}`;

if (!(await fetch(BASE).then(() => true).catch(() => false))) {
  console.log(`la nativa no esta prendida en :${PUERTO}`);
  process.exit(1);
}

const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
const errores = [];
page.on('console', (m) => m.type() === 'error' && errores.push(m.text().slice(0, 200)));
page.on('pageerror', (e) => errores.push('pageerror: ' + String(e.message).slice(0, 200)));

let fallas = 0;
const esperar = (que, cumple) => {
  console.log(`  ${cumple ? 'ok   ' : 'FALLA'} ${que}`);
  if (!cumple) fallas++;
};

const texto = () => page.evaluate(() => document.body.innerText.replace(/\n+/g, ' | '));

try {
  console.log('\n1. La app arranca con los modulos nativos nuevos adentro');
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.locator('input[type=email], input[inputmode=email]').first().fill(process.env.CONEXION_EMAIL, { timeout: 90000 });
  await page.locator('input[type=password]').first().fill(process.env.CONEXION_PASSWORD);
  await page.getByText('Entrar', { exact: true }).last().click({ timeout: 60000 });
  await page.waitForTimeout(9000);
  const entendido = page.getByText('Entendido', { exact: true });
  if (await entendido.isVisible().catch(() => false)) await entendido.click();
  await page.waitForTimeout(2000);

  const inicio = await texto();
  // LA PANTALLA NEGRA ES EL MODO DE FALLA de agregar módulos nativos: el
  // bundle no resuelve o algo tira al evaluarse, y no se ve NADA. Que haya
  // barra de pestañas es la prueba de que el árbol entero se dibujó.
  esperar('se entro y estan las pestañas', inicio.includes('Ranking') && inicio.includes('Ajustes'));

  console.log('\n2. Ajustes dibuja las dos secciones');
  await page.getByText('Ajustes', { exact: true }).last().click();
  await page.waitForTimeout(3500);
  const ajustes = await texto();

  esperar('esta la seccion del gimnasio', ajustes.includes('MI GIMNASIO') || /mi gimnasio/i.test(ajustes));
  // EL TEXTO VIEJO PROMETÍA LO QUE NO HACÍA ("con la app cerrada, pronto").
  // Mientras fue cierto estaba bien; después de esta tanda sería mentir al
  // revés, y el que lee Ajustes decide si marca el punto.
  esperar('ya no dice que falta para despues', !/pronto/i.test(ajustes));
  // PERO TAMPOCO PROMETE DE MÁS: sin el permiso de "siempre" esto vuelve a ser
  // lo de la web, y callarlo haría que "no me entró el día" pareciera un bug.
  esperar('y avisa del permiso que hace falta', /permiso de ubicaci[oó]n siempre/i.test(ajustes));

  esperar('esta la seccion de salud', /salud del tel[eé]fono/i.test(ajustes));
  // EN UN NAVEGADOR HEALTHKIT NO EXISTE, y la sección tiene que decirlo en vez
  // de ofrecer un botón que no puede cumplir. Es el mismo estado que un iPad.
  esperar('y dice que este aparato no tiene salud', /no tiene salud/i.test(ajustes));

  console.log('\n3. Nada tiro al dibujar');
  // Se filtra el de `Minimo`, que es viejo y de la pantalla de arranque
  // mínimo: `require('../app/_layout')` no resuelve en web y no toca a la app.
  const graves = errores.filter((e) => !/UnableToResolveError|POP_TO_TOP|401/.test(e));
  esperar(`sin errores nuevos en la consola (${graves.length})`, graves.length === 0);
  for (const e of graves.slice(0, 5)) console.log('     ' + e);
} finally {
  await nav.close();
}

console.log(fallas === 0 ? '\ntodo bien' : `\n${fallas} fallaron`);
process.exit(fallas === 0 ? 0 : 1);
