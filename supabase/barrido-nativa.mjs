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
// Y LOS TRES ESTADOS DONDE APARECEN LOS BUGS DE VERDAD (24/9, a pedido). Una
// cuenta recién creada muestra cada pantalla en su versión más simple, que es
// justo la que no falla. Así que antes de recorrer nada, esto:
//
//   1. LE PONE DATOS: dos días, cuatro series, marcas en los tres del DOTS y un
//      peso corporal. Las pantallas pasan de "todavía no hay nada acá" a tener
//      gráficos, listas, medallas y un calendario con cosas adentro.
//   2. CORTA LA RED y recorre todo otra vez. Es el estado del gimnasio: sótano,
//      sin señal, y la app tiene que seguir andando con lo que tiene guardado.
//   3. DEJA UNA SESIÓN A MEDIO TERMINAR y recorre con ella viva. Es el otro
//      estado del gimnasio —el que más dura— y el que mete un cronómetro, una
//      cola de series sin subir y una hoja abierta en todas las demás pantallas.
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

const nuevoCliente = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });

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

/**
 * UNA VUELTA POR TODAS LAS PANTALLAS. Se corre una vez por estado —vacía, con
 * datos, sin red, con sesión viva— porque el mismo recorrido en dos estados
 * distintos es lo que separa "abre" de "abre con algo adentro".
 */
async function recorrerTodo(estado) {
  const con = (n) => `${estado} · ${n}`;

  for (const p of ['Ranking', 'Álbum', 'Stats', 'Ajustes', 'Inicio']) {
    await mirar(con(`pestaña ${p}`), () => texto(p).click({ timeout: 20000 }));
  }
  // Y DE NUEVO, que es donde aparecieron los dos bugs del fondo: volver a una
  // pestaña ya visitada no vuelve a montarla.
  for (const p of ['Ranking', 'Inicio', 'Stats', 'Inicio']) {
    await mirar(con(`volver a ${p}`), () => texto(p).click({ timeout: 20000 }));
  }

  await mirar(con('Stats'), () => texto('Stats').click());
  await mirar(con('Stats · Entrenamiento'), () =>
    page.getByRole('tab', { name: 'Entrenamiento' }).click({ timeout: 20000 })
  );
  await mirar(con('Stats · General'), () => page.getByRole('tab', { name: 'General' }).click({ timeout: 20000 }));

  await mirar(con('perfil propio'), async () => {
    await texto('Inicio').click();
    await page.waitForTimeout(600);
    // La fila del nombre es un boton entero: se toca por su etiqueta.
    await page.getByRole('button', { name: 'Tu perfil' }).last().click({ timeout: 20000 });
  });
  // El boton dice "← Volver": la flecha es parte del texto.
  await mirar(con('volver del perfil'), () => texto('Volver', false).click({ timeout: 20000 }));

  await mirar(con('Ajustes'), () => page.getByRole('tab', { name: 'Ajustes' }).click({ timeout: 20000 }));
  for (const sec of ['Diagnóstico', 'Cómo se compara', 'Mis datos']) {
    await mirar(con(`Ajustes · ${sec}`), () => tocarSiEsta(sec));
  }
  await mirar(con('Inicio'), () => texto('Inicio').click());
}

// ---- 1. VACÍA, que es como abre una cuenta nueva ----
await recorrerTodo('vacía');

// ---- 2. CON DATOS ----
//
// Una cuenta vacía muestra cada pantalla en su versión más simple, que es la
// que no falla. Se le ponen datos POR LA API y no por la pantalla: lo que se
// está probando es cómo se ven las pantallas llenas, no cómo se llenan.
const sumarDatos = async () => {
  const cli = nuevoCliente();
  const { error: e } = await cli.auth.signInWithPassword({ email: correo, password: clave });
  if (e) return anotar(2, `no se pudo entrar a sembrar datos — ${e.message}`);
  const uid = (await cli.auth.getUser()).data.user.id;

  // Un peso corporal y el sexo: sin los dos no hay percentil y no hay medallas.
  await cli.rpc('anotar_peso', { p_valor: 80 });
  await cli.from('profiles').update({ sexo: 'm' }).eq('id', uid);

  // Marcas en los tres del DOTS, arriba de la mitad: tres medallas.
  const hoy = new Date().toISOString().slice(0, 10);
  await cli.from('prs').insert([
    { user_id: uid, ejercicio: 'press_banca', peso: 110, reps: 1, es_real: true, fecha: hoy },
    { user_id: uid, ejercicio: 'sentadilla', peso: 150, reps: 1, es_real: true, fecha: hoy },
    { user_id: uid, ejercicio: 'peso_muerto', peso: 180, reps: 1, es_real: true, fecha: hoy },
  ]);

  // Dos días atrás, para que el calendario y la racha tengan algo.
  const ayer = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  await cli.rpc('registrar_dia', { p_fecha: ayer }).then(null, () => {});
  await cli.rpc('registrar_dia', {}).then(null, () => {});
};
await mirar('sembrar datos', sumarDatos);
await mirar('recargar con datos', async () => {
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(3500);
  await tocarSiEsta('Saltar');
});
await recorrerTodo('con datos');

// ---- 3. UNA SESIÓN A MEDIO TERMINAR ----
//
// Es el estado que más dura en un gimnasio: cronómetro corriendo, series en la
// cola y una hoja abierta, y todo eso vivo mientras se abre cualquier otra
// pantalla.
await mirar('sesión: iniciar', () => texto('Iniciar entrenamiento').click({ timeout: 20000 }));
await mirar('sesión: elegir ejercicio', async () => {
  await tocarSiEsta('Elegir ejercicio');
  await tocarSiEsta('Pecho');
  await tocarSiEsta('Press de banca');
});
// El `+` no tiene texto: se toca por su etiqueta.
const sumarSerie = async () => {
  const mas = page.getByLabel('Sumar una serie').last();
  if (await mas.isVisible().catch(() => false)) await mas.click({ timeout: 15000 });
};
await mirar('sesión: sumar una serie', sumarSerie);
await recorrerTodo('con sesión viva');

// ---- 4. SIN RED ----
//
// El sótano del gimnasio. La app tiene que seguir andando con lo que tiene
// guardado, y las series de la sesión viva tienen que quedar en la cola en vez
// de perderse.
await mirar('cortar la red', () => ctx.setOffline(true));
await mirar('sin red: sumar dos series', async () => {
  await texto('Inicio').click();
  await sumarSerie();
  await page.waitForTimeout(400);
  await sumarSerie();
});
await recorrerTodo('sin red');
await mirar('vuelve la red', async () => {
  await ctx.setOffline(false);
  // Lo que quedó en la cola sube solo: se le da tiempo antes de mirar.
  await page.waitForTimeout(6000);
});
await mirar('con la red de vuelta', () => texto('Inicio').click());

// ---- 5. CERRAR LA SESIÓN Y LAS HOJAS QUE CUELGAN ----
await mirar('sesión: terminar', async () => {
  await tocarSiEsta('Terminar');
  await page.waitForTimeout(1500);
});
await mirar('anotar el peso', () => tocarSiEsta('Anotar peso'));

await nav.close();

// ---- limpieza: la cuenta que creó, se la lleva ----
const s = nuevoCliente();
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
