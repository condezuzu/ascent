// CUÁNTO TARDA LA NATIVA (15/10/2026): para medir antes y después de una pasada
// de optimización, con los mismos números.
//
//   node --env-file=.env.local supabase/medir-nativa.mjs [corridas=3]      (SIN_MOTOR=1: sin el fondo 3D; CPU_LENTA=4: JS más lento)
//
// NECESITA LA NATIVA PRENDIDA en :8090. ES UN SUSTITUTO DEL TELÉFONO: Expo web en
// modo desarrollo, en una computadora. Los números absolutos no son los del
// iPhone; la comparación antes/después, con el mismo medidor, sí dice algo.
// Una cuenta descartable, que se borra al final.
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { limiteDeSonda, pasarLaEntradaNativa, borrarCuentaDePrueba } from './utiles.mjs';
import { TEXTOS_ES as T } from '../nucleo/textos.ts';

limiteDeSonda(12);
const NATIVA = process.env.NATIVA_URL ?? 'http://localhost:8090';
const CORRIDAS = Number(process.argv[2] ?? 3);
const sello = String(Date.now()).slice(-7);
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const correo = `agusconde20+ascent-medir-${sello}@gmail.com`;
const clave = `Me-${sello}-x9`;
{
  const { error } = await s.auth.signUp({ email: correo, password: clave });
  if (error) throw new Error(`alta: ${error.message}`);
  const id = (await s.auth.getUser()).data.user.id;
  await s.from('profiles').update({ username: `medir_${sello.slice(-4)}` }).eq('id', id);
}

const mediana = (xs) => {
  const o = [...xs].sort((a, b) => a - b);
  return o[Math.floor(o.length / 2)];
};

async function unaCorrida(nav) {
  const contexto = await nav.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-UY' });
  // SIN_MOTOR=1: el fondo 3D apagado (Ajustes → Fondo → Nunca), para separar lo que pesa el motor de lo que pesa la app.
  if (process.env.SIN_MOTOR) await contexto.addInitScript(() => localStorage.setItem('ascent:fondo', 'nunca'));
  const page = await contexto.newPage();
  // CPU_LENTA=4: el JavaScript cuatro veces más lento, para parecerse a un teléfono.
  if (process.env.CPU_LENTA) await (await contexto.newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: Number(process.env.CPU_LENTA) });
  const pedidos = [];
  let contar = false;
  page.on('request', (q) => {
    if (contar && /supabase\.co\/(rest|auth|storage)/.test(q.url())) pedidos.push(`${q.method()} ${q.url().replace(/[?&](inicio|fecha|logs\.fecha)=[^&]*/g, '')}`);
  });
  const r = {};
  let t = Date.now();
  await page.goto(NATIVA, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await pasarLaEntradaNativa(page, 60000, T);
  await page.locator('input[type=email], input[inputmode=email]').first().waitFor({ timeout: 90000 });
  r.cargaInicial = Date.now() - t;
  await page.locator('input[type=email], input[inputmode=email]').first().fill(correo);
  await page.locator('input[type=password]').first().fill(clave);
  contar = true;
  t = Date.now();
  await page.getByText(T.entrar.entrar, { exact: true }).last().click();
  await page.getByText('Iniciar entrenamiento', { exact: true }).first().waitFor({ timeout: 90000 });
  r.entrar = Date.now() - t;
  await page.waitForTimeout(5000);
  contar = false;
  r.pedidos = pedidos.length;
  const vistos = new Map();
  for (const p of pedidos) vistos.set(p, (vistos.get(p) ?? 0) + 1);
  r.repetidos = [...vistos.values()].reduce((n, k) => n + (k - 1), 0);
  r.detalleRepetidos = [...vistos.entries()].filter(([, k]) => k > 1).map(([p, k]) => `${k}× ${p.replace(/^.*supabase\.co/, '')}`.slice(0, 140));

  // EL CAMBIO DE PESTAÑA: hasta que se ve algo propio de cada una. Dos vueltas.
  const pestanas = [
    [T.nav.stats, () => page.getByText('Entrenamiento', { exact: true }).first()],
    [T.nav.social, () => page.getByTestId('buscar-gente').first()],
    [T.nav.album, () => page.getByText(T.album.titulo, { exact: true }).first()],
    [T.nav.ajustes, () => page.getByTestId('idioma-es').first()],
    [T.nav.inicio, () => page.getByText('Iniciar entrenamiento', { exact: true }).first()],
  ];
  for (const vuelta of [1, 2]) {
    for (const [nombre, marca] of pestanas) {
      t = Date.now();
      await page.getByText(nombre, { exact: true }).last().click({ timeout: 30000 });
      await marca().waitFor({ state: 'visible', timeout: 60000 });
      r[`${nombre} (${vuelta})`] = Date.now() - t;
    }
  }

  // CON UNA SESIÓN CORRIENDO: cuánto se traba el hilo en diez segundos.
  await page.getByText('Iniciar entrenamiento', { exact: true }).first().click();
  await page.getByLabel('Sumar una serie').first().waitFor({ timeout: 90000 });
  await page.waitForTimeout(1500);
  const largas = await page.evaluate(
    () =>
      new Promise((listo) => {
        const tareas = [];
        const o = new PerformanceObserver((l) => tareas.push(...l.getEntries().map((e) => e.duration)));
        o.observe({ type: 'longtask', buffered: false });
        setTimeout(() => {
          o.disconnect();
          listo({ n: tareas.length, ms: Math.round(tareas.reduce((a, b) => a + b, 0)) });
        }, 10000);
      })
  );
  r.sesionTareasLargas = largas.n;
  r.sesionMsTrabado = largas.ms;
  // Un toque del + con la sesión andando: hasta que el total cambia en pantalla.
  t = Date.now();
  await page.getByLabel('Sumar una serie').first().click();
  await page.getByText('1 en total').first().waitFor({ timeout: 30000 });
  r.tocarMas = Date.now() - t;
  // CON EL DESCANSO A LA VISTA (pantalla opaca): lo mismo, diez segundos.
  await page.getByTestId('pildora-descanso').first().click({ timeout: 20000 });
  await page.getByTestId('descanso-a-mano').first().waitFor({ state: 'visible', timeout: 20000 });
  await page.waitForTimeout(1500);
  const enDescanso = await page.evaluate(
    () =>
      new Promise((listo) => {
        const tareas = [];
        const o = new PerformanceObserver((l) => tareas.push(...l.getEntries().map((e) => e.duration)));
        o.observe({ type: 'longtask', buffered: false });
        setTimeout(() => {
          o.disconnect();
          listo({ n: tareas.length, ms: Math.round(tareas.reduce((a, b) => a + b, 0)) });
        }, 10000);
      })
  );
  r.descansoTareasLargas = enDescanso.n;
  r.descansoMsTrabado = enDescanso.ms;
  await page.getByText(T.descanso.saltar, { exact: true }).last().click().catch(() => {});
  await page.waitForTimeout(800);
  await page.getByText('Terminar', { exact: true }).last().click().catch(() => {});
  await page.waitForTimeout(500);
  await page.getByText('Terminar', { exact: true }).last().click().catch(() => {});
  await page.waitForTimeout(2000);
  await page.context().close();
  return r;
}

// Con la GPU de la máquina (como las capturas): sin ella el motor se dibuja por CPU y tapa todo lo demás.
const nav = await chromium.launch({ args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--enable-unsafe-swiftshader=false'] });
const corridas = [];
try {
  for (let i = 0; i < CORRIDAS; i++) corridas.push(await unaCorrida(nav));
} finally {
  await nav.close();
  await borrarCuentaDePrueba(s);
}
const claves = Object.keys(corridas[0]).filter((k) => typeof corridas[0][k] === 'number');
const resumen = Object.fromEntries(claves.map((k) => [k, mediana(corridas.map((c) => c[k]))]));
console.log(JSON.stringify({ resumen, repetidos: corridas[0].detalleRepetidos }, null, 1));
