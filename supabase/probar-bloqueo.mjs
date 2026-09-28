// VERIFICACIÓN REAL de denunciar/bloquear contra producción (migración 53).
//
// POR QUÉ ESTÁ EN EL CIERRE Y NO ES OPCIONAL. Denunciar y bloquear existen para
// que Apple no rechace la app por la guía 1.2. Si un revisor toca "Bloquear" y
// le tira error, es peor que no tenerlo. Un test en PGlite no alcanza: el bloqueo
// vive en la RLS, en las policies y en una vista, y eso solo se prueba de verdad
// contra la base real. Sin este test, un cambio futuro lo rompe en silencio y nos
// enteramos con el rechazo.
//
// Crea dos cuentas, corre el flujo entero por los MISMOS RPC que el cliente, y
// las borra con eliminar_cuenta (el botón de la app). No usa service key: entra
// por la anon key, con la RLS puesta, igual que un usuario.
//
// Correr con:  npm run test:bloqueo   (necesita la migración 53 en producción)
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const casilla = process.env.E2E_EMAIL || 'agusconde20@gmail.com';
const [u, dom] = casilla.split('@');
const sello = Date.now().toString(36);
const clave = `Ascent-${randomBytes(18).toString('base64url')}`;
const nuevo = () => createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });

let ok = 0;
const fallos = [];
const chequear = (n, real, esp) => {
  const a = JSON.stringify(real), b = JSON.stringify(esp);
  if (a === b) { ok++; console.log(`  ok   ${n}`); }
  else { fallos.push(n); console.log(`  FALLA ${n}\n        esperado ${b}\n        obtuve   ${a}`); }
};

async function crear(sufijo, sexo) {
  const c = nuevo();
  const email = `${u}+ascent-blk-${sello}-${sufijo}@${dom}`;
  const alta = await c.auth.signUp({ email, password: clave });
  if (alta.error || !alta.data.session) {
    throw new Error(`no se creó ${sufijo}: ${alta.error?.message ?? 'sin sesión (¿"Confirm email" prendido en Supabase?)'}`);
  }
  const id = alta.data.user.id;
  const hoy = (await c.rpc('mi_hoy')).data;
  await c.from('profiles').update({ username: `blk_${sufijo}_${sello.slice(-4)}`, sexo }).eq('id', id);
  await c.rpc('anotar_peso', { p_valor: sexo === 'm' ? 85 : 60 });
  await c.from('prs').insert([
    { user_id: id, ejercicio: 'sentadilla', peso: 120, reps: 1, es_real: true, fecha: hoy },
    { user_id: id, ejercicio: 'press_banca', peso: 80, reps: 1, es_real: true, fecha: hoy },
    { user_id: id, ejercicio: 'peso_muerto', peso: 150, reps: 1, es_real: true, fecha: hoy },
  ]);
  return { c, id, email };
}

const enRanking = async (c, id) => ((await c.rpc('ranking_fuerza')).data ?? []).some((f) => f.id === id);
const enBuscador = async (c, id) => (((await c.from('usuarios_publicos').select('id').eq('id', id)).data) ?? []).length > 0;
const sonAmigos = async (c, a, b) => (await c.rpc('son_amigos', { a, b })).data;
const hayAmistad = async (c, a, b) =>
  ((await c.from('friendships').select('id').or(`and(solicitante.eq.${a},destinatario.eq.${b}),and(solicitante.eq.${b},destinatario.eq.${a})`)).data ?? []).length > 0;

console.log('\nVerificación de denunciar/bloquear contra producción\n');
let A, B;
try {
  A = await crear('a', 'm');
  B = await crear('b', 'f');

  // se hacen amigos: A pide, B acepta
  const pedido = await A.c.from('friendships').insert({ solicitante: A.id, destinatario: B.id }).select('id').single();
  await B.c.from('friendships').update({ estado: 'aceptada' }).eq('id', pedido.data.id);
  chequear('parten como amigos', await sonAmigos(A.c, A.id, B.id), true);
  chequear('A ve a B en su ranking de fuerza', await enRanking(A.c, B.id), true);
  chequear('B ve a A en su ranking de fuerza', await enRanking(B.c, A.id), true);
  chequear('A ve a B en el buscador', await enBuscador(A.c, B.id), true);

  // A BLOQUEA A B
  const rb = await A.c.rpc('bloquear', { p_otro: B.id });
  chequear('bloquear no da error', rb.error, null);
  chequear('se cortó la amistad', await hayAmistad(A.c, A.id, B.id), false);
  chequear('B desaparece del ranking de A', await enRanking(A.c, B.id), false);
  chequear('A desaparece del ranking de B', await enRanking(B.c, A.id), false);
  chequear('B desaparece del buscador de A', await enBuscador(A.c, B.id), false);
  chequear('A desaparece del buscador de B (dos direcciones)', await enBuscador(B.c, A.id), false);
  chequear('ya no son amigos (son_amigos)', await sonAmigos(A.c, A.id, B.id), false);

  // B (y A) intentan re-solicitar: lo frena la BASE
  const reB = await B.c.from('friendships').insert({ solicitante: B.id, destinatario: A.id }).select('id');
  chequear('la base frena la nueva solicitud de B→A', /row-level|policy|violates/i.test(reB.error?.message ?? ''), true);
  const reA = await A.c.from('friendships').insert({ solicitante: A.id, destinatario: B.id }).select('id');
  chequear('y también la de A→B', /row-level|policy|violates/i.test(reA.error?.message ?? ''), true);

  // Cuentas bloqueadas + desbloquear
  const ml = (await A.c.rpc('mis_bloqueados')).data ?? [];
  chequear('B aparece en mis_bloqueados de A', ml.some((x) => x.id === B.id), true);
  chequear('desbloquear no da error', (await A.c.rpc('desbloquear', { p_otro: B.id })).error, null);
  chequear('B ya no está en mis_bloqueados', ((await A.c.rpc('mis_bloqueados')).data ?? []).some((x) => x.id === B.id), false);
  chequear('B vuelve al buscador de A', await enBuscador(A.c, B.id), true);
  const re2 = await A.c.from('friendships').insert({ solicitante: A.id, destinatario: B.id }).select('id').single();
  chequear('se pueden volver a agregar tras desbloquear', !!re2.data?.id, true);
  await B.c.from('friendships').update({ estado: 'aceptada' }).eq('id', re2.data.id);

  // Denunciar
  chequear('denunciar (spam) no da error', (await A.c.rpc('denunciar', { p_denunciado: B.id, p_motivo: 'spam' })).error, null);
  chequear('re-denunciar (acoso) tampoco (upsert)', (await A.c.rpc('denunciar', { p_denunciado: B.id, p_motivo: 'acoso' })).error, null);
  chequear('motivo inválido lo rechaza la base', Boolean((await A.c.rpc('denunciar', { p_denunciado: B.id, p_motivo: 'xxx' })).error), true);

  // Bloqueo mutuo
  await A.c.rpc('bloquear', { p_otro: B.id });
  await B.c.rpc('bloquear', { p_otro: A.id });
  chequear('A tiene a B bloqueado', ((await A.c.rpc('mis_bloqueados')).data ?? []).some((x) => x.id === B.id), true);
  chequear('B tiene a A bloqueado', ((await B.c.rpc('mis_bloqueados')).data ?? []).some((x) => x.id === A.id), true);
  chequear('no se ven en el buscador (A→B)', await enBuscador(A.c, B.id), false);
  chequear('no se ven en el buscador (B→A)', await enBuscador(B.c, A.id), false);
  const mm = await A.c.from('friendships').insert({ solicitante: A.id, destinatario: B.id }).select('id');
  chequear('ninguno puede solicitar al otro', /row-level|policy|violates/i.test(mm.error?.message ?? ''), true);
} finally {
  // limpieza: borrar las dos cuentas (el botón de la app)
  for (const x of [A, B]) {
    if (!x) continue;
    const e = await x.c.rpc('eliminar_cuenta');
    if (e.error) console.log(`  aviso: no se borró ${x.email}: ${e.error.message}`);
  }
}

console.log(`\n${ok} pasaron, ${fallos.length} fallaron`);
if (fallos.length) process.exit(1);
