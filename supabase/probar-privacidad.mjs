// QUÉ VE OTRA PERSONA, contra Supabase real, con dos cuentas descartables.
//
// POR QUÉ EXISTE: `test:db` corre en PGlite con el storage imitado y nunca
// probó la privacidad entre amigos —`son_amigos`, "amigos leen", las fotos del
// bucket—. La caza del 15/9 lo marcó como el lugar donde más a ciegas se
// camina: un error ahí no rompe nada visible, filtra.
//
// A tiene de todo. B la mira tres veces: sin ser amiga, siendo amiga, y
// después de dejar de serlo.
//
//   node --env-file=.env.local supabase/probar-privacidad.mjs
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const sello = Date.now().toString(36);
let fallos = 0;
const chequear = (que, obtuve, esperaba) => {
  const bien = JSON.stringify(obtuve) === JSON.stringify(esperaba);
  console.log(`  ${bien ? 'ok  ' : 'FALLA'} ${que}${bien ? '' : ` — esperaba ${JSON.stringify(esperaba)}, obtuve ${JSON.stringify(obtuve)}`}`);
  if (!bien) fallos++;
};

async function cuenta(letra) {
  const s = createClient(url, anon, { auth: { persistSession: false } });
  const correo = `agusconde20+ascent-priv-${letra}-${sello}@gmail.com`;
  const { error } = await s.auth.signUp({ email: correo, password: `Pr-${sello}-${letra}9` });
  if (error) throw new Error(`alta ${letra}: ${error.message}`);
  const id = (await s.auth.getUser()).data.user.id;
  await s.from('profiles').update({ username: `priv_${letra}${sello.slice(-5)}` }).eq('id', id);
  return { s, id };
}

const A = await cuenta('a');
const B = await cuenta('b');
const JPG = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==', 'base64');

try {
  // ---- A tiene de todo ----
  const hoy = (await A.s.rpc('mi_hoy')).data;
  const dia = (n) => {
    const d = new Date(hoy + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() - n);
    return d.toISOString().slice(0, 10);
  };
  for (const n of [9, 8, 6, 5, 4, 3, 2, 1]) await A.s.from('logs').insert({ user_id: A.id, fecha: dia(n) });
  await A.s.rpc('fijar_descansos', { p_dias: [0, 3] });
  await A.s.rpc('anotar_peso', { p_valor: 71.3 });
  await A.s.from('prs').insert({ user_id: A.id, ejercicio: 'sentadilla', peso: 100, reps: 1, es_real: true, fecha: dia(2) });
  const rutaPrivada = `${A.id}/${hoy}-1.jpg`;
  const rutaAmigos = `${A.id}/${hoy}-2.jpg`;
  for (const [ruta, vis] of [[rutaPrivada, 'privada'], [rutaAmigos, 'amigos']]) {
    await A.s.storage.from('fotos').upload(ruta, JPG, { contentType: 'image/jpeg' });
    await A.s.from('photos').insert({ user_id: A.id, storage_path: ruta, visibilidad: vis });
  }
  await A.s.rpc('iniciar_sesion');
  await A.s.rpc('terminar_sesion');

  async function loQueVe(quien) {
    const c = quien.s;
    const [logs, fotos, prs, pesos, ses, desc, vidas] = await Promise.all([
      c.from('logs').select('fecha').eq('user_id', A.id),
      c.from('photos').select('storage_path').eq('user_id', A.id),
      c.from('prs').select('peso').eq('user_id', A.id),
      c.from('weights').select('valor').eq('user_id', A.id),
      c.from('sesiones').select('id').eq('user_id', A.id),
      c.from('descansos').select('dias').eq('user_id', A.id),
      c.from('vidas_usadas').select('fecha').eq('user_id', A.id),
    ]);
    // Se mide con un enlace firmado, que es lo que usan las apps. `download()`
    // puede devolver una respuesta anterior del mismo cliente y hacer creer que
    // el servidor dejó pasar algo que ya niega (15/9: se probó crudo, da 400).
    const bajar = async (r) => {
      const { data, error } = await c.storage.from('fotos').createSignedUrl(r, 60);
      return !error && !!data?.signedUrl;
    };
    return {
      logs: logs.data?.length ?? 0,
      fotos: fotos.data?.length ?? 0,
      marcas: prs.data?.length ?? 0,
      pesos: pesos.data?.length ?? 0,
      sesiones: ses.data?.length ?? 0,
      descansos: desc.data?.length ?? 0,
      vidas: vidas.data?.length ?? 0,
      bajaPrivada: await bajar(rutaPrivada),
      bajaAmigos: await bajar(rutaAmigos),
    };
  }

  console.log('\nB no es amiga');
  chequear('no ve NADA de A por las tablas', await loQueVe(B), {
    logs: 0, fotos: 0, marcas: 0, pesos: 0, sesiones: 0, descansos: 0, vidas: 0, bajaPrivada: false, bajaAmigos: false,
  });

  // Las funciones que reciben el id de otro. Si alguna contesta, filtra por
  // el costado lo que las tablas guardan.
  const porElCostado = {};
  for (const [fn, args] of [
    ['calcular_racha', { p_user: A.id, p_hasta: dia(3) }],
    ['mejor_racha_real', { p_user: A.id }],
    ['descansos_vigentes', { p_user: A.id, p_fecha: hoy }],
    ['impulsos_ganados', { p_user: A.id }],
    ['impulsos_disponibles', { p_user: A.id, p_dia: hoy }],
    ['vidas_disponibles', { p_user: A.id, p_dia: hoy }],
    ['son_amigos', { a: A.id, b: B.id }],
    ['peso_actual', { p_user: A.id }],
    ['mejores_marcas', { p_user: A.id }],
    ['dots_de', { p_user: A.id }],
    ['hoy_de', { p_user: A.id }],
    ['bloqueo_hasta', { p_user: A.id }],
  ]) {
    const { data, error } = await B.s.rpc(fn, args);
    porElCostado[fn] = error ? 'cerrada' : JSON.stringify(data);
  }
  console.log('  --   funciones con el id de A, llamadas por B:', porElCostado);
  const abiertas = Object.entries(porElCostado).filter(([, v]) => v !== 'cerrada').map(([k]) => k);
  chequear('ninguna función deja a B leer datos privados de A', abiertas, []);

  // Un día puntual: ¿se puede saber si A entrenó el día 7 (el hueco)?
  const r7 = await B.s.rpc('calcular_racha', { p_user: A.id, p_hasta: dia(7) });
  const r6 = await B.s.rpc('calcular_racha', { p_user: A.id, p_hasta: dia(6) });
  if (!r7.error) console.log(`  --   calcular_racha(A, día 7) = ${r7.data}, (A, día 6) = ${r6.data}: el hueco de A se ve desde afuera`);

  // Hacerse amiga sin permiso.
  const trampa = await B.s.from('friendships').insert({ solicitante: B.id, destinatario: A.id, estado: 'aceptada' });
  chequear('B no puede crear una amistad ya aceptada', !!trampa.error, true);

  console.log('\nB pide, A acepta');
  const { data: pedido } = await B.s.from('friendships').insert({ solicitante: B.id, destinatario: A.id }).select('id').single();
  const autoAcepta = await B.s.from('friendships').update({ estado: 'aceptada' }).eq('id', pedido.id).select('id');
  chequear('B no puede aceptar su propio pedido', autoAcepta.data?.length ?? 0, 0);
  const acepta = await A.s.from('friendships').update({ estado: 'aceptada' }).eq('id', pedido.id).select('id');
  chequear('A acepta', acepta.data?.length, 1);
  const antesFirma = await B.s.storage.from('fotos').createSignedUrl(rutaAmigos, 60);
  console.log('  --   siendo amiga, enlace firmado de la foto de amigos:', antesFirma.error ? 'no' : 'sí');
  chequear('siendo amiga ve días, la foto de amigos y marcas; nunca peso, sesiones, descansos ni la foto privada', await loQueVe(B), {
    logs: 8, fotos: 1, marcas: 1, pesos: 0, sesiones: 0, descansos: 0, vidas: 0, bajaPrivada: false, bajaAmigos: true,
  });

  // A la vuelve privada: tiene que dejar de bajarse al instante.
  const cambio = await A.s.from('photos').update({ visibilidad: 'privada' }).eq('storage_path', rutaAmigos).select('visibilidad');
  chequear('A la vuelve privada (la fila cambia)', cambio.data?.map((x) => x.visibilidad), ['privada']);
  const tras = await loQueVe(B);
  chequear('B ya no ve la fila', tras.fotos, 0);
  // Una ruta distinta pero el mismo archivo: saltea cualquier caché del camino.
  const { data: firmada, error: eFirma } = await B.s.storage.from('fotos').createSignedUrl(rutaAmigos, 60);
  chequear('B no puede pedir un enlace firmado de la foto ya privada', !!eFirma || !firmada, true);
  chequear('una foto que se vuelve privada deja de bajarse', tras.bajaAmigos, false);

  console.log('\nA la elimina');
  await A.s.rpc('eliminar_amigo', { p_otro: B.id });
  const despues = await loQueVe(B);
  chequear('después de eliminarla no ve nada', [despues.logs, despues.fotos, despues.marcas], [0, 0, 0]);
} catch (e) {
  fallos++;
  console.log('REVENTÓ:', e);
} finally {
  console.log('\nLimpieza');
  for (const X of [A, B]) {
    const { data: objs } = await X.s.storage.from('fotos').list(X.id);
    if (objs?.length) await X.s.storage.from('fotos').remove(objs.map((o) => `${X.id}/${o.name}`));
    const { error } = await X.s.rpc('eliminar_cuenta');
    chequear('cuenta borrada', error?.message ?? 'ok', 'ok');
  }
  console.log(`\n${fallos === 0 ? 'todo ok' : fallos + ' fallaron'}`);
  process.exit(fallos ? 1 : 0);
}
