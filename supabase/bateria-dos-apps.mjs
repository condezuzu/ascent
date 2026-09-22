// LA MISMA BATERÍA EN LAS DOS APPS: la web (Next, :3020) y la nativa en el
// navegador (Expo web, :8090). Comparten el núcleo, así que cualquier número
// que dé distinto es un bug.
//
// UNA CUENTA NUEVA POR APP, creada por la pantalla, y el mismo guion:
//   crear cuenta → nombre → (web: recorrido y gimnasio) → Inicio vacío →
//   primer día con foto → sesión con press de banca a 60 → dos series con red,
//   dos SIN RED → vuelve la red y se termina al instante → "¿lo guardo como
//   marca?" → Stats.
//
// El paso de la red es el del bug del 15/9: terminar apenas vuelve la señal,
// con las series todavía en la cola. Si la app cierra antes de subirlas, la
// base ve una sesión corta sin series y BORRA EL DÍA.
//
// Al final se lee la base de las dos cuentas y se comparan. Y se limpia:
// archivos del bucket y cuenta.
//
//   node --env-file=.env.local supabase/bateria-dos-apps.mjs [web|movil|ambas]
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pasarLaEntrada, limiteDeSonda } from './utiles.mjs';

// Ninguna sonda corre sin limite (ver utiles.mjs).
limiteDeSonda(20);

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const SALIDA = join(RAIZ, 'capturas', 'bateria');
mkdirSync(SALIDA, { recursive: true });
const cuales = process.argv[2] ?? 'ambas';

const JPG = Buffer.from(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAAQABABAREA/8QAFgABAQEAAAAAAAAAAAAAAAAAAAYH/8QAIhAAAQMDBAMAAAAAAAAAAAAAAQIDBAAFEQYSITETQVH/2gAIAQEAAD8AmtN3G3Wy3SnJUdMmdIWlKEqT4hIPt2e8YqBqZt9zQiO+FNlK/GRwOST9P2v/2Q==',
  'base64'
);
// Una imagen de verdad: la del JPG de arriba es mínima y la web la rechaza al
// prepararla ("Esa foto no se pudo preparar"), que es correcto. Se usa una
// captura de la propia batería si ya hay una; si no, el JPG.
const archivoFoto = join(SALIDA, 'foto.jpg');
writeFileSync(archivoFoto, JPG);

const nuevoCliente = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });

const APPS = {
  web: { base: 'http://localhost:3020', viewport: { width: 390, height: 844 } },
  movil: { base: 'http://localhost:8090', viewport: { width: 390, height: 900 } },
};

async function correr(app) {
  const { base, viewport } = APPS[app];
  const sello = Date.now().toString(36);
  const correo = `agusconde20+ascent-bat-${app}-${sello}@gmail.com`;
  const clave = `Bt-${sello}-Kp3`;
  const usuario = `bat_${app.slice(0, 1)}${sello.slice(-6)}`;
  const problemas = [];
  const pasos = [];

  const nav = await chromium.launch();
  const ctx = await nav.newContext({
    viewport,
    locale: 'es-UY',
    timezoneId: 'America/Montevideo',
    permissions: ['geolocation'],
    geolocation: { latitude: -34.9011, longitude: -56.1645, accuracy: 25 },
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => problemas.push(`EXCEPCIÓN — ${String(e).slice(0, 180)}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource|ERR_INTERNET_DISCONNECTED|net::ERR/.test(m.text()))
      problemas.push(`consola — ${m.text().slice(0, 180)}`);
  });
  page.on('response', async (r) => {
    if (r.status() < 400 || !r.url().includes('supabase')) return;
    const cuerpo = await r.text().catch(() => '');
    problemas.push(`${r.status()} ${r.url().replace(/^https?:[/][/][^/]+/, '').slice(0, 70)} → ${cuerpo.slice(0, 120)}`);
  });

  const n = () => pasos.length + 1;
  let roto = false;
  async function paso(nombre, fn) {
    // Un paso que falla deja la pantalla en otro lado: seguir es juntar
    // timeouts que no dicen nada.
    if (roto) return;
    const t0 = Date.now();
    try {
      await fn();
      pasos.push({ nombre, ok: true });
      console.log(`  [${app}] ok   ${nombre} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
    } catch (e) {
      pasos.push({ nombre, ok: false });
      roto = true;
      const linea = String(e).split('\n')[0].slice(0, 200);
      console.log(`  [${app}] FALLA ${nombre} — ${linea}`);
      problemas.push(`paso "${nombre}": ${linea}`);
    }
    await page.screenshot({ path: join(SALIDA, `${app}-${String(n() - 1).padStart(2, '0')}-${nombre.replace(/\W+/g, '-')}.png`) }).catch(() => {});
  }
  const nota = (t) => console.log(`  [${app}] --   ${t}`);
  const texto = (t, exact = true) => page.getByText(t, { exact }).last();
  const tocar = async (t, exact = true) => {
    const l = app === 'web' ? page.getByRole('button', { name: t, exact }).last() : texto(t, exact);
    await l.click({ timeout: 60000 });
  };

  // ---- 1. crear la cuenta por la pantalla ----
  await paso('crear cuenta', async () => {
    await page.goto(app === 'web' ? `${base}/login` : base, { waitUntil: 'networkidle', timeout: 240000 });
    // La web muestra la pantalla de entrada antes del formulario (la nativa
    // todavía no): se pasa como pasaría alguien apurado.
    if (app === 'web') {
      await page.waitForTimeout(1500);
      await pasarLaEntrada(page);
    }
    // Hasta que la pantalla responda: un toque antes de que React tome la
    // página no hace nada.
    for (let i = 0; i < 60; i++) {
      await texto('¿Primera vez? Crear cuenta').click({ timeout: 240000 });
      if (await texto('Crear cuenta').isVisible().catch(() => false)) break;
      await page.waitForTimeout(1000);
    }
    await page.locator('input[type=email], input[inputmode=email], input[autocomplete=email]').first().fill(correo);
    await page.locator('input[type=password]').first().fill(clave);
    await tocar('Crear cuenta');
  });

  // ---- 2. el nombre ----
  await paso('elegir nombre', async () => {
    await texto('Elige tu nombre').waitFor({ timeout: 90000 });
    await page.locator('input').first().fill(usuario);
    await tocar('Empezar');
    await texto('Elige tu nombre').waitFor({ state: 'detached', timeout: 90000 });
  });

  // ---- 3. web: recorrido con el gimnasio primero ----
  if (app === 'web') {
    await paso('recorrido: marcar el gimnasio', async () => {
      await page.waitForURL((u) => u.pathname === '/ajustes', { timeout: 90000 });
      await page.getByRole('button', { name: 'Marcar el punto' }).click({ timeout: 90000 });
      await page.getByText(/precisión/i).first().waitFor({ timeout: 60000 });
    });
    await paso('recorrido: hasta el final', async () => {
      // Lejos del gimnasio: si no, el día entra solo por ubicación y la web
      // haría otro guion que la nativa (que todavía no tiene el automático).
      await ctx.setGeolocation({ latitude: -34.8, longitude: -56.0, accuracy: 25 });
      // El recorrido cambia de pantalla en cada paso: se sigue hasta que no esté.
      for (let i = 0; i < 12; i++) {
        const b = page.locator('.recorrido').getByRole('button', { name: /Siguiente|Listo/ });
        const hay = await b.first().waitFor({ timeout: 20000 }).then(() => true).catch(() => false);
        if (!hay) break;
        await b.first().click();
        await page.waitForTimeout(2500);
      }
      await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
    });
  }

  // ---- 4. Inicio vacío ----
  const fotoReal = join(SALIDA, `${app}-foto-real.jpg`);
  await paso('Inicio con la cuenta vacía', async () => {
    await texto('Registrar día').waitFor({ timeout: 120000 });
    // La foto de prueba: una captura de verdad, en JPEG.
    await page.screenshot({ path: fotoReal, type: 'jpeg', quality: 80 });
  });

  // ---- 5. la sesión CREA el día, con la red cortándose ----
  // Sin registrar antes: así el día lo crea la sesión, que es el único caso en
  // que la base puede deshacerlo al terminar (el bug del 15/9).
  await paso('iniciar la sesión (crea el día)', async () => {
    await tocar('Iniciar entrenamiento');
    await page.getByLabel('Sumar una serie').first().waitFor({ timeout: 90000 });
  });

  await paso('elegir press de banca, meta ×5 y peso 60', async () => {
    const chip = app === 'web' ? page.locator('.bloque-ejercicio') : texto('Cualquier cosa');
    await chip.first().click({ timeout: 60000 });
    await texto('Press de banca').click({ timeout: 60000 });
    await page.waitForTimeout(1500);
    // Con la meta de siempre (×3) el + se vuelve "Terminar serie" al llegar.
    await texto('×5').click({ timeout: 60000 });
    await page.waitForTimeout(800);
    const campo = page.getByLabel('Peso de las próximas series').first();
    await campo.fill('60', { timeout: 60000 });
    await campo.press('Enter');
    await campo.blur();
    await page.waitForTimeout(1500);
  });

  // La base, leída con la misma cuenta mientras la app corre.
  const espia = nuevoCliente();
  const seriesEnLaBase = async () => {
    if (!(await espia.auth.getSession()).data.session) {
      await espia.auth.signInWithPassword({ email: correo, password: clave });
    }
    const { data } = await espia.from('sesiones').select('series').eq('estado', 'corriendo');
    return data?.[0]?.series ?? null;
  };

  // SIN RED Y SIN TOCAR NADA DESPUÉS (15/9): la señal vuelve con el teléfono
  // en el banco. Las series tienen que subir solas; antes esperaban al
  // próximo toque, y una sesión sin actividad subida se cierra sin duración.
  await paso('dos series sin red; vuelve la red y suben SOLAS', async () => {
    const mas = page.getByLabel('Sumar una serie').first();
    await page.waitForTimeout(2500);
    await ctx.setOffline(true);
    for (let i = 0; i < 2; i++) {
      await mas.click();
      await page.waitForTimeout(900);
    }
    await page.waitForTimeout(1500);
    await ctx.setOffline(false);
    const t0 = Date.now();
    let n = null;
    while (Date.now() - t0 < 120000) {
      n = await seriesEnLaBase();
      if (n === 2) break;
      await new Promise((r) => setTimeout(r, 2000));
    }
    if (n !== 2) throw new Error(`a los 2 minutos la base tiene ${n} series, esperaba 2`);
    nota(`subieron solas en ${Math.round((Date.now() - t0) / 1000)} s`);
  });

  // Y el cierre con lo último todavía en la cola: Terminar tiene que subirlo
  // antes de cerrar.
  await paso('dos más sin red; vuelve la red y se termina al instante', async () => {
    const mas = page.getByLabel('Sumar una serie').first();
    await ctx.setOffline(true);
    for (let i = 0; i < 2; i++) {
      await mas.click();
      await page.waitForTimeout(900);
    }
    await ctx.setOffline(false);
    await tocar('Terminar');
    await tocar('Terminar'); // la confirmación
    await page.getByText(/Listo por hoy/i).first().waitFor({ timeout: 60000 });
  });

  // ---- 6. la primera marca, desde la pregunta ----
  await paso('¿lo guardo como marca? → 5 repeticiones', async () => {
    await page.getByText(/La guardo como marca/i).first().waitFor({ timeout: 60000 });
    nota((await page.getByText(/La guardo como marca/i).first().innerText()).replace(/\n/g, ' '));
    await texto('5').click();
    await page.waitForTimeout(4000);
    // Cerrar el resumen tocándolo.
    await page.getByText(/Listo por hoy/i).first().click();
    await page.waitForTimeout(2000);
  });

  // ---- 7. la primera foto, sumada al día que creó la sesión ----
  await paso('primera foto, al día ya registrado', async () => {
    if (app === 'web') {
      await page.getByRole('button', { name: 'Foto' }).first().click({ timeout: 60000 });
      await page.locator('.hoja input[type=file]').setInputFiles(fotoReal);
      await page.waitForTimeout(1000);
      await page.locator('.hoja').getByRole('button', { name: 'Guardar' }).click();
      await page.locator('.hoja').waitFor({ state: 'detached', timeout: 60000 });
    } else {
      // "Agregar foto" hasta el 22/9. Ahora la nativa dice "Foto", igual que la
      // web: era un renglon de texto que no parecia un boton, y eran dos
      // nombres para lo mismo.
      await texto('Foto').click({ timeout: 60000 });
      const [elegidor] = await Promise.all([page.waitForEvent('filechooser', { timeout: 60000 }), texto('Elegir de la galería', false).click()]);
      await elegidor.setFiles(fotoReal);
      await page.waitForTimeout(2000);
      await texto('Guardar').click();
      await texto('Sumar al día').waitFor({ state: 'detached', timeout: 60000 });
    }
    await page.waitForTimeout(3000);
  });

  // ---- 8. Stats ----
  let stats = '';
  await paso('Stats → Entrenamiento', async () => {
    if (app === 'web') await page.goto(`${base}/stats`, { waitUntil: 'networkidle' });
    else await texto('Stats').click();
    const pestana = page.getByRole('tab', { name: 'Entrenamiento' });
    await pestana.waitFor({ timeout: 90000 });
    for (let i = 0; i < 30 && !(await page.getByText(/Peso máximo por ejercicio/i).first().isVisible().catch(() => false)); i++) {
      await pestana.click();
      await page.waitForTimeout(1500);
    }
    await page.getByText(/Peso máximo por ejercicio/i).first().waitFor({ timeout: 30000 });
    await page.waitForTimeout(2500);
    stats = (await page.locator('body').innerText()).replace(/\n+/g, ' | ');
  });

  await nav.close();

  // ---- la base, leída con la cuenta ----
  const s = nuevoCliente();
  const { error: eIn } = await s.auth.signInWithPassword({ email: correo, password: clave });
  let base_ = null;
  if (eIn) problemas.push('no se pudo entrar a leer la base: ' + eIn.message);
  else {
    const uid = (await s.auth.getUser()).data.user.id;
    const [p, logs, ses, fotos, prs, gim] = await Promise.all([
      s.from('profiles').select('racha_actual, rango_actual, username, gimnasio_lat').eq('id', uid).single(),
      s.from('logs').select('fecha, origen').eq('user_id', uid),
      s.from('sesiones').select('estado, series, bloques, creo_el_dia').eq('user_id', uid),
      s.from('photos').select('storage_path, log_id').eq('user_id', uid),
      s.from('prs').select('ejercicio, peso, reps').eq('user_id', uid),
      s.storage.from('fotos').list(uid),
    ]);
    base_ = {
      racha: p.data?.racha_actual,
      dias: logs.data?.length,
      sesiones: ses.data?.map((x) => ({ estado: x.estado, series: x.series, bloques: x.bloques, creo: x.creo_el_dia })),
      fotos: fotos.data?.length,
      fotosColgadas: fotos.data?.filter((f) => f.log_id).length,
      archivos: gim.data?.length,
      marcas: prs.data,
      gimnasio: p.data?.gimnasio_lat !== null && p.data?.gimnasio_lat !== undefined,
    };
    // limpieza
    const rutas = (gim.data ?? []).map((o) => `${uid}/${o.name}`);
    if (rutas.length) await s.storage.from('fotos').remove(rutas);
    const { error: eBorrar } = await s.rpc('eliminar_cuenta');
    if (eBorrar) problemas.push('no se borró la cuenta: ' + eBorrar.message);
  }
  return { app, correo, pasos, problemas, base: base_, stats };
}

const resultados = [];
for (const app of cuales === 'ambas' ? ['web', 'movil'] : [cuales]) {
  console.log(`\n=== ${app} ===`);
  resultados.push(await correr(app));
}

for (const r of resultados) {
  console.log(`\n--- ${r.app}: ${r.pasos.filter((p) => p.ok).length}/${r.pasos.length} pasos`);
  console.log('BASE:', JSON.stringify(r.base));
  const trozo = r.stats.slice(r.stats.search(/SERIES POR MÚSCULO|Series por músculo/i), r.stats.search(/SERIES POR MÚSCULO|Series por músculo/i) + 500);
  console.log('STATS:', trozo);
  if (r.problemas.length) console.log('PROBLEMAS:\n - ' + [...new Set(r.problemas)].join('\n - '));
}
if (resultados.length === 2) {
  const [a, b] = resultados.map((r) => r.base);
  const campos = ['racha', 'dias', 'fotos', 'fotosColgadas', 'archivos'];
  for (const c of campos) {
    if (JSON.stringify(a?.[c]) !== JSON.stringify(b?.[c])) console.log(`DISTINTO ${c}: web=${JSON.stringify(a?.[c])} movil=${JSON.stringify(b?.[c])}`);
  }
  const ses = (x) => JSON.stringify(x?.sesiones?.map((s) => [s.estado, s.series, s.bloques]));
  if (ses(a) !== ses(b)) console.log(`DISTINTO sesiones:\n  web=${ses(a)}\n  movil=${ses(b)}`);
}
