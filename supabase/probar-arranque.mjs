// EL ARRANQUE CON SESIÓN (21/10): al abrir la app, Inicio no se monta ni se pinta hasta que termina
// la entrada (después del zoom); sus datos se piden una sola vez, mientras corre la entrada, y ya
// llegaron cuando empieza el zoom; y al aparecer, Inicio está con sus datos: sin la ruedita y sin
// volver a cargar.
//
// En la vista web de la nativa (:8090), con una cuenta descartable: se entra una vez y se recarga
// la página, que es abrir la app con la sesión guardada. La página anota cuadro por cuadro si
// está el logo y cuánto se ve, si está Inicio (`pantalla-inicio`, que lleva también la ruedita) y
// si está la ruedita; los pedidos a `pantalla_inicio` salen de los tiempos del propio navegador.
//
//   node --env-file=.env.local supabase/probar-arranque.mjs
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { pasarLaEntradaNativa, borrarCuentaDePrueba, limiteDeSonda } from './utiles.mjs';

limiteDeSonda(6);

const sello = Date.now().toString(36);
const correo = `agusconde20+ascent-arr-${sello}@gmail.com`;
const clave = `Ar-${sello}-Kp3`;
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
await s.from('profiles').update({ username: `arr_${sello.slice(-6)}` }).eq('id', uid);
// Una rutina guardada: la fila «Hoy» de Inicio tiene que nacer con ella (28/10).
const dia = { descanso: false, ejercicios: [{ ejercicio: 'press_banca', series: 3 }] };
await s.rpc('guardar_rutina', { p_id: null, p_nombre: 'Prueba', p_dias: Array.from({ length: 7 }, () => dia) });

console.log('El arranque con sesión: la entrada primero, Inicio después y con sus datos, una sola carga');
const nav = await chromium.launch();
const page = await (await nav.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-UY', timezoneId: 'America/Montevideo' })).newPage();
try {
  await page.goto('http://localhost:8090', { waitUntil: 'domcontentloaded', timeout: 240000 });
  await pasarLaEntradaNativa(page);
  await page.locator('input[type=email], input[inputmode=email]').first().fill(correo, { timeout: 90000 });
  await page.locator('input[type=password]').first().fill(clave);
  await page.getByText('Entrar', { exact: true }).last().click({ timeout: 60000 });
  await page.getByText('Iniciar entrenamiento', { exact: true }).first().waitFor({ timeout: 120000 });
  await page.waitForTimeout(1500);

  // ABRIR LA APP CON LA SESIÓN GUARDADA: recargar. Todo con el reloj de la página.
  await page.addInitScript(() => {
    const linea = [];
    window.__arranque = linea;
    const t0 = performance.now();
    const mirar = () => {
      const capa = document.querySelector('[data-testid="entrada-de-la-app"]');
      const opacidad = capa ? Number(getComputedStyle(capa).opacity) : 0;
      const inicio = !!document.querySelector('[data-testid="pantalla-inicio"]');
      const rueda = !!document.querySelector('[role="progressbar"]');
      const motor = !!document.querySelector('canvas');
      const fila = !!document.querySelector('[data-testid="inicio-rutina"]');
      linea.push({ t: Math.round(performance.now()), logo: !!capa, opacidad, inicio, rueda, motor, fila });
      if (performance.now() - t0 < 9000) requestAnimationFrame(mirar);
    };
    requestAnimationFrame(mirar);
  });
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(9500);
  const { linea, pedidos } = await page.evaluate(() => ({
    linea: window.__arranque,
    pedidos: performance
      .getEntriesByType('resource')
      .filter((e) => e.name.includes('/rpc/pantalla_inicio'))
      .map((e) => ({ desde: Math.round(e.startTime), hasta: Math.round(e.responseEnd) })),
  }));
  const conLogo = linea.filter((m) => m.logo);
  const zoom = linea.find((m) => m.logo && m.opacidad < 0.99);
  const finLogo = linea.find((m, i) => i > 0 && linea[i - 1].logo && !m.logo);
  const montado = linea.find((m) => m.inicio);
  const inicioConLogo = linea.filter((m) => m.inicio && m.logo);
  const ruedaConInicio = linea.filter((m) => m.inicio && m.rueda);
  let idas = 0;
  for (let i = 1; i < linea.length; i++) if (linea[i - 1].inicio && !linea[i].inicio) idas++;
  console.log(
    `  --   logo ${conLogo[0]?.t ?? '?'}–${finLogo?.t ?? '?'} ms (zoom desde ${zoom?.t ?? '?'}); Inicio montado a los ${montado?.t ?? '?'} ms; pantalla_inicio ${JSON.stringify(pedidos)}; ruedita en ${ruedaConInicio.length} cuadros; Inicio se fue y volvió ${idas} veces`
  );
  chequear('Inicio no se monta ni se pinta mientras está el logo (ni durante el zoom)', [inicioConLogo.length, !!montado && !!finLogo && montado.t >= finLogo.t], [0, true]);
  chequear('los datos de Inicio se piden una sola vez', pedidos.length, 1);
  // Desde el 28/10 el motor arranca debajo del logo y el primer cuadro del logo se mide unos ms
  // después: el pedido puede salir antes de ese cuadro, y sigue siendo durante la entrada.
  chequear('se piden mientras corre la entrada, y ya llegaron cuando empieza el zoom', pedidos.length === 1 && !!zoom && pedidos[0].desde < zoom.t && pedidos[0].hasta <= zoom.t, true);
  chequear('al aparecer, Inicio ya tiene sus datos: sin ruedita y sin volver a cargar', [ruedaConInicio.length, idas], [0, 0]);
  // LO QUE SE VEÍA CARGAR DESPUÉS (28/10): el motor arranca debajo del logo y la fila de la rutina
  // está en el primer cuadro de Inicio.
  console.log(`  --   motor desde ${linea.find((m) => m.motor)?.t ?? '?'} ms; fila de la rutina desde ${linea.find((m) => m.fila)?.t ?? '?'} ms`);
  chequear('el motor ya está dibujando mientras está el logo, y la fila «Hoy» de la rutina llega con Inicio', [
    linea.some((m) => m.logo && m.motor), !!montado?.fila,
  ], [true, true]);
} catch (e) {
  fallos++;
  console.log('  FALLA ' + String(e).split('\n')[0].slice(0, 200));
}
await nav.close();

const { error: eBorrar } = await borrarCuentaDePrueba(s);
console.log(`  ${eBorrar ? 'FALLA' : 'ok  '} cuenta borrada${eBorrar ? ': ' + eBorrar.message : ''}`);
if (eBorrar) fallos++;
process.exit(fallos ? 1 : 0);
