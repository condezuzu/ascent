// ¿ANDA EL RECORRIDO DE LA PRIMERA VEZ EN LA APP NATIVA? (§10, 24/9)
//
// LO QUE HAY QUE COMPROBAR NO ES QUE SE DIBUJE —eso se ve en una foto— sino
// que el recorrido CAMINE: que lleve a la pantalla de la que habla, que avance
// los cinco pasos, que se pueda saltar, y sobre todo que **no vuelva** una vez
// terminado. Un recorrido que reaparece en cada arranque es peor que no tener
// ninguno.
//
// Y LAS DOS REGLAS DE §10 QUE SON FÁCILES DE ROMPER SIN NOTARLO:
//  - "Saltar" tiene que estar SIEMPRE a la vista.
//  - Si te vas a otra pantalla por tu cuenta, la tarjeta no te persigue: dice
//    el paso y ofrece llevarte.
//
// Se reinicia la guía al empezar y al terminar, así que la cuenta de prueba
// queda como estaba: lo que esto toca vive en el teléfono, no en la base.
//
//   node --env-file=.env.local herramientas/probar-recorrido-nativa.mjs [--puerto=8090]
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

/**
 * Tocar uno de los dos botones del recorrido.
 *
 * POR `testID` Y NO POR TEXTO, y costo dos intentos entenderlo: el rotulo
 * del boton de avanzar cambia solo —"Ir" / "Siguiente" / "Listo"— y "Ir" es
 * una palabra de dos letras que aparece suelta en otras pantallas, asi que
 * la busqueda por texto terminaba en un boton de Inicio que quedaba debajo
 * de la tarjeta. Playwright lo cantaba como "el padre intercepta el click".
 */
async function tocar(id) {
  const boton = page.getByTestId(id);
  if (!(await boton.isVisible().catch(() => false))) return false;
  await boton.click({ timeout: 20000 });
  return true;
}

/** El rotulo que tiene ahora el boton de avanzar. */
const rotuloDeAvanzar = () =>
  page.getByTestId('recorrido-avanzar').innerText().catch(() => '');
/** Si la tarjeta del recorrido esta a la vista. */
const hayTarjeta = () =>
  page.getByTestId('recorrido-avanzar').isVisible().catch(() => false);

/**
 * De quién es esta sesión.
 *
 * SALE DEL TOKEN DE SUPABASE y no de `ascent:guia`, que es de donde lo sacaba
 * la primera versión de esta sonda — y por eso no probaba nada: una cuenta que
 * nunca vio la guía no tiene esa clave, así que no había uid, no se escribía
 * nada, y el "no aparece el recorrido" daba verde por el motivo equivocado.
 * La guía es lo que se está probando; la sesión siempre está.
 */
const miUid = () =>
  page.evaluate(() => {
    for (const k of Object.keys(localStorage)) {
      if (!/^sb-.*-auth-token$/.test(k)) continue;
      try {
        const v = JSON.parse(localStorage.getItem(k));
        const id = v?.user?.id ?? v?.currentSession?.user?.id;
        if (id) return id;
      } catch {
        /* sigue */
      }
    }
    return null;
  });

/** Deja la guía en un estado concreto, como lo dejaría la app. */
async function guia(estado) {
  const uid = await miUid();
  if (!uid) throw new Error('no encontre la sesion en el almacenamiento');
  await page.evaluate(
    ([uid, estado]) => localStorage.setItem('ascent:guia', JSON.stringify({ uid, ...estado })),
    [uid, estado]
  );
}

/** Enciende el recorrido escribiendo lo que escribiría "ver la guía". */
async function encender() {
  await guia({ recorrido: false, paso: 0, globos: [] });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(7000);
}

try {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.locator('input[type=email], input[inputmode=email]').first().fill(process.env.CONEXION_EMAIL, { timeout: 90000 });
  await page.locator('input[type=password]').first().fill(process.env.CONEXION_PASSWORD);
  await page.getByText('Entrar', { exact: true }).last().click({ timeout: 60000 });
  await page.waitForTimeout(9000);

  // LA VENTANA DE LAS VIDAS TAPA TODO, y es legitima: la cuenta de prueba
  // tiene dias cubiertos sin anunciar, asi que  se dibuja
  // encima de la app entera. Sin cerrarla, esta sonda estaba probando que se
  // puede tocar un boton que esta debajo de un velo — o sea, nada. Cerrarla
  // solo escribe en el almacenamiento del navegador: la cuenta no se toca.
  const entendido = page.getByText('Entendido', { exact: true });
  if (await entendido.isVisible().catch(() => false)) await entendido.click();
  await page.waitForTimeout(2000);

  console.log('\n1. Con la guia vista, el recorrido NO aparece');
  // Es el estado normal de quien ya usó la app, y el que más veces se ve.
  await guia({ recorrido: true, paso: 0, globos: ['series', 'perfil'] });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(7000);
  esperar('no hay tarjeta de recorrido', !(await hayTarjeta()));

  console.log('\n2. Encendido, arranca en Ajustes y por el gimnasio');
  await encender();
  const t2 = await texto();
  esperar('aparece la tarjeta', await hayTarjeta());
  esperar('con Saltar siempre a la vista', await page.getByTestId('recorrido-saltar').isVisible().catch(() => false));
  esperar('y dice 1/5', /1\/5/.test(t2));
  // EL GIMNASIO VA PRIMERO: es lo que hace distinta a la app.
  esperar('el primer paso habla del gimnasio', /gimnasio/i.test(t2));

  console.log('\n3. "Ir" lleva a la pantalla de la que habla');
  // Arranca en Inicio, y el paso 1 es Ajustes: la tarjeta NO arrastra sola.
  esperar('ofrece llevarte en vez de arrastrarte', (await rotuloDeAvanzar()).trim() === 'Ir');
  if (await tocar('recorrido-avanzar')) {
    await page.waitForTimeout(2500);
    esperar('y ahora se ve Ajustes', /MI GIMNASIO|mi gimnasio/i.test(await texto()));
    esperar('y el boton ya dice Siguiente', (await rotuloDeAvanzar()).trim() === 'Siguiente');
  }

  console.log('\n4. Los cinco pasos, uno por uno');
  // CUATRO TOQUES LLEVAN DE 1/5 A 5/5, y el quinto termina. La primera
  // version daba cuatro toques en total y despues se sorprendia de que la
  // tarjeta siguiera ahi: estaba en el ultimo paso, sin haberlo cerrado.
  for (const n of [2, 3, 4, 5]) {
    if (!(await tocar('recorrido-avanzar'))) {
      esperar(`llega al paso ${n}`, false);
      break;
    }
    await page.waitForTimeout(2500);
    esperar(`va por ${n}/5`, new RegExp(`${n}/5`).test(await texto()));
  }

  // EN EL ULTIMO EL BOTON CAMBIA: "Listo" y no "Siguiente". Es lo unico que
  // avisa que el recorrido se termina acá en vez de seguir.
  esperar('el ultimo paso dice Listo', (await rotuloDeAvanzar()).trim() === 'Listo');
  await tocar('recorrido-avanzar');

  console.log('\n5. Terminado, no vuelve');
  await page.waitForTimeout(1500);
  esperar('la tarjeta se fue', !(await hayTarjeta()));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(7000);
  // LO QUE MAS IMPORTA: que quede anotado. Si no se guarda, el recorrido
  // reaparece en cada arranque y se vuelve una molestia diaria.
  esperar('y sigue sin volver despues de reabrir', !(await hayTarjeta()));

  console.log('\n6. Saltar corta en cualquier paso');
  await encender();
  if (await tocar('recorrido-saltar')) {
    await page.waitForTimeout(2500);
    esperar('salta y no queda nada', !(await hayTarjeta()));
  } else {
    esperar('salta y no queda nada', false);
  }

  console.log('\n7. Nada tiro al dibujar');
  const graves = errores.filter((e) => !/UnableToResolveError|POP_TO_TOP|401/.test(e));
  esperar(`sin errores nuevos (${graves.length})`, graves.length === 0);
  for (const e of graves.slice(0, 5)) console.log('     ' + e);
} finally {
  // La cuenta queda como estaba: guia vista, sin globos pendientes.
  await guia({ recorrido: true, paso: 0, globos: ['series', 'perfil'] }).catch(() => {});
  await nav.close();
}

console.log(fallas === 0 ? '\ntodo bien' : `\n${fallas} fallaron`);
process.exit(fallas === 0 ? 0 : 1);
