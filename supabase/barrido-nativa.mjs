// UN BARRIDO POR TODAS LAS PANTALLAS DE LA APP NATIVA, buscando lo que se
// rompe solo.
//
// POR QUÉ EXISTE. `bateria-dos-apps.mjs` recorre EL CAMINO FELIZ —crear la
// cuenta, entrenar, sacar una foto— y lo comprueba paso a paso. Esto es lo
// otro: no comprueba nada, ABRE TODO y escucha. Cada excepción de JavaScript,
// cada error de consola y cada respuesta 4xx/5xx de Supabase queda anotada con
// la pantalla en la que apareció.
//
// LO QUE BUSCA, en este orden de gravedad:
//   1. Excepciones: una pantalla que revienta es una pantalla inutilizable.
//   2. Errores de la base: una escritura que falla en silencio pierde datos.
//   3. Errores de consola: casi siempre un `undefined` que todavía no explotó.
//
// NO BORRA NADA QUE NO HAYA CREADO: hace su propia cuenta y la elimina al
// final, igual que la batería.
//
// NECESITA LA NATIVA PRENDIDA en :8090.
//
//   node --env-file=.env.local supabase/barrido-nativa.mjs
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { limiteDeSonda } from './utiles.mjs';

// Lo que espera para siempre no falla: desaparece. Ver la seccion 123.
limiteDeSonda(15);

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const SALIDA = join(RAIZ, 'capturas', 'barrido');
const BASE = 'http://localhost:8090';

const sello = Date.now().toString(36);
const correo = `agusconde20+ascent-barrido-${sello}@gmail.com`;
const clave = `Br-${sello}-Kp3`;
const usuario = `bar_${sello.slice(-6)}`;

const hallazgos = [];
let donde = 'arranque';
const anotar = (grave, que) => hallazgos.push({ grave, donde, que: que.slice(0, 220) });

const nav = await chromium.launch();
const ctx = await nav.newContext({
  viewport: { width: 390, height: 900 },
  locale: 'es-UY',
  timezoneId: 'America/Montevideo',
  permissions: ['geolocation'],
  geolocation: { latitude: -34.9011, longitude: -56.1645, accuracy: 25 },
});
const page = await ctx.newPage();

page.on('pageerror', (e) => anotar(3, `EXCEPCIÓN — ${String(e)}`));
page.on('console', (m) => {
  if (m.type() !== 'error') return;
  const t = m.text();
  // El ruido conocido: recursos que no cargan y la red cortada a propósito.
  if (/Failed to load resource|ERR_INTERNET_DISCONNECTED|net::ERR|favicon/.test(t)) return;
  anotar(1, `consola — ${t}`);
});
page.on('response', async (r) => {
  if (r.status() < 400 || !r.url().includes('supabase')) return;
  const cuerpo = await r.text().catch(() => '');
  anotar(2, `${r.status()} ${r.url().replace(/^https?:[/][/][^/]+/, '').slice(0, 60)} → ${cuerpo.slice(0, 120)}`);
});

const foto = async (nombre) => {
  await page.screenshot({ path: join(SALIDA, `${nombre}.png`) }).catch(() => {});
};

/** Abre algo y deja que respire. Nada de esto falla el barrido: si no está, se anota y sigue. */
async function mirar(nombre, fn) {
  donde = nombre;
  try {
    await fn();
    await page.waitForTimeout(1200);
  } catch (e) {
    anotar(2, `no se pudo abrir — ${String(e).split('\n')[0]}`);
  }
  await foto(nombre.replace(/\W+/g, '-'));
}

const texto = (t, exact = true) => page.getByText(t, { exact }).last();
const tocarSiEsta = async (t, exact = true) => {
  const l = texto(t, exact);
  if (await l.isVisible().catch(() => false)) await l.click({ timeout: 15000 });
};

console.log(`Barrido de la app nativa · cuenta ${usuario}`);

// ---- la cuenta ----
await mirar('cuenta', async () => {
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 240000 });
  // Hasta que la pantalla responda: un toque antes de que React tome la
  // página no hace nada. Mismo bucle que la batería.
  for (let i = 0; i < 60; i++) {
    await texto('¿Primera vez? Crear cuenta').click({ timeout: 240000 });
    if (await texto('Crear cuenta').isVisible().catch(() => false)) break;
    await page.waitForTimeout(1000);
  }
  await page.locator('input[type=email], input[inputmode=email], input[autocomplete=email]').first().fill(correo);
  await page.locator('input[type=password]').first().fill(clave);
  await texto('Crear cuenta').click();
});

await mirar('elegir nombre', async () => {
  await texto('Elige tu nombre').waitFor({ timeout: 90000 });
  await page.locator('input').first().fill(usuario);
  await texto('Empezar').click();
  await texto('Elige tu nombre').waitFor({ state: 'detached', timeout: 90000 });
  // El recorrido de primera vez tapa la mitad de abajo.
  await tocarSiEsta('Saltar');
});

// ---- las cinco pestañas, ida y vuelta ----
for (const p of ['Ranking', 'Álbum', 'Stats', 'Ajustes', 'Inicio']) {
  await mirar(`pestaña ${p}`, () => texto(p).click({ timeout: 20000 }));
}
// Y DE NUEVO, que es donde aparecieron los dos bugs del fondo: volver a una
// pestaña ya visitada no vuelve a montarla.
for (const p of ['Ranking', 'Inicio', 'Stats', 'Inicio']) {
  await mirar(`volver a ${p}`, () => texto(p).click({ timeout: 20000 }));
}

// ---- las dos solapas de Stats ----
await mirar('Stats', () => texto('Stats').click());
await mirar('Stats · Entrenamiento', () => page.getByRole('tab', { name: 'Entrenamiento' }).click({ timeout: 20000 }));
await mirar('Stats · General', () => page.getByRole('tab', { name: 'General' }).click({ timeout: 20000 }));

// ---- el perfil, y volver ----
await mirar('perfil propio', async () => {
  await texto('Inicio').click();
  await page.waitForTimeout(600);
  // La fila del nombre es un boton entero: se toca por su etiqueta, que es
  // la del perfil, y no por el texto del nombre.
  await page.getByRole('button', { name: 'Tu perfil' }).last().click({ timeout: 20000 });
});
// El boton dice "← Volver": la flecha es parte del texto.
await mirar('volver del perfil', () => texto('Volver', false).click({ timeout: 20000 }));

// ---- ajustes, sección por sección ----
await mirar('Ajustes', () => page.getByRole('tab', { name: 'Ajustes' }).click({ timeout: 20000 }));
for (const s of ['Diagnóstico', 'Cómo se compara', 'Mis datos']) {
  await mirar(`Ajustes · ${s}`, () => tocarSiEsta(s));
}

// ---- una sesión, que es donde se escriben datos ----
await mirar('Inicio', () => texto('Inicio').click());
await mirar('sesión: iniciar', () => texto('Iniciar entrenamiento').click({ timeout: 20000 }));
await mirar('sesión: elegir ejercicio', async () => {
  await tocarSiEsta('Elegir ejercicio');
  await tocarSiEsta('Pecho');
  await tocarSiEsta('Press de banca');
});
// El `+` no tiene texto: se toca por su etiqueta.
await mirar('sesión: sumar una serie', async () => {
  const mas = page.getByLabel('Sumar una serie').last();
  if (await mas.isVisible().catch(() => false)) await mas.click({ timeout: 15000 });
});
await mirar('sesión: terminar', async () => {
  await tocarSiEsta('Terminar');
  await page.waitForTimeout(1500);
});

// ---- registrar el día a mano y las hojas que cuelgan ----
await mirar('registrar el día', () => tocarSiEsta('Registrar día'));
await mirar('anotar el peso', () => tocarSiEsta('Anotar peso'));

await nav.close();

// ---- limpieza: la cuenta que creó, se la lleva ----
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});
const { error: eIn } = await s.auth.signInWithPassword({ email: correo, password: clave });
if (eIn) console.log(`\n(no se pudo entrar a borrar la cuenta: ${eIn.message})`);
else {
  const { error: eBorrar } = await s.rpc('eliminar_cuenta');
  if (eBorrar) console.log(`\n(no se borró la cuenta: ${eBorrar.message})`);
}

// ---- el informe ----
const NOMBRE = { 3: 'EXCEPCIÓN', 2: 'BASE', 1: 'consola' };
console.log('\n================ hallazgos ================');
if (hallazgos.length === 0) console.log('Ninguno. Todas las pantallas abrieron sin tirar nada.');
else {
  // Se juntan los repetidos: el mismo error en cada dibujado es UN problema.
  const juntos = new Map();
  for (const h of hallazgos) {
    const clave = h.grave + '|' + h.que;
    const y = juntos.get(clave);
    if (y) y.veces++;
    else juntos.set(clave, { ...h, veces: 1 });
  }
  [...juntos.values()]
    .sort((a, b) => b.grave - a.grave)
    .forEach((h) => {
      console.log(`\n[${NOMBRE[h.grave]}] en ${h.donde}${h.veces > 1 ? ` (×${h.veces})` : ''}`);
      console.log(`  ${h.que}`);
    });
}
console.log(`\nCapturas en ${SALIDA}`);
process.exit(0);
