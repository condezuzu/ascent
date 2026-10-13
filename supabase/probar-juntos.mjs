// ENTRENAR CON OTRO, contra Supabase real, con cuentas descartables.
//
// POR QUÉ EXISTE: la versión chica se hizo sin el "un solo dueño del estado" y
// salió sin que nadie la probara con dos teléfonos. Esto es lo más parecido que
// hay acá: dos cuentas, y —con la nativa prendida— dos navegadores, cada uno
// con la suya, recorriendo lo que recorren dos personas en el gimnasio.
//
//   1. Por la API: quién puede pedir, quién acepta, qué se ve y qué no, y que
//      terminar corta. Es la base de verdad, con sus permisos de verdad.
//   2. Por la pantalla (salvo con `api`): B inicia, A lo ve en Ranking y toca
//      "Unirse", a B le aparece el pedido en Inicio y acepta, B cuenta una
//      serie y A la ve; B termina y A deja de verlo. Y lo de B queda intacto.
//
//   node --env-file=.env.local supabase/probar-juntos.mjs [api]
import { createClient } from '@supabase/supabase-js';
import { limiteDeSonda, pasarLaEntradaNativa } from './utiles.mjs';

// Dos navegadores esperando a que el otro haga algo: si uno no llega, esto no
// puede quedar colgado para siempre. Ver la sección 123 de `test:db`.
limiteDeSonda(12);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const sello = Date.now().toString(36);
const soloApi = process.argv.includes('api');
let fallos = 0;
const chequear = (que, obtuve, esperaba) => {
  const bien = JSON.stringify(obtuve) === JSON.stringify(esperaba);
  console.log(`  ${bien ? 'ok  ' : 'FALLA'} ${que}${bien ? '' : ` — esperaba ${JSON.stringify(esperaba)}, obtuve ${JSON.stringify(obtuve)}`}`);
  if (!bien) fallos++;
};
const nota = (t) => console.log(`  --   ${t}`);

async function cuenta(letra) {
  const s = createClient(url, anon, { auth: { persistSession: false } });
  const correo = `agusconde20+ascent-juntos-${letra}-${sello}@gmail.com`;
  const clave = `Ju-${sello}-${letra}9`;
  const { error } = await s.auth.signUp({ email: correo, password: clave });
  if (error) throw new Error(`alta ${letra}: ${error.message}`);
  const id = (await s.auth.getUser()).data.user.id;
  const nombre = `jun_${letra}${sello.slice(-5)}`;
  await s.from('profiles').update({ username: nombre }).eq('id', id);
  return { s, id, correo, clave, nombre };
}

const { data: version } = await createClient(url, anon, { auth: { persistSession: false } }).rpc('version_del_esquema');
if (!(version >= 67)) {
  console.log(`  --   la base está en ${version}: sin la migración 67 no hay nada que probar`);
  process.exit(0);
}

const A = await cuenta('a');
const B = await cuenta('b');
const C = await cuenta('c'); // no es amiga de nadie
const uniones = async (x) => (await x.s.rpc('mis_uniones')).data ?? [];
const entrenando = async (x) => ((await x.s.rpc('entrenando_ahora')).data ?? []).map((e) => e.id);

try {
  const { data: pedido } = await A.s.from('friendships').insert({ solicitante: A.id, destinatario: B.id }).select('id').single();
  await B.s.from('friendships').update({ estado: 'aceptada' }).eq('id', pedido.id);

  console.log('\n1. Por la API');
  // ---- aparecer entrenando: solo con el aviso prendido, y solo para amigos ----
  // Desde la migración 68 nace prendido: se apaga a mano para probar que respeta el interruptor.
  // Desde la migración 72 la marca sola no alcanza: hace falta una sesión corriendo.
  await B.s.rpc('fijar_comparte_gimnasio', { p_valor: true });
  await B.s.rpc('marcar_en_gimnasio');
  if (version >= 72) chequear('marcado pero SIN sesión (adentro del gimnasio, sin entrenar), B no aparece', await entrenando(A), []);
  else nota(`la base está en ${version}: que la marca sin sesión no alcance (migración 72) no se probó`);
  await B.s.rpc('iniciar_sesion');
  await B.s.rpc('fijar_comparte_gimnasio', { p_valor: false });
  await B.s.rpc('marcar_en_gimnasio');
  chequear('sin "Avisar cuando entreno", B no aparece entrenando', await entrenando(A), []);
  await B.s.rpc('fijar_comparte_gimnasio', { p_valor: true });
  await B.s.rpc('marcar_en_gimnasio');
  chequear('con el aviso prendido, su amiga lo ve y una extraña no', [await entrenando(A), await entrenando(C)], [[B.id], []]);

  // ---- pedir y aceptar ----
  await C.s.rpc('pedir_unirse', { p_a: B.id });
  chequear('una extraña no puede pedir unirse', (await uniones(B)).length, 0);
  await A.s.rpc('pedir_unirse', { p_a: B.id });
  const pend = await uniones(B);
  chequear('a B le llega el pedido de A, sin nada a la vista todavía', pend.map((u) => [u.estado, u.la_pedi_yo, u.otro.id, u.en_vivo]), [['pendiente', false, A.id, null]]);
  await A.s.rpc('responder_union', { p_id: pend[0].id, p_acepta: true });
  chequear('quien pidió no se puede aceptar a sí mismo', (await uniones(A))[0]?.estado, 'pendiente');
  await B.s.rpc('responder_union', { p_id: pend[0].id, p_acepta: true });

  // ---- lo que se ve ----
  await B.s.rpc('publicar_en_vivo', { p_ejercicio: 'press_banca', p_serie: 2, p_meta: 4, p_descanso_faltan: 90 });
  const [deA] = await uniones(A);
  chequear('aceptado: A ve el ejercicio, la serie y la meta de B', [deA?.estado, deA?.en_vivo?.ejercicio, deA?.en_vivo?.serie, deA?.en_vivo?.meta], ['aceptada', 'press_banca', 2, 4]);
  const faltan = Math.round((new Date(deA?.en_vivo?.descanso_fin) - new Date(deA?.ahora)) / 1000);
  chequear('y cuánto le falta de descanso, contra el reloj de la base', faltan >= 86 && faltan <= 90, true);
  chequear('nada de pesos ni de duración', Object.keys(deA?.en_vivo ?? {}).sort(), ['actualizado', 'descanso_fin', 'ejercicio', 'meta', 'serie']);
  chequear('una extraña no ve nada', await uniones(C), []);
  const directo = await A.s.from('en_vivo').select('*');
  const directo2 = await A.s.from('entrenos_compartidos').select('*');
  chequear('las tablas no se leen directo, ni por una amiga', [directo.data ?? [], directo2.data ?? []], [[], []]);

  // ---- "su rutina" y la mejor racha ----
  chequear('B le muestra su rutina a su amiga, y a una extraña no', [(await A.s.rpc('me_muestra_su_rutina', { p_quien: B.id })).data, (await C.s.rpc('me_muestra_su_rutina', { p_quien: B.id })).data], [true, false]);
  await B.s.rpc('fijar_comparte_rutina', { p_valor: false });
  chequear('si la escondió, a la amiga le dice que no', (await A.s.rpc('me_muestra_su_rutina', { p_quien: B.id })).data, false);
  await B.s.rpc('fijar_comparte_rutina', { p_valor: true });
  const publico = (await A.s.from('usuarios_publicos').select('*').eq('id', B.id).single()).data ?? {};
  chequear('la vista pública trae la mejor racha', 'mejor_racha' in publico, true);

  // ---- terminar corta ----
  // Como en el teléfono: "Terminar" cierra la sesión y después corta lo demás.
  // Desde la 72, lo que saca de "Entrenando ahora" es que la sesión se cierre.
  await B.s.rpc('terminar_sesion');
  await B.s.rpc('dejar_de_entrenar');
  chequear('B termina: A deja de verlo unido y entrenando', [await uniones(A), await entrenando(A)], [[], []]);

  // ---- y corta también si la sesión se cierra por la base, sin que el teléfono avise (migración 68) ----
  if (version >= 68) {
    await B.s.rpc('iniciar_sesion');
    await B.s.rpc('marcar_en_gimnasio');
    await A.s.rpc('pedir_unirse', { p_a: B.id });
    await B.s.rpc('responder_union', { p_id: (await uniones(B))[0]?.id, p_acepta: true });
    await B.s.rpc('publicar_en_vivo', { p_ejercicio: 'sentadilla', p_serie: 1, p_meta: 3, p_descanso_faltan: null });
    chequear('unidos de nuevo, con una sesión de verdad', [(await uniones(A))[0]?.en_vivo?.ejercicio, await entrenando(A)], ['sentadilla', [B.id]]);
    await B.s.rpc('terminar_sesion');
    chequear('la sesión se cierra por la base (sin "dejar de entrenar") y A deja de verlo igual', [await uniones(A), await entrenando(A)], [[], []]);
    if (version >= 72) {
      await B.s.rpc('marcar_en_gimnasio');
      chequear('terminó y un teléfono sin actualizar lo vuelve a marcar por seguir adentro: no aparece', await entrenando(A), []);
    }
  } else nota(`la base está en ${version}: el corte al cerrarse la sesión (migración 68) no se probó`);

  if (soloApi) nota('sin navegador (api): la parte de la pantalla no se corrió');
  else {
    console.log('\n2. Por la pantalla: dos navegadores, cada uno con su cuenta');
    const { chromium } = await import('playwright');
    const nav = await chromium.launch();
    const errores = [];
    const entrar = async (quien) => {
      const page = await (await nav.newContext({ viewport: { width: 390, height: 844 } })).newPage();
      page.on('pageerror', (e) => errores.push(`${quien.nombre}: ${String(e).slice(0, 140)}`));
      await page.goto('http://localhost:8090', { waitUntil: 'domcontentloaded', timeout: 180000 });
      await pasarLaEntradaNativa(page);
      await page.locator('input[type=email], input[inputmode=email]').first().fill(quien.correo, { timeout: 90000 });
      await page.locator('input[type=password]').first().fill(quien.clave);
      await page.getByText('Entrar', { exact: true }).last().click({ timeout: 60000 });
      // La guía arranca sola en un navegador limpio y tapa la mitad de abajo.
      const saltar = page.getByTestId('recorrido-saltar');
      await saltar.waitFor({ state: 'visible', timeout: 60000 });
      await saltar.click();
      await page.waitForTimeout(800);
      return page;
    };
    const esperar = async (que, cosa, ms = 45000) => {
      const bien = await cosa.waitFor({ state: 'visible', timeout: ms }).then(() => true, () => false);
      chequear(que, bien, true);
      return bien;
    };
    try {
      await B.s.rpc('fijar_comparte_gimnasio', { p_valor: true });
      const pb = await entrar(B);
      const pa = await entrar(A);

      // B inicia a mano, sin gimnasio marcado: tiene que aparecer igual.
      await pb.getByText('Iniciar entrenamiento', { exact: true }).last().click({ timeout: 30000 });
      await pa.getByText('Ranking', { exact: true }).last().click();
      await esperar('B toca "Iniciar" (sin gimnasio marcado) y A lo ve entrenando en Ranking', pa.getByText(`${B.nombre} está entrenando`, { exact: true }).first());
      const unirse = pa.getByTestId('unirse').first();
      if (await esperar('y al lado tiene "Unirse"', unirse, 15000)) await unirse.click();
      await esperar('A queda esperando: "Pedido enviado"', pa.getByText('Pedido enviado', { exact: true }).first(), 15000);

      // A B le aparece en Inicio, que es donde está mirando.
      const pedidoEnInicio = pb.getByTestId('pedido-de-union').first();
      if (await esperar('a B le aparece el pedido en Inicio, sin salir de su entrenamiento', pedidoEnInicio)) {
        chequear('y dice quién es', /quiere unirse a tu entrenamiento/.test(await pedidoEnInicio.innerText()) && (await pedidoEnInicio.innerText()).includes(A.nombre), true);
        await pb.getByTestId('pedido-de-union-aceptar').first().click();
      }
      await esperar('A pasa a verlo en "Entrenando contigo"', pa.getByTestId('juntos-en-vivo').first());

      // B elige ejercicio y cuenta una serie.
      await pb.getByText('Cualquier cosa', { exact: true }).last().click({ timeout: 30000 });
      await pb.getByText('Press de banca', { exact: true }).last().click({ timeout: 30000 });
      await pb.waitForTimeout(1200);
      await pb.getByLabel('Sumar una serie').first().click({ timeout: 30000 });
      await esperar('B cuenta una serie de press de banca y A la ve', pa.getByText(/Press de banca · serie 1 de \d/).first());
      const conDescanso = await pa.getByText(/descansa \d/).first().waitFor({ state: 'visible', timeout: 15000 }).then(() => true, () => false);
      nota(conDescanso ? 'A ve además la cuenta del descanso de B' : 'A no vio la cuenta del descanso de B (puede no haber arrancado)');
      await pa.screenshot({ path: 'capturas/bateria/juntos-a-ranking.png' }).catch(() => {});
      await pb.screenshot({ path: 'capturas/bateria/juntos-b-inicio.png' }).catch(() => {});

      // LA PANTALLA DEL DESCANSO DE B (12/10): arriba lo que estaba haciendo, y
      // abajo, en chico, quien entrena con él.
      await pb.getByText(/^\d+:\d\d$/).last().click({ timeout: 15000 });
      await esperar('B abre su descanso: dice qué ejercicio y qué serie', pb.getByText('serie 1 de 3', { exact: true }).first(), 15000);
      const companero = pb.getByTestId('companero-en-descanso').first();
      if (await esperar('y abajo aparece A, que entrena con él', companero, 20000)) {
        chequear('con su nombre', (await companero.innerText()).includes(A.nombre), true);
      }
      await pb.screenshot({ path: 'capturas/bateria/juntos-b-descanso.png' }).catch(() => {});
      await pb.getByLabel('Cerrar').first().click({ timeout: 15000 });
      await pb.waitForTimeout(800);

      // DE UNA SOLA MANO: lo de B, en la base, es lo que B hizo.
      await pb.waitForTimeout(2500);
      const ses = (await B.s.from('sesiones').select('estado, series, bloques').eq('user_id', B.id)).data ?? [];
      chequear('lo de B quedó intacto: una sesión corriendo, una serie, de press de banca', ses.map((x) => [x.estado, x.series, (x.bloques ?? []).map((b) => [b.ejercicio, b.series])]), [['corriendo', 1, [['press_banca', 1]]]]);

      // B termina: A deja de verlo.
      await pb.getByText('Terminar', { exact: true }).last().click({ timeout: 30000 });
      await pb.getByText('Terminar', { exact: true }).last().click({ timeout: 30000 });
      const seFue = await pa.getByTestId('juntos-en-vivo').first().waitFor({ state: 'detached', timeout: 45000 }).then(() => true, () => false);
      chequear('B termina y A deja de verlo en "Entrenando contigo"', seFue, true);
      const yaNoEntrena = await pa.getByText(`${B.nombre} está entrenando`, { exact: true }).first().waitFor({ state: 'detached', timeout: 30000 }).then(() => true, () => false);
      chequear('y deja de figurar entrenando', yaNoEntrena, true);
      chequear('sin errores al dibujar', errores, []);
    } finally {
      await nav.close();
    }
  }
} catch (e) {
  console.log(`  REVENTÓ: ${String(e).split('\n')[0]}`);
  fallos++;
} finally {
  for (const X of [A, B, C]) {
    const { error } = await X.s.rpc('eliminar_cuenta');
    if (error) console.log(`  no se borró la cuenta ${X.nombre}: ${error.message}`);
  }
  console.log(fallos ? `\n${fallos} FALLA(s) en entrenar con otro.` : '\nEntrenar con otro: todo bien.');
  process.exit(fallos ? 1 : 0);
}
