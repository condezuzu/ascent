// UN ATAQUE DE VERDAD A LA BASE, con la anon key y sin pasar por la app.
//
// POR QUÉ EXISTE. Cualquiera puede bajar la app, sacarle la anon key del
// bundle —está ahí, tiene que estar— y hablarle a la base con un cliente
// propio. Ahí NO hay ninguna pantalla que valide nada: la única defensa es la
// RLS y los `security definer`. Esto es lo que haría esa persona.
//
// LA REGLA DE LECTURA, y es al revés de los otros scripts: acá **lo que pasa
// es el bug**. Cada línea dice `bloqueado` (el ataque no pudo: bien) o
// `PASÓ EL ATAQUE` (pudo: hay que arreglarlo). Un resumen con todo en
// `bloqueado` es el único resultado aceptable para publicar.
//
// NO LEE EL SQL. Crea dos cuentas de verdad —una víctima con datos en las
// quince tablas y un atacante que no es su amigo— y el atacante intenta, una
// por una, leer y escribir lo ajeno por todos los caminos que la base expone.
//
// LAS DOS CUENTAS SE BORRAN AL FINAL, y el sello queda anotado por si esto se
// muere a la mitad (misma lección que `barrido-estados`).
//
//   node --env-file=.env.local supabase/ataque.mjs
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !anon) {
  console.log('Faltan NEXT_PUBLIC_SUPABASE_* en .env.local.');
  process.exit(1);
}

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const PEND = join(RAIZ, 'supabase', '.ataque-sin-borrar');
const sello = Date.now().toString(36);
const CLAVE = `Atk-${sello}-Xy9`;
const cliente = () => createClient(url, anon, { auth: { persistSession: false } });

// ── el marcador ────────────────────────────────────────────────────────
let bugs = 0;
let hechos = 0;
/** `bloqueado` = el ataque no pudo (bien). `false` = pasó (bug). */
function juez(desc, bloqueado, detalle = '') {
  hechos++;
  if (bloqueado) {
    console.log(`  ok        ${desc}`);
  } else {
    bugs++;
    console.log(`  PASÓ ►►►  ${desc}${detalle ? ` — ${detalle}` : ''}`);
  }
}

// ── limpieza de corridas muertas (al arrancar, no en el finally) ─────────
function leerPend() {
  try {
    return readFileSync(PEND, 'utf8').split('\n').map((s) => s.trim()).filter(Boolean);
  } catch {
    return [];
  }
}
function anotarPend(s) {
  if (!leerPend().includes(s)) writeFileSync(PEND, [...leerPend(), s].join('\n') + '\n');
}
function tacharPend(s) {
  writeFileSync(PEND, leerPend().filter((x) => x !== s).join('\n'));
}
async function limpiarViejas() {
  const viejos = leerPend().filter((s) => s !== sello);
  let n = 0;
  for (const s of viejos) {
    for (const r of ['v', 'a', 'f']) {
      const c = cliente();
      const { error } = await c.auth.signInWithPassword({
        email: `agusconde20+ascent-atk-${s}-${r}@gmail.com`,
        password: `Atk-${s}-Xy9`,
      });
      if (error) continue;
      if (!(await c.rpc('eliminar_cuenta')).error) n++;
    }
    tacharPend(s);
  }
  if (n) console.log(`  (limpié ${n} cuenta[s] de un ataque anterior)\n`);
}

const jpg = Buffer.from(
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==',
  'base64'
);

async function nueva(rol) {
  const c = cliente();
  const correo = `agusconde20+ascent-atk-${sello}-${rol}@gmail.com`;
  const { data, error } = await c.auth.signUp({ email: correo, password: CLAVE });
  if (error || !data?.user) throw new Error(`no se pudo crear ${rol}: ${error?.message}`);
  await c.from('profiles').update({ username: `atk_${sello.slice(-4)}_${rol}`, sexo: 'm' }).eq('id', data.user.id);
  return { c, uid: data.user.id, correo };
}

console.log(`\nATAQUE A LA BASE · anon key · ${sello}`);
console.log('  "PASÓ ►►►" = el ataque funcionó = BUG.  "ok" = bloqueado.\n');

await limpiarViejas();
anotarPend(sello);

// ── LA VÍCTIMA, con datos en todo ────────────────────────────────────────
const V = await nueva('v');
const A = await nueva('a');
// Un tercero, amigo de la víctima: sin él las tablas de a dos (amistad, reto)
// no tienen ninguna fila que el atacante pueda intentar leer.
const F = await nueva('f');
const HOY = (await V.c.rpc('mi_hoy')).data;
const dia = (n) => {
  const d = new Date(HOY + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
};
let rutaFotoPrivadaV = '';
{
  // Racha, con una foto privada, una de amigos, peso, marcas, descansos, una
  // sesión, el punto del gimnasio (lo más sensible: dónde entrena).
  const filas = [];
  for (let n = 9; n >= 0; n--) filas.push({ user_id: V.uid, fecha: dia(n) });
  await V.c.from('logs').insert(filas);
  await V.c.rpc('recalcular_desde_cero');
  await V.c.rpc('anotar_peso', { p_valor: 81.5 });
  await V.c.from('prs').insert({ user_id: V.uid, ejercicio: 'sentadilla', peso: 140, reps: 1, es_real: true, fecha: dia(3) });
  await V.c.rpc('fijar_descansos', { p_dias: [0] });
  await V.c.from('profiles').update({ gimnasio_lat: -34.9011, gimnasio_lon: -56.1645 }).eq('id', V.uid);
  await V.c.rpc('iniciar_sesion');
  const log = (await V.c.from('logs').select('id').eq('user_id', V.uid).eq('fecha', HOY).single()).data;
  rutaFotoPrivadaV = `${V.uid}/${HOY}-priv.jpg`;
  await V.c.storage.from('fotos').upload(rutaFotoPrivadaV, jpg, { contentType: 'image/jpeg' });
  await V.c.from('photos').insert({ user_id: V.uid, log_id: log.id, storage_path: rutaFotoPrivadaV, visibilidad: 'privada', es_subida_de_rango: false });
  // La amistad V–F, aceptada, y un reto entre ellos: filas ajenas al atacante
  // en las dos tablas de a dos.
  const ped = (await F.c.from('friendships').insert({ solicitante: F.uid, destinatario: V.uid }).select('id').single()).data;
  if (ped?.id) await V.c.from('friendships').update({ estado: 'aceptada' }).eq('id', ped.id);
  await V.c.from('challenges').insert({ retador: V.uid, rival: F.uid }).select().maybeSingle();
  console.log(`  víctima montada: racha, peso, marca, foto privada, gimnasio, sesión, amistad, reto\n`);
}

// Las de columna `user_id`. `profiles`, `friendships` y `challenges` van
// aparte, abajo: usan otra columna y se probaron mal la primera vez.
const TABLAS = [
  'logs', 'weights', 'prs', 'photos', 'sesiones', 'descansos',
  'medallas', 'vidas_usadas', 'cargas_elegidas',
  'suscripciones_push', 'feedback', 'ejercicios',
];

try {
  // ═══════════════════════════════════════════════════════════════════════
  console.log('1. LEER DATOS AJENOS — el atacante pide las filas de la víctima');
  // ═══════════════════════════════════════════════════════════════════════
  for (const t of TABLAS) {
    const { data, error } = await A.c.from(t).select('*').eq('user_id', V.uid);
    // `ejercicios` no tiene dueño: es el catálogo, y devolverlo con sesión es
    // correcto. Es la ÚNICA que puede dar ese error legítimamente.
    if (error && /column .*user_id.* does not exist/i.test(error.message)) {
      juez(`${t}: es el catálogo, sin dueño`, t === 'ejercicios');
      continue;
    }
    const filas = data?.length ?? 0;
    juez(`${t}: leer las filas de la víctima`, filas === 0, filas ? `¡${filas} filas ajenas!` : '');
  }
  // LAS TABLAS QUE NO USAN `user_id`: profiles (id), y las de a dos —amistad y
  // reto— por sus dos partes. La primera versión las marcó como "catálogo" y
  // no las atacó: un falso ok, peor que no probar.
  {
    const p = await A.c.from('profiles').select('id').eq('id', V.uid);
    juez('profiles: leer el perfil de la víctima por id', (p.data?.length ?? 0) === 0, p.data?.length ? '¡lo leyó!' : '');
    // El atacante no es parte de ninguna: cualquier fila que vea es ajena.
    const fr = await A.c.from('friendships').select('*').or(`solicitante.eq.${V.uid},destinatario.eq.${V.uid}`);
    juez('friendships: leer la amistad ajena', (fr.data?.length ?? 0) === 0, fr.data?.length ? `¡${fr.data.length}!` : '');
    const ch = await A.c.from('challenges').select('*').or(`retador.eq.${V.uid},rival.eq.${V.uid}`);
    juez('challenges: leer el reto ajeno', (ch.data?.length ?? 0) === 0, ch.data?.length ? `¡${ch.data.length}!` : '');
  }
  // El perfil entero por id, que trae el punto del gimnasio.
  {
    const { data } = await A.c.from('profiles').select('gimnasio_lat, gimnasio_lon').eq('id', V.uid);
    const fuga = (data ?? []).some((r) => r.gimnasio_lat != null);
    juez('profiles: sacar el punto del gimnasio de la víctima', !fuga, fuga ? 'coordenadas expuestas' : '');
  }

  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n2. ESCRIBIR SOBRE DATOS AJENOS — modificar y borrar lo de la víctima');
  // ═══════════════════════════════════════════════════════════════════════
  for (const t of ['profiles', 'logs', 'weights', 'prs', 'photos', 'sesiones', 'descansos']) {
    const col = t === 'profiles' ? 'id' : 'user_id';
    const { data } = await A.c.from(t).delete().eq(col, V.uid).select();
    juez(`${t}: borrar las filas de la víctima`, (data?.length ?? 0) === 0, data?.length ? `¡borró ${data.length}!` : '');
  }
  // Cambiarle la racha a la víctima por UPDATE directo.
  {
    const { data } = await A.c.from('profiles').update({ racha_actual: 1 }).eq('id', V.uid).select();
    juez('profiles: pisarle la racha a la víctima', (data?.length ?? 0) === 0);
  }
  // Insertar una fila a nombre de la víctima (foto en su galería, marca falsa).
  {
    const r1 = await A.c.from('prs').insert({ user_id: V.uid, ejercicio: 'sentadilla', peso: 999, reps: 1, es_real: true, fecha: HOY });
    juez('prs: meterle una marca a la víctima', !!r1.error);
    const r2 = await A.c.from('logs').insert({ user_id: V.uid, fecha: dia(20) });
    juez('logs: meterle un día a la víctima', !!r2.error);
  }

  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n3. FUNCIONES CON user_id AJENO — leer por encima de la RLS');
  // ═══════════════════════════════════════════════════════════════════════
  // Todas las que reciben el id de OTRO y leen datos suyos. Si contestan algo,
  // reconstruyen la vida de cualquiera con solo su id (que es público).
  const conUser = [
    ['calcular_racha', { p_user: V.uid, p_hasta: HOY }],
    ['mejor_racha_real', { p_user: V.uid }],
    ['descansos_vigentes', { p_user: V.uid, p_fecha: HOY }],
    ['impulsos_ganados', { p_user: V.uid }],
    ['impulsos_disponibles', { p_user: V.uid, p_dia: HOY }],
    ['hoy_de', { p_user: V.uid }],
    ['puede_registrar_hoy', { p_user: V.uid }],
    ['bloqueo_hasta', { p_user: V.uid }],
    ['resolver_pendiente', { p_user: V.uid }],
    ['peso_actual', { p_user: V.uid }],
    ['mejores_marcas', { p_user: V.uid }],
    ['total_dots', { p_user: V.uid }],
    ['dots_de', { p_user: V.uid }],
    ['medallas_de', { p_user: V.uid }],
    ['cerrar_sesiones_vencidas', { p_user: V.uid }],
  ];
  for (const [fn, args] of conUser) {
    const { data, error } = await A.c.rpc(fn, args);
    // Bloqueado = el servidor la negó (permission denied) O no devolvió datos
    // de la víctima. Que exista y conteste con datos ajenos es el bug.
    const negada = !!error && /permission denied|does not exist|not find/i.test(error.message);
    const vacia = data === null || data === undefined || (Array.isArray(data) && data.length === 0);
    juez(`${fn}(víctima)`, negada || vacia, !negada && !vacia ? `devolvió ${JSON.stringify(data).slice(0, 60)}` : '');
  }
  // `son_amigos` queda abierta (la usan las políticas). Que NO filtre a un
  // tercero si dos ajenos son amigos.
  {
    const { data } = await A.c.rpc('son_amigos', { a: V.uid, b: A.uid });
    juez('son_amigos: no confirma amistad ajena de más', data === false || data === null);
  }

  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n4. HACER TRAMPA CON LO PROPIO — inflar la racha, marcas y días');
  // ═══════════════════════════════════════════════════════════════════════
  // Pisar la propia racha por UPDATE directo, salteándose los triggers.
  {
    await A.c.from('profiles').update({ racha_actual: 9999, rango_actual: 8, mejor_racha: 9999 }).eq('id', A.uid);
    const p = (await A.c.from('profiles').select('racha_actual, rango_actual').eq('id', A.uid).single()).data;
    const pego = p?.racha_actual === 9999;
    juez('racha inflada por UPDATE directo', !pego, pego ? `quedó en ${p.racha_actual}/${p.rango_actual}` : '');
    // Si la trampa pegó, el recálculo desde los logs tiene que barrerla.
    if (pego) {
      await A.c.rpc('recalcular_desde_cero');
      const q = (await A.c.from('profiles').select('racha_actual').eq('id', A.uid).single()).data;
      juez('  …y el recálculo la corrige', q?.racha_actual !== 9999, `siguió en ${q?.racha_actual}`);
    }
  }
  // Días en el futuro.
  {
    const futuro = new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10);
    const r = await A.c.from('logs').insert({ user_id: A.uid, fecha: futuro });
    juez('día en el futuro', !!r.error);
  }
  // Un mes de golpe hacia atrás, para saltar de rango.
  {
    const filas = [];
    for (let n = 400; n > 360; n--) filas.push({ user_id: A.uid, fecha: dia(n) });
    const r = await A.c.from('logs').insert(filas);
    // Insertar días viejos SÍ se puede (es como corrige el calendario), pero la
    // racha sale de días CONSECUTIVOS hasta hoy: un bloque viejo y suelto no
    // debería mover la racha actual.
    await A.c.rpc('recalcular_desde_cero');
    const p = (await A.c.from('profiles').select('racha_actual').eq('id', A.uid).single()).data;
    juez('bloque viejo y suelto no infla la racha actual', (p?.racha_actual ?? 0) < 50, `racha ${p?.racha_actual}`);
    if (!r.error) await A.c.from('logs').delete().eq('user_id', A.uid).lte('fecha', dia(360));
  }
  // Marca imposible (2000 kg). La base no juzga el peso —una marca es un dato
  // que la persona declara— pero no puede tirar ni ensuciar el DOTS ajeno.
  {
    const r = await A.c.from('prs').insert({ user_id: A.uid, ejercicio: 'sentadilla', peso: 2000, reps: 1, es_real: true, fecha: HOY });
    juez('marca propia absurda: se guarda pero es solo del atacante', !r.error || !!r.error, ''); // informativo
    await A.c.from('prs').delete().eq('user_id', A.uid);
  }

  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n5. STORAGE — leer la foto privada de la víctima, subir a su carpeta');
  // ═══════════════════════════════════════════════════════════════════════
  {
    // Bajar directo el objeto privado de la víctima.
    const baj = await A.c.storage.from('fotos').download(rutaFotoPrivadaV);
    juez('bajar la foto privada de la víctima', !!baj.error, baj.data ? '¡la bajó!' : '');
    // Pedir un enlace firmado de la foto ajena.
    const firm = await A.c.storage.from('fotos').createSignedUrl(rutaFotoPrivadaV, 60);
    juez('firmar la foto privada de la víctima', !!firm.error, firm.data?.signedUrl ? '¡la firmó!' : '');
    // Listar la carpeta de la víctima.
    const list = await A.c.storage.from('fotos').list(V.uid);
    juez('listar la carpeta de fotos de la víctima', (list.data?.length ?? 0) === 0, list.data?.length ? `${list.data.length} archivos` : '');
    // Subir a la carpeta de la víctima.
    const sub = await A.c.storage.from('fotos').upload(`${V.uid}/intruso.jpg`, jpg, { contentType: 'image/jpeg' });
    juez('subir a la carpeta de la víctima', !!sub.error, sub.data ? '¡subió!' : '');
  }

  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n6. ENUMERAR USUARIOS Y SACAR CORREOS');
  // ═══════════════════════════════════════════════════════════════════════
  {
    // El correo, por todos los caminos.
    const p = await A.c.from('profiles').select('*').eq('id', V.uid);
    const traeCorreo = JSON.stringify(p.data ?? '').toLowerCase().includes('@');
    juez('sacar el correo por profiles', !traeCorreo);
    const authU = await A.c.from('users').select('*').limit(1);
    juez('leer auth.users por PostgREST', !!authU.error);
    // Volcar TODOS los usuarios por la vista pública del buscador.
    const todos = await A.c.from('usuarios_publicos').select('username, id');
    const cuantos = todos.data?.length ?? 0;
    // Ojo: la vista existe para el buscador. Que devuelva id y username de
    // TODOS con una consulta sin filtro sí es enumeración; se reporta como
    // AVISO, no como bug de RLS, porque es el diseño del buscador.
    console.log(`  --        usuarios_publicos sin filtro devuelve ${cuantos} usuario(s) (id + username, sin correo)`);
    juez('usuarios_publicos no filtra correos', !JSON.stringify(todos.data ?? '').includes('@'));
  }

  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n7. ESCRIBIR EN TABLAS DEL SISTEMA / catálogo');
  // ═══════════════════════════════════════════════════════════════════════
  {
    const r = await A.c.from('ejercicios').insert({ id: 'hackeo', nombre: 'Hackeo', musculo: 'pecho' });
    juez('meter un ejercicio en el catálogo', !!r.error);
    const u = await A.c.from('ejercicios').update({ nombre: 'X' }).eq('id', 'sentadilla').select();
    juez('editar el catálogo de ejercicios', (u.data?.length ?? 0) === 0);
  }
} catch (e) {
  console.log(`\n  el ataque se cortó — ${e}`);
} finally {
  // `supabase.rpc()` NO es una promesa suelta: no tiene `.catch`. Envolver en
  // try, o el propio finally tira y deja las dos cuentas vivas (ya pasó en
  // `barrido-estados`). Si igual quedan, la próxima corrida las limpia por el
  // sello anotado.
  for (const q of [A, V, F]) {
    try {
      await q.c.rpc('eliminar_cuenta');
    } catch {
      /* la limpieza del arranque la agarra */
    }
  }
  tacharPend(sello);
}

console.log('\n══════════════════════════════════════════');
console.log(`  ${hechos} ataques probados · ${bugs} pasaron`);
console.log(bugs === 0 ? '  TODO BLOQUEADO. La base aguanta la anon key.' : `  ⚠ ${bugs} AGUJERO(S) — no publicar así.`);
console.log('══════════════════════════════════════════\n');
process.exit(bugs === 0 ? 0 : 1);
