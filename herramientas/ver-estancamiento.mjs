// VER EL AVISO DE ESTANCAMIENTO DIBUJADO, en las dos apps, con un dato hecho
// para eso.
//
// La cuenta de prueba no tiene ninguna señal, así que el aviso nunca se había
// visto en la app nativa (18/9). Esto FABRICA una: tres marcas de remo con
// barra —que no cuenta para el DOTS, así la fuerza de la cuenta no se mueve—,
// la última hace diez semanas. Con el umbral por omisión (6) eso es un
// "ejercicio dejado". Saca la foto de Stats en la web y en la nativa, y
// después DEJA LA CUENTA COMO ESTABA: borra esas marcas y comprueba que las
// marcas que quedan son exactamente las de antes. Si algo falla a la mitad,
// borra igual.
//
// Solo fabrica la señal de marcas. La de "la sesión que se achica" necesita
// ocho sesiones con sus días, y eso toca la racha y el calendario de la
// cuenta: no se fabrica.
//
//   node --env-file=.env.local herramientas/ver-estancamiento.mjs
//
// Necesita prendidas la web en :3020 y la nativa en :8090.
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { limiteDeSonda, pasarLaEntrada } from '../supabase/utiles.mjs';

// Ninguna sonda corre sin limite (ver utiles.mjs).
limiteDeSonda(10);

const EJERCICIO = 'remo_barra';
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

const marcasDeLaCuenta = async () => {
  const { data } = await supabase.from('prs').select('ejercicio, peso, reps, es_real, fecha').eq('user_id', uid);
  return JSON.stringify((data ?? []).map((m) => `${m.ejercicio}|${m.peso}|${m.reps}|${m.es_real}|${m.fecha}`).sort());
};
const haceDias = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Montevideo' });
};

const antes = await marcasDeLaCuenta();
const { data: puestas, error: errPoner } = await supabase
  .from('prs')
  .insert([
    { user_id: uid, ejercicio: EJERCICIO, peso: 40, reps: 5, es_real: false, fecha: haceDias(84) },
    { user_id: uid, ejercicio: EJERCICIO, peso: 42.5, reps: 5, es_real: false, fecha: haceDias(77) },
    { user_id: uid, ejercicio: EJERCICIO, peso: 42.5, reps: 5, es_real: false, fecha: haceDias(70) },
  ])
  .select('id');
if (errPoner) {
  console.log('no pude fabricar las marcas:', errPoner.message);
  process.exit(1);
}
console.log(`fabricadas ${puestas.length} marcas de ${EJERCICIO} (hace 12, 11 y 10 semanas)`);

const nav = await chromium.launch({
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--enable-unsafe-swiftshader=false'],
});
let fallas = 0;
try {
  for (const app of ['web', 'nativa']) {
    const page = await (await nav.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
    try {
      if (app === 'web') {
        await page.goto('http://localhost:3020/login', { waitUntil: 'domcontentloaded', timeout: 120000 });
        await pasarLaEntrada(page);
        await page.locator('input[type=email]').fill(process.env.CONEXION_EMAIL);
        await page.locator('input[type=password]').fill(process.env.CONEXION_PASSWORD);
        await page.getByRole('button', { name: 'Entrar', exact: true }).click();
        await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 120000 });
        await page.goto('http://localhost:3020/stats', { waitUntil: 'domcontentloaded', timeout: 120000 });
      } else {
        await page.goto('http://localhost:8090', { waitUntil: 'networkidle', timeout: 240000 });
        await page.locator('input[type=email], input[inputmode=email], input[autocomplete=email]').first().fill(process.env.CONEXION_EMAIL);
        await page.locator('input[type=password]').first().fill(process.env.CONEXION_PASSWORD);
        await page.getByText('Entrar', { exact: true }).last().click({ timeout: 60000 });
        // "La racha sigue" tapa Inicio a veces en esta cuenta (usó sus vidas).
        // "Entendido" solo la cierra: no escribe nada. "Guardarlas" sí, y no se toca.
        await page.waitForTimeout(4000);
        const entendido = page.getByText('Entendido', { exact: true });
        if (await entendido.count()) await entendido.last().click();
        await page.getByText('Stats', { exact: true }).last().click({ timeout: 120000 });
      }
      // El aviso dice el nombre del ejercicio: es lo que se espera.
      const aviso = page.getByText(/Remo con barra/i).first();
      await aviso.waitFor({ state: 'visible', timeout: 60000 });
      await page.waitForTimeout(2500);
      await page.screenshot({ path: `capturas/estancamiento-${app}.png` });
      console.log(`${app}: se ve — "${(await aviso.innerText()).replace(/\s+/g, ' ').slice(0, 160)}"`);
    } catch (e) {
      fallas++;
      console.log(`${app}: FALLA ${e.message.split('\n')[0]}`);
      await page.screenshot({ path: `capturas/estancamiento-${app}.png` }).catch(() => {});
    }
    await page.context().close();
  }
} finally {
  // LA CUENTA COMO ESTABA, pase lo que pase.
  await supabase.from('prs').delete().in('id', puestas.map((p) => p.id));
  const despues = await marcasDeLaCuenta();
  if (despues === antes) console.log('cuenta como estaba: las marcas son exactamente las de antes');
  else {
    fallas++;
    console.log('FALLA: las marcas de la cuenta NO son las de antes');
  }
  await nav.close();
}
process.exit(fallas ? 1 : 0);
