// LOS ESTADOS RAROS, uno por uno, con todas las pantallas abiertas encima.
//
// QUÉ CONTESTA, y es un pedido textual: *"los estados raros: cuenta nueva sin
// nada, racha perdida, día de descanso, subida de rango, vida aplicada, sesión
// vieja abierta, medianoche en medio de un entrenamiento"*.
//
// POR QUÉ NO ALCANZA CON `barrido-nativa.mjs`. Ese recorre todo en cuatro
// estados —vacía, con datos, sin red, con sesión viva— y los cuatro son
// estados del APARATO. Estos son estados de la CUENTA, y son los que no se
// pueden probar a mano sin esperar semanas: la racha se pierde el día que se
// pierde, la vida se aplica el día que se aplica, y el día de descanso es el
// día de descanso. Todos se pueden ARMAR en la base en dos segundos, y
// ninguno se estaba probando.
//
// LO QUE BUSCA es lo mismo que el otro barrido y en el mismo orden de
// gravedad: excepciones de JavaScript (una pantalla que revienta), errores de
// la base (una escritura que falla en silencio) y errores de consola (un
// `undefined` que todavía no explotó).
//
// CADA ESTADO ES UNA CUENTA NUEVA y se borra al final: armar uno encima de
// otro haría que un hallazgo no se pudiera atribuir a ninguno.
//
// NECESITA LA NATIVA PRENDIDA en :8090.
//
//   node --env-file=.env.local supabase/barrido-estados.mjs
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { limiteDeSonda } from './utiles.mjs';

limiteDeSonda(25);

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const SALIDA = join(RAIZ, 'capturas', 'estados');
mkdirSync(SALIDA, { recursive: true });
const BASE = 'http://localhost:8090';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !anon) {
  console.log('Faltan NEXT_PUBLIC_SUPABASE_* en .env.local.');
  process.exit(1);
}

const sello = Date.now().toString(36);
const CLAVE = `Be-${sello}-Qw4`;
const nuevoCliente = () => createClient(url, anon, { auth: { persistSession: false } });

const hallazgos = [];
let donde = 'arranque';
const anotar = (grave, que) => hallazgos.push({ grave, donde, que: String(que).slice(0, 220) });

const nav = await chromium.launch();
const ctx = await nav.newContext({
  viewport: { width: 390, height: 900 },
  locale: 'es-UY',
  timezoneId: 'America/Montevideo',
});
const page = await ctx.newPage();

page.on('pageerror', (e) => anotar(3, `EXCEPCIÓN — ${e}`));
page.on('console', (m) => {
  if (m.type() !== 'error') return;
  const t = m.text();
  if (/Failed to load resource|ERR_INTERNET_DISCONNECTED|net::ERR|favicon/.test(t)) return;
  anotar(1, `consola — ${t}`);
});
page.on('response', async (r) => {
  if (r.status() < 400 || !r.url().includes('supabase')) return;
  // El 406 de `maybeSingle` sin filas no es un error: es la respuesta.
  if (r.status() === 406) return;
  anotar(2, `${r.status()} ${r.url().split('/').slice(-1)[0].slice(0, 80)}`);
});

const texto = (t, exact = true) => page.getByText(t, { exact }).last();
const enPestana = (p, t, exact = true) =>
  page.locator(`[data-testid="carril-${p}"]`).getByText(t, { exact }).last();

async function mirar(que, fn) {
  donde = que;
  try {
    await fn();
    await page.waitForTimeout(700);
  } catch (e) {
    anotar(2, `no se pudo — ${String(e).split('\n')[0].slice(0, 160)}`);
  }
}

// ---------------------------------------------------------------
// ARMAR CADA ESTADO
// ---------------------------------------------------------------

/** Una cuenta con nombre, y los días que se le pidan. */
async function cuenta(nombre, dias = 0) {
  const s = nuevoCliente();
  const correo = `agusconde20+ascent-estado-${sello}-${nombre}@gmail.com`;
  const { data, error } = await s.auth.signUp({ email: correo, password: CLAVE });
  if (error || !data?.user) throw new Error(`no se pudo crear ${nombre}: ${error?.message}`);
  const uid = data.user.id;
  const usuario = `est_${sello.slice(-4)}_${nombre}`.slice(0, 20);
  await s.from('profiles').update({ username: usuario, sexo: 'm' }).eq('id', uid);
  const HOY = (await s.rpc('mi_hoy')).data;
  const dia = (atras) => {
    const d = new Date(HOY + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() - atras);
    return d.toISOString().slice(0, 10);
  };
  if (dias > 0) {
    const filas = [];
    for (let a = dias - 1; a >= 0; a--) filas.push({ user_id: uid, fecha: dia(a) });
    for (let i = 0; i < filas.length; i += 50) await s.from('logs').insert(filas.slice(i, i + 50));
    await s.rpc('recalcular_desde_cero');
  }
  return { s, uid, correo, usuario, HOY, dia };
}

const cuentas = [];
async function armar(nombre, dias, extra) {
  const c = await cuenta(nombre, dias);
  cuentas.push(c);
  if (extra) await extra(c);
  return c;
}

async function entrar(correo) {
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 240000 });
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) if (k.startsWith('sb-')) localStorage.removeItem(k);
    // La caché de la sesión y la cola son del APARATO: si quedan de la cuenta
    // anterior, el estado que se arma no es el que se mira.
    localStorage.removeItem('ascent:sesion');
    localStorage.removeItem('ascent:cola');
    localStorage.removeItem('ascent:descanso');
  });
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 240000 });
  for (let i = 0; i < 90; i++) {
    if (await page.locator('input[type=password]').first().isVisible().catch(() => false)) break;
    await page.waitForTimeout(1000);
  }
  await page
    .locator('input[type=email], input[inputmode=email], input[autocomplete=email]')
    .first()
    .fill(correo);
  await page.locator('input[type=password]').first().fill(CLAVE);
  await texto('Entrar').click();
  await enPestana('inicio', 'Iniciar entrenamiento', false).waitFor({ timeout: 180000 }).catch(() => {});
  await page.waitForTimeout(4000);
}

/** La misma vuelta por todo, para que dos estados se puedan comparar. */
async function recorrer(estado) {
  const con = (n) => `${estado} · ${n}`;
  for (const p of ['Ranking', 'Álbum', 'Stats', 'Ajustes', 'Inicio']) {
    await mirar(con(`pestaña ${p}`), () => texto(p).click({ timeout: 20000 }));
  }
  const solapa = (n) =>
    page.locator('[data-testid="carril-stats"]').getByRole('tab', { name: n, exact: true });
  await mirar(con('Stats'), () => page.getByRole('tab', { name: 'Stats' }).click({ timeout: 20000 }));
  for (const s of ['Entrenamiento', 'General']) {
    await mirar(con(`Stats · ${s}`), async () => {
      const l = solapa(s);
      if (await l.isVisible().catch(() => false)) await l.click({ timeout: 15000 });
    });
  }
  await mirar(con('perfil'), async () => {
    await texto('Inicio').click();
    await page.waitForTimeout(600);
    await page.getByRole('button', { name: 'Tu perfil' }).last().click({ timeout: 20000 });
  });
  await mirar(con('volver'), () => texto('Volver', false).click({ timeout: 20000 }));
  await mirar(con('Inicio'), () => texto('Inicio').click());
  await page.screenshot({ path: join(SALIDA, `${estado.replace(/[^a-z0-9]+/gi, '-')}.png`) });
}

console.log(`\nBarrido de estados raros · ${sello}\n`);

try {
  // ─────────────────────────────────────────────────────────────
  // 1. CUENTA NUEVA, SIN NADA
  // ─────────────────────────────────────────────────────────────
  {
    const c = await armar('vacia', 0);
    await entrar(c.correo);
    await recorrer('vacia');
  }

  // ─────────────────────────────────────────────────────────────
  // 2. DÍA DE DESCANSO
  // ─────────────────────────────────────────────────────────────
  //
  // El día de hoy marcado como libre y SIN registrar: es el estado que pinta
  // el cuerpo "en reposo" y el que cambia lo que dice Inicio.
  {
    const c = await armar('descanso', 12, async (x) => {
      // El de hoy se borra y se repone como descanso: `recalcular` lo respeta.
      await x.s.from('logs').delete().eq('user_id', x.uid).eq('fecha', x.HOY);
      await x.s.from('logs').insert({ user_id: x.uid, fecha: x.HOY, es_descanso: true });
      // Y la configuración, que es lo que mira `esDiaDeDescanso`.
      const hoy = new Date(x.HOY + 'T12:00:00Z').getUTCDay();
      await x.s.rpc('fijar_descansos', { p_dias: [hoy] });
      await x.s.rpc('recalcular_desde_cero');
    });
    await entrar(c.correo);
    await recorrer('dia de descanso');
  }

  // ─────────────────────────────────────────────────────────────
  // 3. RACHA PERDIDA
  // ─────────────────────────────────────────────────────────────
  //
  // El hueco se cubre con una vida y devolverla es lo que corta: es el camino
  // que corre de verdad (ver la sección 12 de `test-e2e`). Queda la racha
  // bajada diez y el rango uno abajo, que es lo que dibuja Inicio "apagado".
  {
    const c = await armar('perdida', 30, async (x) => {
      await x.s.from('logs').delete().eq('user_id', x.uid).eq('fecha', x.HOY);
      await x.s.from('logs').delete().eq('user_id', x.uid).eq('fecha', x.dia(1));
      await x.s.rpc('verificar_perdida');
      await x.s.rpc('devolver_impulsos', { p_fechas: [x.dia(1)] });
    });
    await entrar(c.correo);
    await recorrer('racha perdida');
  }

  // ─────────────────────────────────────────────────────────────
  // 4. VIDA APLICADA, SIN ANUNCIAR
  // ─────────────────────────────────────────────────────────────
  //
  // El hueco cubierto y la marca de "ya te lo conté" SIN poner: es el estado
  // en que Inicio abre con la tarjeta de la racha salvada encima.
  {
    const c = await armar('vida', 30, async (x) => {
      await x.s.from('logs').delete().eq('user_id', x.uid).eq('fecha', x.dia(1));
      await x.s.rpc('verificar_perdida');
    });
    await entrar(c.correo);
    await recorrer('vida aplicada');
  }

  // ─────────────────────────────────────────────────────────────
  // 5. SESIÓN VIEJA ABIERTA, DE AYER
  // ─────────────────────────────────────────────────────────────
  //
  // La sesión solo puede empezar ahora, así que "vieja" se arma como se puede:
  // arrancándola con la hora de llegada lo más atrás que la base acepta (45
  // minutos) y dejándola corriendo. Es el estado del que se fue del gimnasio
  // sin tocar Terminar, que es el más común de todos.
  {
    const c = await armar('abierta', 20, async (x) => {
      await x.s.rpc('iniciar_sesion', {
        p_desde: new Date(Date.now() - 44 * 60_000).toISOString(),
      });
      await x.s.rpc('fijar_series', { p_sesion: (await x.s.rpc('mi_sesion')).data?.id, p_series: 7 });
    });
    await entrar(c.correo);
    await recorrer('sesion abierta');
  }

  // ─────────────────────────────────────────────────────────────
  // 6. MEDIANOCHE EN MEDIO DEL ENTRENAMIENTO
  // ─────────────────────────────────────────────────────────────
  //
  // No se puede mover el reloj del servidor, pero sí el del TELÉFONO, que es
  // el que decide qué día muestra la app (`hoyISO`). Se entra con una sesión
  // corriendo y se adelanta el aparato al día siguiente: la app pasa a creer
  // que es otro día con la sesión de ayer viva.
  //
  // ES EXACTAMENTE EL DESACUERDO QUE LA APP TIENE QUE AGUANTAR: la sesión y el
  // día son del servidor, la semana y el calendario del teléfono.
  {
    const c = await armar('medianoche', 15, async (x) => {
      await x.s.rpc('iniciar_sesion');
      await x.s.rpc('fijar_series', { p_sesion: (await x.s.rpc('mi_sesion')).data?.id, p_series: 3 });
    });
    await entrar(c.correo);
    const manana = new Date(Date.now() + 24 * 3600_000);
    await page.clock.setSystemTime(manana);
    await page.waitForTimeout(2500);
    await recorrer('medianoche');
    await page.clock.setSystemTime(new Date());
  }
} catch (e) {
  anotar(3, `el barrido se cortó — ${e}`);
} finally {
  // EL FINALLY NO PUEDE TIRAR, y en la primera corrida tiró: `supabase.rpc()`
  // devuelve un constructor de consulta, no una promesa, así que no tiene
  // `.catch` y el `for` explotaba. Se llevó puestos los hallazgos, que se
  // imprimen después de este bloque — o sea que un barrido entero no reportó
  // nada por la limpieza.
  try {
    await nav.close();
  } catch {
    /* ya estaba cerrado */
  }
  let borradas = 0;
  for (const c of cuentas) {
    try {
      await c.s.rpc('eliminar_cuenta');
      borradas++;
    } catch {
      /* se informa abajo */
    }
  }
  console.log(`  ${borradas} de ${cuentas.length} cuentas borradas.`);
}

console.log('\n================ hallazgos ================');
if (hallazgos.length === 0) {
  console.log('Ninguno. Los seis estados abrieron todas las pantallas sin tirar nada.');
} else {
  for (const h of [...hallazgos].sort((a, b) => b.grave - a.grave)) {
    console.log(`  [${'!'.repeat(h.grave)}] ${h.donde}\n        ${h.que}`);
  }
  console.log(`\n${hallazgos.length} en total.`);
}
console.log(`\nCapturas en ${SALIDA}\n`);
