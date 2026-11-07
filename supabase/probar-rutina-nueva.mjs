// «CREAR RUTINA NUEVA» GUARDA LO QUE SE ENTRENÓ (6/11, bug del gimnasio). El dueño cambió el
// viernes: hizo solo pecho y espalda, en otro orden y con un ejercicio propio nuevo, y tocó «Crear
// rutina nueva». La nueva quedaba con el orden y las series de la rutina, y con el curl, las
// elevaciones y el tríceps que no hizo. Y en Stats → Entrenamiento tardaba en aparecer.
//
// En la vista web de la nativa (:8090), con una cuenta descartable y su misma rutina para hoy: se
// mira Stats → Entrenamiento antes (queda montado atrás, con una rutina), se entrena como él, se
// termina y se toca «Crear rutina nueva».
//
//   node --env-file=.env.local supabase/probar-rutina-nueva.mjs
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pasarLaEntradaNativa, borrarCuentaDePrueba, limiteDeSonda } from './utiles.mjs';

limiteDeSonda(10);

const SALIDA = join(dirname(fileURLToPath(import.meta.url)), '..', 'capturas', 'rutina-nueva');
mkdirSync(SALIDA, { recursive: true });
const sello = Date.now().toString(36);
const correo = `agusconde20+ascent-rn-${sello}@gmail.com`;
const clave = `Rn-${sello}-Kp3`;
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
await s.from('profiles').update({ username: `rn_${sello.slice(-6)}` }).eq('id', uid);
const hoy = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'America/Montevideo' }).format(new Date()));
// Su viernes: pecho, espalda, hombros y brazos.
const delDia = [
  ['press_inclinado', 4], ['jalon', 4], ['pec_deck', 3], ['press_banca', 4], ['remo_maquina', 4],
  ['elevaciones_polea', 3], ['martillo', 3], ['triceps_polea', 3],
].map(([ejercicio, series]) => ({ ejercicio, series }));
const dias = Array.from({ length: 7 }, (_, d) => ({ descanso: false, ejercicios: d === hoy ? delDia : [{ ejercicio: 'sentadilla', series: 3 }] }));
const { error: eRutina } = await s.rpc('guardar_rutina', { p_id: null, p_nombre: 'Entrenamiento 1', p_dias: dias });
if (eRutina) console.log('  --   no se guardó la rutina: ' + eRutina.message);

// Lo que hizo, en su orden. El propio se crea en el medio de la sesión.
const PROPIO = 'Pull down machine';
const entreno = [['Press inclinado', 3], ['Jalón al pecho', 2], ['Press de banca', 3], ['Remo en máquina', 2], ['Peck deck', 1], [PROPIO, 2]];

console.log('«Crear rutina nueva» guarda lo que se entrenó');
const nav = await chromium.launch();
const page = await (await nav.newContext({ viewport: { width: 390, height: 900 }, locale: 'es-UY', timezoneId: 'America/Montevideo' })).newPage();
const texto = (t) => page.getByText(t, { exact: true }).last();
const chips = async () => (await page.getByTestId('rutina-elegir').filter({ visible: true }).allInnerTexts()).map((t) => t.trim());
// El selector se abre en el grupo del ejercicio de ahora (salvo los del DOTS): se vuelve hasta el buscador.
const alBuscador = async () => {
  const buscar = page.getByTestId('buscar-ejercicio').first();
  await page.waitForTimeout(800);
  for (let i = 0; i < 3 && !(await buscar.isVisible().catch(() => false)); i++) {
    await page.getByLabel('← Volver').filter({ visible: true }).first().click({ timeout: 10000 });
    await page.waitForTimeout(500);
  }
  return buscar;
};
try {
  await page.goto('http://localhost:8090', { waitUntil: 'domcontentloaded', timeout: 240000 });
  await pasarLaEntradaNativa(page);
  await page.locator('input[type=email], input[inputmode=email]').first().fill(correo, { timeout: 90000 });
  await page.locator('input[type=password]').first().fill(clave);
  await texto('Entrar').click({ timeout: 60000 });

  // Stats → Entrenamiento antes de entrenar: queda montado atrás, con una sola rutina.
  await page.getByRole('tab', { name: /^Stats/ }).first().click({ timeout: 120000 });
  await texto('Entrenamiento').click({ timeout: 60000 });
  await page.getByTestId('rutina-elegir').first().waitFor({ timeout: 60000 });
  chequear('antes: una rutina', await chips(), ['Entrenamiento 1']);
  await page.getByRole('tab', { name: /^Inicio/ }).first().click({ timeout: 30000 });

  await texto('Iniciar entrenamiento').click({ timeout: 120000 });
  await page.getByLabel('Sumar una serie').first().waitFor({ timeout: 90000 });
  await page.getByText(/^Press inclinado · /).first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(1500);
  const mas = page.getByLabel('Sumar una serie').first();
  for (const [k, [nombre, series]] of entreno.entries()) {
    if (k > 0) {
      await page.getByText(new RegExp(`^${entreno[k - 1][0]} · `)).first().click({ timeout: 30000 });
      await (await alBuscador()).fill(nombre, { timeout: 30000 });
      await page.waitForTimeout(800);
      if (nombre === PROPIO) {
        await texto(`+ Agregar «${PROPIO}»`).click({ timeout: 30000 });
        await page.getByTestId('crear-ejercicio').first().waitFor({ timeout: 15000 });
        await texto('Espalda').click({ timeout: 15000 });
        await page.getByTestId('crear-ejercicio-listo').first().click({ timeout: 15000 });
      } else await texto(nombre).click({ timeout: 30000 });
      // Con las series del anterior sin cerrar, la app pregunta de cuál eran: del anterior.
      const eranDe = texto(`Eran de ${entreno[k - 1][0]}`);
      if (await eranDe.waitFor({ timeout: 4000 }).then(() => true).catch(() => false)) await eranDe.click();
      await page.getByText(new RegExp(`^${nombre} · `)).first().waitFor({ timeout: 30000 });
      await page.waitForTimeout(600);
    }
    for (let i = 0; i < series; i++) {
      await mas.click();
      await page.waitForTimeout(1300);
    }
  }
  await page.waitForTimeout(1500);
  await texto('Terminar').click({ timeout: 30000 });
  await texto('Terminar').click({ timeout: 30000 });
  await page.getByTestId('ventana-rutina').first().waitFor({ timeout: 30000 });
  await page.screenshot({ path: join(SALIDA, 'ventana.png') });
  await page.getByTestId('ventana-rutina-nueva').first().click();
  await page.getByTestId('ventana-rutina').first().waitFor({ state: 'detached', timeout: 20000 });

  const propio = (await s.from('ejercicios').select('id').eq('nombre', PROPIO).maybeSingle()).data?.id ?? '?';
  const como = (lista) => (lista ?? []).map((e) => `${e.ejercicio === propio ? 'propio' : e.ejercicio}×${e.series}`);
  const esperado = ['press_inclinado×3', 'jalon×2', 'press_banca×3', 'remo_maquina×2', 'pec_deck×1', 'propio×2'];
  // Las series de la sesión, como quedaron en el historial.
  const { data: ses } = await s.from('sesiones').select('bloques').eq('estado', 'terminada');
  chequear('el historial tiene cada serie, en el orden en que se hizo', como(ses?.[0]?.bloques), esperado);
  const { data: rutinas } = await s.rpc('mis_rutinas');
  chequear('la nueva: hoy, lo que se entrenó, en su orden y con sus series, sin lo que no se hizo', [(rutinas ?? []).length, como(rutinas?.[1]?.dias?.[hoy]?.ejercicios)], [2, esperado]);
  chequear('la de antes sigue igual y activa; la nueva no se activa, y los otros días son una copia', [
    rutinas?.[0]?.activa, como(rutinas?.[0]?.dias?.[hoy]?.ejercicios).join(','), rutinas?.[1]?.activa,
    (rutinas?.[1]?.dias ?? []).every((d, i) => i === hoy || como(d.ejercicios).join(',') === 'sentadilla×3'),
  ], [true, delDia.map((e) => `${e.ejercicio}×${e.series}`).join(','), false, true]);

  // Stats → Entrenamiento estaba montado atrás desde antes de entrenar: la nueva ya tiene que estar.
  await page.waitForTimeout(3000);
  await page.getByRole('tab', { name: /^Stats/ }).first().click({ timeout: 30000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(SALIDA, 'entrenamiento.png') });
  chequear('en Stats → Entrenamiento ya están las dos, apenas se vuelve', await chips(), ['Entrenamiento 1', 'Entrenamiento 2']);
} catch (e) {
  fallos++;
  console.log('  FALLA ' + String(e).split('\n')[0].slice(0, 200));
  await page.screenshot({ path: join(SALIDA, 'error.png') }).catch(() => {});
}
await nav.close();

const { error: eBorrar } = await borrarCuentaDePrueba(s);
console.log(`  ${eBorrar ? 'FALLA' : 'ok  '} cuenta borrada${eBorrar ? ': ' + eBorrar.message : ''}`);
if (eBorrar) fallos++;
process.exit(fallos ? 1 : 0);
