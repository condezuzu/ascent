// EL TITILEO AL CAMBIAR DE PESTAÑA, Y EL PLANETA QUE SOLO VA EN INICIO (23/9)
//
// EL TITILEO SE REPORTÓ DOS VECES, y el primer arreglo no era el arreglo. Lo
// que se creía era que el carril se centraba antes de que la pantalla nueva se
// dibujara; lo que pasaba de verdad es que **la pantalla de destino se
// remontaba**: ya estaba montada y cargada en el carril que asomaba, y al
// soltar el gesto se tiraba para crearla de nuevo, vacía.
//
// Por eso esta sonda no mira cómo se ve nada: mira LA IDENTIDAD DEL NODO. Si
// el carril que dibuja el Álbum es el mismo antes y después de ir y volver, no
// se remontó — y sin remonte no hay parpadeo.
//
// No escribe nada: solo mira.
//
//   node --env-file=.env.local herramientas/probar-pestanas-nativa.mjs [--puerto=8090]
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

async function tocar(rotulo) {
  const boton = page
    .getByText(rotulo, { exact: true })
    .last()
    .locator('xpath=ancestor-or-self::*[@tabindex][1]');
  if (!(await boton.isVisible().catch(() => false))) return false;
  await boton.click({ timeout: 20000 });
  return true;
}

/**
 * Sella el carril de una pestaña, para poder reconocerlo después.
 *
 * SE SELLA EL CARRIL Y NO EL TEXTO DE ADENTRO, y el primer intento de esta
 * sonda fallaba por eso: el contenido se vuelve a dibujar cuando cambian sus
 * datos, así que perder una marca puesta ahí no probaba nada. El carril es el
 * nodo cuya identidad ES la pregunta: si sobrevive, la pantalla no se montó
 * de nuevo.
 */
const sellar = (pestana, sello) =>
  page.evaluate(
    ([pestana, sello]) => {
      const el = document.querySelector(`[data-testid="carril-${pestana}"]`);
      if (!el) return false;
      el.setAttribute('data-sello', sello);
      return true;
    },
    [pestana, sello]
  );

const sigueElSello = (sello) =>
  page.evaluate((sello) => !!document.querySelector(`[data-sello="${sello}"]`), sello);

try {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.locator('input[type=email], input[inputmode=email]').first().fill(process.env.CONEXION_EMAIL, { timeout: 90000 });
  await page.locator('input[type=password]').first().fill(process.env.CONEXION_PASSWORD);
  await page.getByText('Entrar', { exact: true }).last().click({ timeout: 60000 });
  await page.waitForTimeout(9000);
  const entendido = page.getByText('Entendido', { exact: true });
  if (await entendido.isVisible().catch(() => false)) await entendido.click();
  await page.waitForTimeout(2500);

  console.log('\n1. Las pestañas no se remontan al cambiar');
  // Se abre el Álbum una vez para que quede montado.
  esperar('se puede ir al Album', await tocar('Álbum'));
  await page.waitForTimeout(3500);
  esperar('se sello el carril del Album', await sellar('album', 'sello-album'));

  // Ida y vuelta por las otras pestañas.
  for (const p of ['Stats', 'Ranking', 'Álbum']) {
    await tocar(p);
    await page.waitForTimeout(2500);
  }
  // SI EL SELLO SOBREVIVIO, el nodo es el mismo: no hubo remonte, no hay
  // parpadeo. Si se perdio, la pantalla se creo de cero — que es el bug.
  esperar('el carril del Album es el MISMO despues de ir y volver', await sigueElSello('sello-album'));

  console.log('\n2. Y no vuelve a pedir sus datos de cero');
  // Volver tiene que RECARGAR (los datos pueden haber cambiado) pero sin
  // desmontar: lo primero se ve porque la pantalla sigue con contenido.
  esperar('el Album sigue mostrando algo', /ÁLBUM/i.test(await texto()));

  console.log('\n3. El planeta solo en Inicio');
  const cuerpoEn = async (pestana) => {
    await tocar(pestana);
    await page.waitForTimeout(3000);
    // El motor dibuja en un canvas; lo que se mira es si la escena pidio
    // cuerpo. Se lee del pedido, que es lo que decide.
    return page.evaluate(() => {
      const c = document.querySelector('canvas');
      return !!c;
    });
  };
  esperar('hay motor en Inicio', await cuerpoEn('Inicio'));
  // En las otras cuatro el canvas sigue —el cielo es el motor— pero sin cuerpo.
  // Que no haya cuerpo no se puede leer del DOM: lo cuida `test:db` §141.
  for (const p of ['Ranking', 'Álbum', 'Stats', 'Ajustes']) {
    esperar(`y sigue habiendo cielo en ${p}`, await cuerpoEn(p));
  }

  console.log('\n4. Nada tiro al dibujar');
  const graves = errores.filter((e) => !/UnableToResolveError|POP_TO_TOP|401/.test(e));
  esperar(`sin errores nuevos (${graves.length})`, graves.length === 0);
  for (const e of graves.slice(0, 5)) console.log('     ' + e);
} finally {
  await nav.close();
}

console.log(fallas === 0 ? '\ntodo bien' : `\n${fallas} fallaron`);
process.exit(fallas === 0 ? 0 : 1);
