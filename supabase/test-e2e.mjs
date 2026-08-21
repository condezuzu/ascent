// End-to-end contra el Supabase real: dos cuentas, el flujo completo de la app
// y la prueba de aislamiento del §4. Crea datos de verdad y los limpia al final.
//
// Correr con:  npm run test:e2e
//
// REQUISITOS (una vez, en el dashboard de Supabase):
//  1. Authentication -> Providers -> Email -> "Confirm email" APAGADO.
//     Con la confirmación prendida, signUp no devuelve sesión y además cada
//     alta consume el cupo de correos del SMTP incorporado (~2 por hora).
//  2. La variable E2E_EMAIL en .env.local con una casilla real tuya. Las
//     cuentas se crean con subdirecciones (tu+algo@dominio): Supabase rechaza
//     los dominios de ejemplo o inventados, así que tiene que ser uno real.
//     Con la confirmación apagada NO se envía ningún correo al crear cuentas.
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const casilla = process.env.E2E_EMAIL;
const sello = Date.now().toString(36);

if (!casilla || !casilla.includes('@')) {
  console.log(
    'Falta E2E_EMAIL en .env.local: una casilla real tuya, por ejemplo\n' +
      '  E2E_EMAIL=vos@gmail.com\n' +
      'Las cuentas de prueba se crean como vos+ascent-e2e-...@gmail.com'
  );
  process.exit(1);
}
const [casillaUsuario, casillaDominio] = casilla.split('@');
const dir = (sufijo) => `${casillaUsuario}+ascent-e2e-${sello}-${sufijo}@${casillaDominio}`;

let ok = 0;
const fallos = [];
const avisos = [];
function chequear(nombre, real, esperado) {
  const a = JSON.stringify(real);
  const b = JSON.stringify(esperado);
  if (a === b) {
    ok++;
    console.log(`  ok   ${nombre}`);
  } else {
    fallos.push(nombre);
    console.log(`  FALLA ${nombre}\n         esperado ${b}\n         obtuve   ${a}`);
  }
}

function nuevoCliente() {
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

const hoy = new Date();
const iso = (d) => {
  const x = new Date(hoy);
  x.setDate(x.getDate() - d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};
const HOY = iso(0);

// =====================================================================
console.log('1. Alta de cuenta');
const A = nuevoCliente();
const B = nuevoCliente();
const emailA = dir('a');
const emailB = dir('b');
// Al azar, no derivada del sello: el sello es la fecha y la hora, o sea que
// la clave de cualquier cuenta que el e2e haya dejado a medio borrar se
// adivina leyendo el repo. Las cuentas son descartables igual, pero una clave
// predecible en un archivo público no tiene por qué existir.
const clave = `Ascent-${randomBytes(18).toString('base64url')}`;

const altaA = await A.auth.signUp({ email: emailA, password: clave });
if (altaA.error) {
  console.log(`\nNo se pudo crear la cuenta: ${altaA.error.message}`);
  if (/rate limit/i.test(altaA.error.message)) {
    console.log(
      'Es el cupo de correos del SMTP incorporado. Apagá "Confirm email" en\n' +
        'Authentication -> Providers -> Email: sin confirmación no se manda nada.'
    );
  }
  process.exit(1);
}
if (!altaA.data.session) {
  console.log(
    '\nLa cuenta se creó pero sin sesión: está prendida la confirmación por correo.\n' +
      'Apagá Authentication -> Providers -> Email -> "Confirm email" y volvé a correr.'
  );
  process.exit(1);
}
const altaB = await B.auth.signUp({ email: emailB, password: clave });
const idA = altaA.data.user.id;
const idB = altaB.data.user?.id;
chequear('cuenta A creada con sesión', !!idA, true);
chequear('cuenta B creada con sesión', !!idB, true);

{
  const { data } = await A.from('profiles').select('*').eq('id', idA).maybeSingle();
  chequear('el trigger creó el perfil', data ? [data.racha_actual, data.rango_actual] : null, [0, 1]);
  chequear('arranca sin username (lo elige en onboarding)', data?.username ?? null, null);
}

// =====================================================================
console.log('\n2. Onboarding: elegir username');
const userA = `e2e_a_${sello}`;
const userB = `e2e_b_${sello}`;
{
  const { error } = await A.from('profiles').update({ username: userA }).eq('id', idA);
  chequear('A elige su username', error?.message ?? 'sin error', 'sin error');
  await B.from('profiles').update({ username: userB }).eq('id', idB);
}
{
  const { error } = await B.from('profiles').update({ username: userA.toUpperCase() }).eq('id', idB);
  chequear('username único e insensible a mayúsculas', error?.code ?? null, '23505');
}
{
  const { error } = await A.from('profiles').update({ username: 'no valido!' }).eq('id', idA);
  chequear('username con formato inválido rechazado', error?.code ?? null, '23514');
}

// =====================================================================
console.log('\n3. La racha no se puede tocar a mano');
{
  const { error } = await A.from('profiles').update({ racha_actual: 9999 }).eq('id', idA);
  chequear('escribir la propia racha está prohibido', /permission denied/i.test(error?.message ?? ''), true);
}

// =====================================================================
console.log('\n4. Registrar el primer día, con peso');
{
  const { data, error } = await A.rpc('registrar_dia', { p_fecha: HOY, p_es_descanso: false, p_peso: 82.4 });
  chequear('registrar_dia responde', error?.message ?? 'sin error', 'sin error');
  chequear('racha 1, rango 1, sin subida', [data?.racha, data?.rango_despues, data?.subio_rango], [1, 1, false]);
}
{
  const { data } = await A.from('weights').select('valor').eq('user_id', idA);
  chequear('el peso quedó guardado', Number(data?.[0]?.valor), 82.4);
}
{
  const { error } = await A.rpc('registrar_dia', { p_fecha: HOY, p_es_descanso: false, p_peso: null });
  chequear('el mismo día no se registra dos veces', error?.code ?? null, '23505');
}

// =====================================================================
console.log('\n5. Escalera de rangos y planeta del día');
{
  for (let d = 38; d >= 1; d--) await A.from('logs').insert({ user_id: idA, fecha: iso(d) });
  const { data } = await A.from('profiles').select('racha_actual, rango_actual').eq('id', idA).single();
  chequear('39 días seguidos', [data.racha_actual, data.rango_actual], [39, 4]);
}
{
  const { data } = await A.from('logs')
    .select('planeta_del_dia').eq('user_id', idA).not('planeta_del_dia', 'is', null).order('fecha');
  chequear('los diez planetas, en orden', data?.map((x) => x.planeta_del_dia),
    ['Ceres', 'Plutón', 'Mercurio', 'Marte', 'Venus', 'Tierra', 'Neptuno', 'Urano', 'Saturno', 'Júpiter']);
}

// =====================================================================
console.log('\n6. La ignición: subir de planeta a sol');
{
  const { data } = await A.rpc('registrar_dia', { p_fecha: iso(-1), p_es_descanso: false, p_peso: null });
  chequear('subió de rango al confirmar',
    [data?.racha, data?.rango_antes, data?.rango_despues, data?.subio_rango], [40, 4, 5, true]);
}

// =====================================================================
console.log('\n7. Fotos: subida, visibilidad y borrado');
const pngMinimo = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);
const rutaFoto = `${idA}/e2e-${sello}.png`;
{
  const { error } = await A.storage.from('fotos').upload(rutaFoto, pngMinimo, { contentType: 'image/png' });
  chequear('sube la foto al storage', error?.message ?? 'sin error', 'sin error');
}
let fotoId = null;
{
  const { data: log } = await A.from('logs').select('id').eq('user_id', idA).eq('fecha', HOY).single();
  const { data, error } = await A.from('photos')
    .insert({ user_id: idA, log_id: log.id, storage_path: rutaFoto, visibilidad: 'privada' })
    .select().single();
  fotoId = data?.id;
  chequear('registra la foto', error?.message ?? 'sin error', 'sin error');
}
{
  const { error } = await A.from('photos').update({ visibilidad: 'amigos' }).eq('id', fotoId);
  chequear('cambia la visibilidad', error?.message ?? 'sin error', 'sin error');
}
{
  const { error } = await A.from('photos').update({ user_id: idB }).eq('id', fotoId);
  chequear('no puede cambiarle el dueño', /permission denied/i.test(error?.message ?? ''), true);
}

// =====================================================================
console.log('\n8. §4 — dos cuentas SIN amistad no se ven nada');
for (const [tabla, etiqueta] of [['logs', 'los logs'], ['weights', 'el peso'], ['photos', 'las fotos']]) {
  const { data } = await B.from(tabla).select('id').eq('user_id', idA);
  chequear(`B no ve ${etiqueta} de A`, data ?? [], []);
}
{
  const { data } = await B.from('profiles').select('id').eq('id', idA);
  chequear('B no ve el perfil de A', data ?? [], []);
}
{
  const { data } = await B.from('usuarios_publicos').select('username, racha_actual').eq('id', idA);
  chequear('pero sí lo encuentra en la búsqueda', [data?.[0]?.username, data?.[0]?.racha_actual], [userA, 40]);
}
{
  const { data } = await B.storage.from('fotos').download(rutaFoto);
  chequear('B no puede bajar el archivo de A', data, null);
}

// =====================================================================
console.log('\n9. Amistad');
{
  const { error } = await A.from('friendships').insert({ solicitante: idA, destinatario: idB });
  chequear('A manda la solicitud', error?.message ?? 'sin error', 'sin error');
}
{
  const { data } = await B.from('friendships').select('id, estado');
  chequear('B la ve pendiente', data?.[0]?.estado, 'pendiente');
  const { error } = await B.from('friendships').update({ estado: 'aceptada' }).eq('id', data[0].id);
  chequear('B la acepta', error?.message ?? 'sin error', 'sin error');
}

// =====================================================================
console.log('\n10. §4 — ya siendo amigos: se ve la actividad, NUNCA el peso');
{
  const { data } = await B.from('logs').select('id').eq('user_id', idA);
  chequear('B ahora sí ve los logs de A', (data ?? []).length > 0, true);
}
{
  const { data } = await B.from('weights').select('id').eq('user_id', idA);
  chequear('el peso de A sigue invisible', data ?? [], []);
}
{
  const { data } = await B.from('photos').select('id').eq('user_id', idA);
  chequear('ve la foto marcada como visible', (data ?? []).length, 1);
}
{
  await A.from('photos').update({ visibilidad: 'privada' }).eq('id', fotoId);
  const { data } = await B.from('photos').select('id').eq('user_id', idA);
  chequear('si A la vuelve privada, desaparece', data ?? [], []);
  await A.from('photos').update({ visibilidad: 'amigos' }).eq('id', fotoId);
}
{
  const { data } = await B.storage.from('fotos').download(rutaFoto);
  chequear('y puede bajar el archivo visible', !!data, true);
}

// =====================================================================
console.log('\n11. Reto');
{
  const { error } = await A.from('challenges').insert({ retador: idA, rival: idB, desde: HOY, hasta: iso(-6) });
  chequear('A reta a B', error?.message ?? 'sin error', 'sin error');
}
{
  const { data } = await B.from('challenges').select('id').limit(1).single();
  const { error } = await B.from('challenges').update({ estado: 'activo' }).eq('id', data.id);
  chequear('B acepta', error?.message ?? 'sin error', 'sin error');
  const { error: e2 } = await B.from('challenges').update({ hasta: iso(-60) }).eq('id', data.id);
  chequear('B no puede correr la fecha final', /permission denied/i.test(e2?.message ?? ''), true);
}
{
  const { error } = await A.from('challenges').insert({ retador: idA, rival: idB, desde: HOY, hasta: iso(-6) });
  chequear('no se puede abrir un segundo reto vigente', error?.code ?? null, '23505');
}

// =====================================================================
console.log('\n12. Pérdida de racha: resta 10');
{
  // Borrar solo hoy NO corta nada: la racha vive hasta ayer y hoy todavía se
  // puede registrar. Para cortarla de verdad hay que dejar ayer vacío.
  await A.from('logs').delete().eq('user_id', idA).eq('fecha', iso(-1));
  await A.from('logs').delete().eq('user_id', idA).eq('fecha', HOY);
  const { data: sinCorte } = await A.rpc('verificar_perdida', { p_hoy: HOY });
  chequear('borrar el día de hoy no rompe la racha', sinCorte?.perdida, false);

  await A.from('logs').delete().eq('user_id', idA).eq('fecha', iso(1));
  const { data: p0 } = await A.from('profiles').select('racha_actual').eq('id', idA).single();
  chequear('quedan 37 días, cortados anteayer', p0.racha_actual, 37);

  const { data } = await A.rpc('verificar_perdida', { p_hoy: HOY });
  chequear('detecta el corte y resta 10', [data?.perdida, data?.racha], [true, 27]);
  const { data: p } = await A.from('profiles').select('racha_actual, rango_actual').eq('id', idA).single();
  chequear('bajó justo un rango', [p.racha_actual, p.rango_actual], [27, 3]);
}
{
  const { data } = await A.rpc('verificar_perdida', { p_hoy: HOY });
  chequear('no castiga dos veces el mismo corte', data?.perdida, false);
}
{
  const { data } = await A.rpc('registrar_dia', { p_fecha: HOY, p_es_descanso: false, p_peso: null });
  chequear('volver suma sobre lo conservado', data?.racha, 28);
}

// =====================================================================
console.log('\n13. Recalcular no rebota');
{
  const { data } = await A.rpc('recalcular_desde_cero', { p_hoy: HOY });
  const { data: p } = await A.from('profiles').select('racha_actual').eq('id', idA).single();
  chequear('lo devuelto coincide con la base', data?.racha, p.racha_actual);
  const { data: v } = await A.rpc('verificar_perdida', { p_hoy: HOY });
  chequear('y recargar no lo mueve', v?.perdida, false);
}

// =====================================================================
console.log('\n14. Buzón de sugerencias');
{
  const { error } = await A.from('feedback').insert({
    user_id: idA, texto: 'prueba end-to-end', tipo: 'bug', plataforma: 'e2e', pantalla_origen: 'script',
  });
  chequear('se puede mandar', error?.message ?? 'sin error', 'sin error');
  const { data } = await A.from('feedback').select('id');
  chequear('pero nadie lo lee desde el cliente', data ?? [], []);
}

// =====================================================================
console.log('\n15. Contraseña');
{
  const nueva = `${clave}-nueva`;
  const { error } = await A.auth.updateUser({ password: nueva });
  chequear('se cambia con sesión abierta', error?.message ?? 'sin error', 'sin error');
  const C = nuevoCliente();
  const { data } = await C.auth.signInWithPassword({ email: emailA, password: nueva });
  chequear('entra con la nueva', !!data?.session, true);
  const D = nuevoCliente();
  const { error: e2 } = await D.auth.signInWithPassword({ email: emailA, password: clave });
  chequear('la vieja ya no sirve', !!e2, true);
}
{
  // Esto sí manda un correo de verdad, a tu casilla. Puede chocar con el
  // cupo del SMTP incorporado: si pasa, se avisa y no se cuenta como falla.
  const { error } = await A.auth.resetPasswordForEmail(emailA, {
    redirectTo: 'http://localhost:3020/auth/recuperar',
  });
  if (error && /rate limit/i.test(error.message)) {
    avisos.push('El correo de recuperación no se pudo probar: cupo del SMTP incorporado agotado.');
    console.log('  --   correo de recuperación: cupo agotado, sin probar');
  } else {
    chequear('Supabase acepta el pedido de recuperación', error?.message ?? 'sin error', 'sin error');
    avisos.push(`Revisá ${casilla}: tiene que haber llegado un correo de recuperación.`);
  }
}

// =====================================================================
console.log('\n16. Eliminar amigo');
{
  const { error } = await B.rpc('eliminar_amigo', { p_otro: idA });
  chequear('B elimina a A', error?.message ?? 'sin error', 'sin error');
  const { data } = await B.from('friendships').select('id');
  chequear('no queda amistad', data ?? [], []);
  const { data: r } = await B.from('challenges').select('id').in('estado', ['pendiente', 'activo']);
  chequear('el reto vigente se cerró', r ?? [], []);
  const { data: l } = await B.from('logs').select('id').eq('user_id', idA);
  chequear('y B vuelve a no ver nada de A', l ?? [], []);
}

// =====================================================================
console.log('\n17. Limpieza');
{
  await A.storage.from('fotos').remove([rutaFoto]);
  await A.from('photos').delete().eq('user_id', idA);
  await A.from('logs').delete().eq('user_id', idA);
  await A.from('weights').delete().eq('user_id', idA);
  await A.from('challenges').delete().eq('retador', idA);
  const { data } = await A.from('logs').select('id').eq('user_id', idA);
  chequear('datos de prueba borrados', data ?? [], []);
}

console.log(`\n${ok} pasaron, ${fallos.length} fallaron`);
avisos.forEach((a) => console.log(`aviso: ${a}`));
console.log(
  '\nQuedan 2 usuarios de prueba en Authentication -> Users (borrarlos necesita\n' +
    'la service_role, que este script no usa). Borralos a mano del dashboard:\n' +
    `  ${emailA}\n  ${emailB}`
);
if (fallos.length) process.exitCode = 1;
