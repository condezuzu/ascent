// ¿"QUITAR FOTO" QUITA LA FOTO? En las dos apps, con una foto hecha para eso.
//
// El camino no se había probado nunca en la app nativa: habría borrado una
// foto real de la cuenta de prueba (18/9). Esto CREA una foto de prueba —una
// imagen que dice "PRUEBA", subida a la carpeta de la cuenta y con su fila en
// `photos`, como la sube la app— y la quita desde la pantalla, como una
// persona: Álbum, abrirla, "Quitar foto", "¿Quitar?", "Sí".
//
// Y NO SE LE CREE A LA PANTALLA: después se pregunta a la base si la fila
// sigue y se LISTA la carpeta del bucket. `remove()` de Storage vuelve sin
// error aunque no haya borrado nada —si la política no lo deja, simplemente no
// encuentra el archivo—, así que "no dio error" no prueba nada.
//
// Si algo falla a la mitad, la foto de prueba se quita igual al final: la
// cuenta no puede quedar con basura de una prueba.
//
//   node --env-file=.env.local herramientas/probar-quitar-foto.mjs [--nativa] [--web]
//
// Sin flags prueba las dos. Necesita prendidas la nativa en :8090 y la web en
// :3020; no las levanta.
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { limiteDeSonda, pasarLaEntrada } from '../supabase/utiles.mjs';

// Ninguna sonda corre sin limite (ver utiles.mjs).
limiteDeSonda(10);

const ARGS = process.argv.slice(2);
const APPS = ['nativa', 'web'].filter((a) => ARGS.includes(`--${a}`) || !ARGS.some((x) => x.startsWith('--')));
const URLS = { nativa: 'http://localhost:8090', web: 'http://localhost:3020' };

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});
const { data: sesion, error: errEntrar } = await supabase.auth.signInWithPassword({
  email: process.env.CONEXION_EMAIL,
  password: process.env.CONEXION_PASSWORD,
});
if (errEntrar) {
  console.log('no pude entrar con la cuenta de prueba:', errEntrar.message);
  process.exit(1);
}
const uid = sesion.user.id;

const nav = await chromium.launch();

/** Una imagen de verdad, hecha en el navegador: fondo, la palabra PRUEBA y la app. */
async function imagenDePrueba(app) {
  const p = await nav.newPage();
  const datos = await p.evaluate((app) => {
    const c = document.createElement('canvas');
    c.width = c.height = 480;
    const x = c.getContext('2d');
    x.fillStyle = '#2a1f4a';
    x.fillRect(0, 0, 480, 480);
    x.fillStyle = '#f0e6c8';
    x.font = 'bold 72px sans-serif';
    x.textAlign = 'center';
    x.fillText('PRUEBA', 240, 230);
    x.font = '32px sans-serif';
    x.fillText(`quitar · ${app}`, 240, 290);
    return c.toDataURL('image/jpeg', 0.85);
  }, app);
  await p.close();
  return Buffer.from(datos.split(',')[1], 'base64');
}

async function crearFoto(app) {
  const ruta = `${uid}/prueba-quitar-${app}-${Date.now()}.jpg`;
  const { error: e1 } = await supabase.storage.from('fotos').upload(ruta, await imagenDePrueba(app), { contentType: 'image/jpeg' });
  if (e1) throw new Error(`no subió la foto de prueba: ${e1.message}`);
  const { data, error: e2 } = await supabase
    .from('photos')
    .insert({ user_id: uid, storage_path: ruta, visibilidad: 'privada' })
    .select('id')
    .single();
  if (e2) throw new Error(`no quedó la fila de la foto de prueba: ${e2.message}`);
  return { id: data.id, ruta };
}

/** Lo que dice la base de verdad: ¿sigue la fila? ¿sigue el archivo? */
async function queQueda(foto) {
  const { data: filas } = await supabase.from('photos').select('id').eq('id', foto.id);
  const nombre = foto.ruta.split('/').pop();
  const { data: archivos } = await supabase.storage.from('fotos').list(uid, { search: nombre });
  return { fila: (filas ?? []).length > 0, archivo: (archivos ?? []).some((a) => a.name === nombre) };
}

/** Las OTRAS fotos de la cuenta: tienen que seguir todas. Quitar la de prueba
 * no alcanza si de paso se llevó una real. */
async function lasDemas(foto) {
  const { data } = await supabase.from('photos').select('id').eq('user_id', uid).neq('id', foto.id);
  return (data ?? []).map((f) => f.id).sort().join(',');
}

async function limpiar(foto) {
  await supabase.storage.from('fotos').remove([foto.ruta]);
  await supabase.from('photos').delete().eq('id', foto.id);
}

async function entrar(page, app) {
  if (app === 'web') {
    await page.goto(URLS.web + '/login', { waitUntil: 'domcontentloaded', timeout: 120000 });
    await pasarLaEntrada(page);
    await page.locator('input[type=email]').fill(process.env.CONEXION_EMAIL);
    await page.locator('input[type=password]').fill(process.env.CONEXION_PASSWORD);
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 120000 });
    await page.goto(URLS.web + '/album', { waitUntil: 'domcontentloaded', timeout: 120000 });
  } else {
    await page.goto(URLS.nativa, { waitUntil: 'networkidle', timeout: 240000 });
    await page.locator('input[type=email], input[inputmode=email], input[autocomplete=email]').first().fill(process.env.CONEXION_EMAIL);
    await page.locator('input[type=password]').first().fill(process.env.CONEXION_PASSWORD);
    await page.getByText('Entrar', { exact: true }).last().click({ timeout: 60000 });
    await page.getByText('Álbum', { exact: true }).last().click({ timeout: 120000 });
  }
}

let fallas = 0;
for (const app of APPS) {
  const vivo = await fetch(URLS[app]).then(() => true, () => false);
  if (!vivo) {
    console.log(`${app}: no está prendida en ${URLS[app]}; no la pruebo`);
    fallas++;
    continue;
  }
  let foto = null;
  const page = await (await nav.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  try {
    foto = await crearFoto(app);
    const antes = await queQueda(foto);
    console.log(`${app}: foto de prueba creada (fila ${antes.fila ? 'sí' : 'NO'}, archivo ${antes.archivo ? 'sí' : 'NO'})`);
    if (!antes.fila || !antes.archivo) throw new Error('la foto de prueba no quedó creada entera');
    const demasAntes = await lasDemas(foto);

    await entrar(page, app);
    // La más nueva va primero: es la de prueba. Se abre la primera celda de la grilla.
    const celda = app === 'web' ? page.locator('.album-celda').first() : page.getByLabel(/\d/).filter({ has: page.locator('img') }).first();
    await celda.click({ timeout: 60000 });
    await page.getByText('Quitar foto', { exact: true }).last().click({ timeout: 30000 });
    await page.getByText('¿Quitar?', { exact: true }).last().waitFor({ timeout: 15000 });
    await page.getByText('Sí', { exact: true }).last().click({ timeout: 15000 });
    await page.waitForTimeout(3000);

    const despues = await queQueda(foto);
    const demasIntactas = (await lasDemas(foto)) === demasAntes;
    const ok = !despues.fila && !despues.archivo && demasIntactas;
    if (!ok) fallas++;
    console.log(
      `${app}: ${ok ? 'ok   ' : 'FALLA'} después de "Sí": fila ${despues.fila ? 'SIGUE' : 'quitada'}, archivo ${despues.archivo ? 'SIGUE' : 'quitado'}, las otras ${demasAntes.split(',').filter(Boolean).length} fotos ${demasIntactas ? 'intactas' : 'CAMBIARON'}`
    );
  } catch (e) {
    fallas++;
    console.log(`${app}: FALLA ${e.message.split('\n')[0]}`);
    await page.screenshot({ path: `capturas/quitar-foto-${app}.png` }).catch(() => {});
  } finally {
    if (foto) {
      const resto = await queQueda(foto);
      if (resto.fila || resto.archivo) {
        await limpiar(foto);
        console.log(`${app}: (la foto de prueba se quitó a mano para no dejar basura)`);
      }
    }
    await page.context().close();
  }
}

await nav.close();
console.log(fallas ? `\n${fallas} falla(s)` : '\nquitar foto anda en las dos apps, de verdad');
process.exit(fallas ? 1 : 0);
