// "LA PRÓXIMA, MÁS" NO SE MUEVE CUANDO SE VA EL CUADRO DE LA MARCA (18/10).
//
// El cuadro «¿La guardo como marca?» se va solo 4,5 s después de guardar
// (`compartido/marcaSugerida.ts`) y estaba justo encima de «La próxima, más»: al irse,
// el botón subía 96 px, debajo del dedo de quien iba a tocarlo. Es también lo que hizo
// fallar una vez el paso de la próxima en `bateria-dos-apps`.
//
// Se mide en la vista web de la nativa (:8090), con una cuenta descartable: la posición del
// botón con el cuadro ya en «Guardada» y después de que se fue solo. Tiene que ser la misma.
// Desde «Guardada» y no antes: al contestar, el cuadro se achica, pero eso pasa con el dedo
// sobre el cuadro; lo que salta bajo el dedo de otro botón es irse solo, 4,5 s después. Y el
// cuadro se tiene que haber ido de verdad: si no se fue, no hay nada que medir.
//
//   node --env-file=.env.local supabase/probar-salto-marca.mjs
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pasarLaEntradaNativa, borrarCuentaDePrueba, limiteDeSonda } from './utiles.mjs';
import { T } from '../nucleo/textos.ts';

limiteDeSonda(6);

const SALIDA = join(dirname(fileURLToPath(import.meta.url)), '..', 'capturas', 'salto-marca');
mkdirSync(SALIDA, { recursive: true });
const sello = Date.now().toString(36);
const correo = `agusconde20+ascent-salto-${sello}@gmail.com`;
const clave = `Sm-${sello}-Kp3`;
let fallos = 0;
const chequear = (que, real, esperado) => {
  const bien = JSON.stringify(real) === JSON.stringify(esperado);
  if (!bien) fallos++;
  console.log(`  ${bien ? 'ok  ' : 'FALLA'} ${que}${bien ? '' : `: esperado ${JSON.stringify(esperado)}, obtuve ${JSON.stringify(real)}`}`);
};

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const { error: eAlta } = await s.auth.signUp({ email: correo, password: clave });
if (eAlta) {
  console.log('No se pudo crear la cuenta:', eAlta.message);
  process.exit(1);
}
const uid = (await s.auth.getUser()).data.user.id;
await s.from('profiles').update({ username: `sal_${sello.slice(-6)}` }).eq('id', uid);

console.log('\nLa próxima, más: el botón no se mueve cuando se va el cuadro de la marca');
const nav = await chromium.launch();
const page = await (await nav.newContext({ viewport: { width: 390, height: 900 }, locale: 'es-UY', timezoneId: 'America/Montevideo' })).newPage();
const texto = (t) => page.getByText(t, { exact: true }).last();
const toque = page.getByTestId('la-proxima-mas');
const cuadro = page.getByText(/La guardo como marca/i).first();
// Dos posiciones: en la PANTALLA (lo que ve el dedo) y dentro del CONTENIDO de la lista. Hace
// falta la segunda porque, con la lista abajo de todo, al achicarse el contenido el scroll se
// acomoda y en pantalla el salto se ve chico (lo que se mueve es lo de arriba).
const arriba = () =>
  toque.evaluate((n) => {
    let lista = n.parentElement;
    while (lista && !(lista.scrollHeight > lista.clientHeight && /auto|scroll/.test(getComputedStyle(lista).overflowY))) lista = lista.parentElement;
    const r = n.getBoundingClientRect();
    const contenido = lista ? r.top - lista.getBoundingClientRect().top + lista.scrollTop : r.top + window.scrollY;
    return { pantalla: Math.round(r.top), contenido: Math.round(contenido) };
  });
try {
  await page.goto('http://localhost:8090', { waitUntil: 'networkidle', timeout: 240000 });
  await pasarLaEntradaNativa(page);
  await page.locator('input[type=email]').first().fill(correo);
  await page.locator('input[type=password]').first().fill(clave);
  await texto('Entrar').click({ timeout: 30000 });

  await texto('Iniciar entrenamiento').click({ timeout: 120000 });
  await page.getByLabel('Sumar una serie').first().waitFor({ timeout: 90000 });
  await texto('Cualquier cosa').click({ timeout: 60000 });
  await page.waitForTimeout(1200);
  await texto('Press de banca').click({ timeout: 60000 });
  await page.waitForTimeout(1500);
  await texto('×5').click({ timeout: 60000 });
  const campo = page.getByLabel('Peso de las próximas series').first();
  await campo.fill('60', { timeout: 60000 });
  await campo.press('Enter');
  await campo.blur();
  await page.waitForTimeout(1000);
  const mas = page.getByLabel('Sumar una serie').first();
  for (let i = 0; i < 2; i++) {
    await mas.click();
    await page.waitForTimeout(1200);
  }

  // La marca: se contesta, y con la meta en ×2 aparece el botón mientras el cuadro sigue.
  await cuadro.waitFor({ timeout: 20000 });
  await texto('5').click();
  await texto('×2').click({ timeout: 30000 });
  await toque.waitFor({ state: 'visible', timeout: 15000 });
  const enGuardada = (t) => page.getByText(t, { exact: true });
  await enGuardada(T.marcaSugerida.guardada)
    .or(enGuardada(T.marcaSugerida.guardadaEsNueva))
    .or(enGuardada(T.marcaSugerida.fallo))
    .first()
    .waitFor({ timeout: 10000 });
  await page.waitForTimeout(300);
  const conCuadro = await cuadro.isVisible();
  const antes = await arriba();
  await page.screenshot({ path: join(SALIDA, '1-con-el-cuadro.png') });

  await cuadro.waitFor({ state: 'detached', timeout: 12000 });
  await page.waitForTimeout(600);
  const sinCuadro = !(await cuadro.isVisible().catch(() => false));
  const despues = await arriba();
  await page.screenshot({ path: join(SALIDA, '2-sin-el-cuadro.png') });

  chequear('el cuadro estaba a la vista con el botón, y después se fue solo', [conCuadro, sinCuadro], [true, true]);
  chequear(
    'el botón queda donde estaba: en pantalla ' + antes.pantalla + ' → ' + despues.pantalla + ' px, en el contenido ' + antes.contenido + ' → ' + despues.contenido + ' px',
    despues,
    antes
  );
} catch (e) {
  fallos++;
  console.log('  FALLA el recorrido: ' + String(e).split('\n')[0].slice(0, 200));
  await page.screenshot({ path: join(SALIDA, 'error.png') }).catch(() => {});
}
await nav.close();

const { error: eBorrar } = await borrarCuentaDePrueba(s);
if (eBorrar) {
  fallos++;
  console.log('  FALLA no se borró la cuenta: ' + eBorrar.message);
} else console.log('  ok   cuenta borrada');
process.exit(fallos ? 1 : 0);
