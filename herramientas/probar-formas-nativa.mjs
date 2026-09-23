// LAS FORMAS QUE FALTABAN PORTAR (24/9)
//
// Las encontró el humano USANDO la app el 22/9, y por eso el inventario
// pantalla por pantalla no las había visto: no son funciones que falten, son
// formas que quedaron distintas de la web. Esta sonda las mira una por una.
//
// LO QUE MÁS CUESTA PROBAR ACÁ, y por qué igual vale: la racha al costado y la
// animación del Álbum son COMPOSICIÓN, y una sonda no puede decir si algo se
// ve bien. Lo que sí puede decir —y es lo que se rompe— es si la palabra
// quedó apilada o en una sola línea, y si las celdas entran escalonadas o
// todas de golpe. Lo que se ve lindo lo mira el humano; que esté puesto, esto.
//
//   node --env-file=.env.local herramientas/probar-formas-nativa.mjs [--puerto=8090]
//
// Necesita la nativa prendida. No escribe nada: solo mira.
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

try {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.locator('input[type=email], input[inputmode=email]').first().fill(process.env.CONEXION_EMAIL, { timeout: 90000 });
  await page.locator('input[type=password]').first().fill(process.env.CONEXION_PASSWORD);
  await page.getByText('Entrar', { exact: true }).last().click({ timeout: 60000 });
  await page.waitForTimeout(9000);
  const entendido = page.getByText('Entendido', { exact: true });
  if (await entendido.isVisible().catch(() => false)) await entendido.click();
  await page.waitForTimeout(2500);

  // LA CUENTA DE PRUEBA PUEDE ESTAR EN CUALQUIERA DE DOS ESTADOS, y los dos
  // son de esta tanda: con racha, se dibuja el numero con la palabra al
  // costado y la barra; sin nada todavia, el estado vacio de §11. Esta sonda
  // miraba solo el primero y el 23/9 fallo sola — la racha se habia perdido
  // de un dia para el otro y el estado vacio estaba haciendo lo correcto.
  //
  // Que la racha ESTE CONECTADA lo cuida `test:db` §138, que lo mira en el
  // codigo y no depende del humor de la cuenta. Lo que solo se puede ver
  // dibujando —que la palabra quedo apilada y la barra no ocupa todo— se
  // mira aca, cuando hay racha que mirar.
  const conRacha = await page.evaluate(() => !!document.querySelector('[aria-label="Racha" i]'));
  console.log(`\n(la cuenta esta ${conRacha ? 'con racha' : 'en el estado vacio'})`);

  if (!conRacha) {
    console.log('\n1. El estado vacio (§11)');
    const t = await texto();
    // NO DICE "no hay datos": el dia uno no hay racha ni amigos ni fotos, y
    // esa es la primera impresion de la app. Un cero gigante seria un
    // boletin de lo que todavia no hiciste.
    esperar('dice que todavia no hay nada', /Todav[ií]a no hay nada/i.test(t));
    esperar('y ofrece por donde empezar', /primer d[ií]a/i.test(t));
    esperar('sin un cero gigante', !/^0$/m.test(t));
  } else {
    console.log('\n1. RACHA va al COSTADO del numero, no encima');
    const racha = await page.evaluate(() => {
      const col = document.querySelector('[aria-label="Racha" i]');
      const r = col.getBoundingClientRect();
      let numero = null;
      for (const el of document.querySelectorAll('div')) {
        const px = parseFloat(getComputedStyle(el).fontSize);
        if (px > 60 && el.innerText && /^\d+$/.test(el.innerText.trim())) {
          const rr = el.getBoundingClientRect();
          if (!numero || rr.width > numero.width) numero = { ...rr.toJSON(), texto: el.innerText.trim() };
        }
      }
      return {
        lineas: col.innerText.trim().split('\n').length,
        ancho: Math.round(r.width),
        alto: Math.round(r.height),
        izq: Math.round(r.left),
        numero: numero ? { izq: Math.round(numero.left), texto: numero.texto } : null,
      };
    });
    // APILADA: cinco letras, una por fila. En una sola linea seria el rotulo
    // de antes, puesto de nuevo arriba.
    esperar('la palabra esta apilada, una letra por fila', racha.lineas === 5, `${racha.lineas} fila(s)`);
    // MAS ALTA QUE ANCHA: la prueba de forma que no depende de la fuente.
    esperar('la columna es vertical', racha.alto > racha.ancho * 2, `${racha.ancho}x${racha.alto}`);
    esperar('hay un numero grande al lado', !!racha.numero, racha.numero?.texto ?? '');
    if (racha.numero) esperar('y el numero esta a la DERECHA de la palabra', racha.numero.izq > racha.izq);

    console.log('\n2. La barra de progreso al rango siguiente');
    const barra = await page.evaluate(() => {
      for (const el of document.querySelectorAll('div')) {
        const r = el.getBoundingClientRect();
        if (r.height !== 3 || r.width < 50) continue;
        const hija = el.firstElementChild;
        if (!hija) continue;
        const rh = hija.getBoundingClientRect();
        return { hay: true, ancho: Math.round(r.width), lleno: Math.round(rh.width), ventana: window.innerWidth };
      }
      return { hay: false };
    });
    esperar('esta la barra', barra.hay);
    if (barra.hay) {
      // NO OCUPA EL ANCHO COMPLETO (62% en la web): que no todo cierre en la
      // misma linea es parte de la composicion, no un descuido.
      esperar('no ocupa el ancho completo', barra.ancho < barra.ventana * 0.8, `${barra.ancho} de ${barra.ventana}`);
      esperar('y lo lleno no se pasa del largo', barra.lleno <= barra.ancho + 1, `${barra.lleno}/${barra.ancho}`);
    }
  }

  console.log('\n2b. El recordatorio del gimnasio, mientras no este marcado');
  const tIni = await texto();
  // SOLO SI NO HAY PUNTO: con el punto marcado no tiene que aparecer nada.
  if (/Marca tu gimnasio/i.test(tIni)) {
    // Y NO PROMETE EL TECHO DE LA WEB: aca el dia entra con la app cerrada.
    esperar('no dice "al abrir la app"', !/al abrir la app/i.test(tIni));
  } else {
    console.log('     (la cuenta ya tiene el punto marcado: no hay recordatorio)');
  }
  console.log('\n3. El Album entra escalonado, no todo de golpe');
  esperar('se puede ir al Album', await tocar('Álbum'));
  // SE MIRA APENAS APARECE LA GRILLA. Esperar un rato fijo no sirve: si se
  // mira tarde ya entraron todas y no se distingue de aparecer de golpe, y
  // si se mira antes de que haya grilla se lee "no hay fotos" — que es el
  // agujero por el que esta sonda dio verde sin probar nada la primera vez.
  const cuadradas = () =>
    page.evaluate(() => {
      const ops = [];
      for (const el of document.querySelectorAll('div')) {
        const r = el.getBoundingClientRect();
        if (r.width > 60 && Math.abs(r.width - r.height) < 3) ops.push(parseFloat(getComputedStyle(el).opacity));
      }
      return ops;
    });

  let ops = [];
  for (let i = 0; i < 25 && ops.length === 0; i++) {
    await page.waitForTimeout(120);
    ops = await cuadradas();
  }

  if (ops.length === 0) {
    esperar('hay grilla del Album para mirar', false, 'la cuenta no tiene fotos');
  } else {
    const distintas = new Set(ops.map((o) => o.toFixed(2))).size;
    // SI ENTRARAN TODAS JUNTAS todas tendrian la misma opacidad en cualquier
    // instante. Escalonadas, en medio de la entrada hay varias distintas.
    esperar('las celdas no entran todas a la vez', distintas > 1, `${ops.length} celdas, ${distintas} opacidad(es)`);
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
