// Auditoría de fechas: ¿hay días guardados con la fecha corrida?
import { createClient } from '@supabase/supabase-js';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const cuentas = [
  ['prueba.uno@ascent.test', 'ascent-prueba-2026'],
  ['prueba.dos@ascent.test', 'ascent-prueba-2026'],
];

for (const [correo, clave] of cuentas) {
  const db = createClient(url, key);
  const { data: a, error } = await db.auth.signInWithPassword({ email: correo, password: clave });
  if (error) { console.log(`${correo}: no pude entrar (${error.message})`); continue; }
  const uid = a.user.id;
  const { data: logs } = await db.from('logs')
    .select('fecha, creado, es_descanso').eq('user_id', uid).order('fecha');
  const { data: p } = await db.from('profiles')
    .select('racha_actual, mejor_racha, racha_base, perdida_fecha').eq('id', uid).single();

  console.log(`\n=== ${correo} (${logs.length} días) ===`);
  console.log(`   perfil: racha ${p.racha_actual}, mejor ${p.mejor_racha}, base ${p.racha_base}, perdida ${p.perdida_fecha}`);

  // La ventana del bug: creado entre 00:00 y 03:00 UTC = 21:00-24:00 en Uruguay.
  // Esos días se guardaron con la fecha del día SIGUIENTE al que el usuario vivía.
  const sospechosos = [];
  for (const l of logs) {
    const c = new Date(l.creado);
    const horaUTC = c.getUTCHours();
    const fechaUTC = c.toISOString().slice(0, 10);
    const fechaUY = new Date(c.getTime() - 3 * 3600 * 1000).toISOString().slice(0, 10);
    if (fechaUTC !== fechaUY) {
      sospechosos.push({ guardado: l.fecha, creadoUTC: c.toISOString(), enUY: fechaUY, horaUTC });
    }
  }
  if (sospechosos.length === 0) console.log('   sin días creados en la ventana 00:00-03:00 UTC');
  else {
    console.log(`   ${sospechosos.length} día(s) creados cuando en Uruguay era el día anterior:`);
    for (const s of sospechosos) console.log(`     guardado ${s.guardado} · creado ${s.creadoUTC} · en UY era ${s.enUY}`);
  }

  // huecos y duplicados
  const fechas = logs.map(l => l.fecha);
  const dup = fechas.filter((f, i) => fechas.indexOf(f) !== i);
  console.log(`   duplicados: ${dup.length ? dup.join(', ') : 'ninguno'}`);
  if (fechas.length) console.log(`   rango: ${fechas[0]} .. ${fechas[fechas.length-1]}`);
}
