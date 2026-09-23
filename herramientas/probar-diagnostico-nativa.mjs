// ¿SE PUEDE LEER LA BITÁCORA DEL GIMNASIO DESDE EL TELÉFONO? (23/9)
//
// POR QUÉ ESTA SONDA IMPORTA MÁS DE LO QUE PARECE. El registro por ubicación
// solo se puede probar caminando hasta un gimnasio, y ahí no hay consola: todo
// lo que ve el vigilante queda anotado para leerlo después. Si esta pantalla
// no está, la función central de la app se prueba A CIEGAS — se va al
// gimnasio, no entra el día, y no hay forma de saber si fue el radio, la
// precisión, el permiso o la red.
//
// Es exactamente lo que pasaba hasta hoy: la web tenía el diagnóstico desde
// siempre y la app —la única de las dos donde el automático es de verdad— no.
//
// No escribe en la cuenta: lo único que toca es la bitácora del propio
// teléfono, que es de este navegador y se va con él.
//
//   node --env-file=.env.local herramientas/probar-diagnostico-nativa.mjs [--puerto=8090]
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
const esperar = (que, cumple, extra = '') => {
  console.log(`  ${cumple ? 'ok   ' : 'FALLA'} ${que}${extra ? ' — ' + extra : ''}`);
  if (!cumple) fallas++;
};
const texto = () => page.evaluate(() => document.body.innerText.replace(/\n+/g, ' | '));

async function tocar(rotulo, exacto = true) {
  const boton = page
    .getByText(rotulo, { exact: exacto })
    .last()
    .locator('xpath=ancestor-or-self::*[@tabindex][1]');
  if (!(await boton.isVisible().catch(() => false))) return false;
  await boton.click({ timeout: 20000 });
  return true;
}

try {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.locator('input[type=email], input[inputmode=email]').first().fill(process.env.CONEXION_EMAIL, { timeout: 90000 });
  await page.locator('input[type=password]').first().fill(process.env.CONEXION_PASSWORD);
  await page.getByText('Entrar', { exact: true }).last().click({ timeout: 60000 });
  await page.waitForTimeout(9000);
  const entendido = page.getByText('Entendido', { exact: true });
  if (await entendido.isVisible().catch(() => false)) await entendido.click();
  await page.waitForTimeout(2500);

  // Se deja algo anotado para tener qué leer. Es la misma clave que usa el
  // vigilante, y vive en el navegador de la sonda: no toca la cuenta.
  await page.evaluate(() => {
    const ahora = Date.now();
    localStorage.setItem(
      'ascent:bitacora',
      JSON.stringify([
        { t: ahora - 60000, que: 'miré', datos: { adentro: false, metros: 812, precision: 14, radio: 100 } },
        { t: ahora - 30000, que: 'vigilante: mirando', datos: {} },
      ])
    );
  });

  console.log('\n1. La seccion existe en Ajustes');
  await tocar('Ajustes');
  await page.waitForTimeout(3500);
  const enAjustes = await texto();
  esperar('esta el diagnostico', /DIAGN[OÓ]STICO/i.test(enAjustes));

  console.log('\n2. Va plegado, y se abre');
  // PLEGADO: no es una pantalla de la app, es un banco de trabajo. Si
  // estuviera abierto de entrada, Ajustes empezaria con una pared de datos.
  esperar('arranca cerrado', !/Mirar ahora/i.test(enAjustes));
  esperar('se puede abrir', await tocar('Diagnóstico', false));
  await page.waitForTimeout(2500);
  const abierto = await texto();

  console.log('\n3. Dice lo que hay que saber en la puerta del gimnasio');
  for (const [que, re] of [
    ['el punto y su radio', /Punto/i],
    ['si el dia ya entro', /D[ií]a/i],
    ['la sesion', /Sesi[oó]n/i],
    // El rotulo NO dice "Cola" sino lo que significa: lo que todavia no se
    // pudo mandar a la base. Es la diferencia entre un dato tecnico y uno
    // que contesta "¿perdi algo?".
    ['lo que quedo sin mandar', /Sin mandar/i],
    ['la visita en curso', /Visita/i],
    ['y si la zona quedo en el sistema', /Zona/i],
  ]) {
    esperar(que, re.test(abierto));
  }

  console.log('\n4. Se lee lo anotado');
  // SIN ESTO NO SIRVE DE NADA: es la razon entera de que la pantalla exista.
  // SE LEE DEL CAMPO Y NO DE `innerText`. React Native Web dibuja el cuadro
  // como un <textarea>, y el texto de un campo de formulario NO esta en
  // `innerText`: la primera version de esta sonda buscaba ahi y daba por
  // vacia una bitacora que se veia perfecto en pantalla.
  const anotado = await page.evaluate(() => {
    const campos = [...document.querySelectorAll('textarea, input')];
    return campos.map((c) => c.value ?? '').join('\n');
  });
  esperar('aparece lo que quedo anotado', /812/.test(anotado), 'los metros de la linea de prueba');
  esperar('y se puede compartir', /Compartir/i.test(abierto));

  console.log('\n5. Los dos botones del gimnasio');
  esperar('esta "Mirar ahora"', /Mirar ahora/i.test(abierto));
  // EL QUE NO EXISTE EN LA WEB: sin el permiso de "siempre" el geofence no se
  // arma, la app anda igual, y el dia no entra con la app cerrada.
  esperar('esta "Revisar la zona"', /Revisar la zona/i.test(abierto));

  console.log('\n6. Nada tiro al dibujar');
  const graves = errores.filter((e) => !/UnableToResolveError|POP_TO_TOP|401/.test(e));
  esperar(`sin errores nuevos (${graves.length})`, graves.length === 0);
  for (const e of graves.slice(0, 5)) console.log('     ' + e);
} finally {
  await nav.close();
}

console.log(fallas === 0 ? '\ntodo bien' : `\n${fallas} fallaron`);
process.exit(fallas === 0 ? 0 : 1);
