// LAS CAPTURAS DE LA FICHA PARA LA 1.1.0 (16/10), crudas como las de antes
// (`capturas-tienda.mjs`): sin marco ni títulos, para que las edite una persona.
//
// EL TAMAÑO ES EL DE 6,9" QUE PIDE APPLE HOY: 1320×2868, de un lienzo de 440×956 a
// densidad 3. App Store Connect achica solo para los demás iPhone, y la app no es
// para iPad (`supportsTablet: false`), así que no hacen falta otras.
//
// CUATRO, en el orden de subida (16/10): la racha, entrenando con el grupo, la tarjeta
// de la pantalla bloqueada y Social. El álbum se sacó: fotos de progreso de verdad
// quedarían públicas, y de banco de imágenes no van en una pantalla que dice "tu
// progreso". Seis cuentas descartables con datos que se ven bien, borradas al final.
//
// LA TARJETA DE LA PANTALLA BLOQUEADA ES UNA RECREACIÓN, no una captura: la dibuja
// iOS y acá no hay iPhone. Está hecha con los colores, tamaños y textos de
// `movil/targets/descanso/index.swift`, pero la letra no es la de iOS. La buena es
// la que se saca del teléfono con la tarjeta en pantalla.
//
// NECESITA LA NATIVA EN :8090 y la web en :3020 (la web solo presta la letra).
//
//   node --env-file=.env.local supabase/capturas-tienda-11.mjs [--solo-tarjeta]
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { limiteDeSonda, pasarLaEntradaNativa, borrarCuentaDePrueba } from './utiles.mjs';
import { TEXTOS_ES as T } from '../nucleo/textos.ts';

limiteDeSonda(25);

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const SALIDA = join(RAIZ, 'capturas-tienda', '1.1.0');
mkdirSync(SALIDA, { recursive: true });
const NATIVA = 'http://localhost:8090';
const WEB = 'http://localhost:3020';
const ANCHO = 440;
const ALTO = 956;
const DENSIDAD = 3;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !anon) {
  console.log('Faltan NEXT_PUBLIC_SUPABASE_* en .env.local.');
  process.exit(1);
}
const SOLO_TARJETA = process.argv.includes('--solo-tarjeta');

const sello = Date.now().toString(36);
const CLAVE = `Ct-${sello}-Zx9`;
const GLOBOS = ['elegir', 'series', 'descanso', 'amigos', 'album', 'rutina'];

async function cuenta(n, usuario, dias) {
  const s = createClient(url, anon, { auth: { persistSession: false } });
  const correo = `agusconde20+ascent-tienda-${sello}-${n}@gmail.com`;
  const { data, error } = await s.auth.signUp({ email: correo, password: CLAVE });
  if (error || !data?.user) throw new Error(`no se pudo crear ${usuario}: ${error?.message}`);
  const uid = data.user.id;
  const { error: eNombre } = await s.from('profiles').update({ username: usuario, sexo: 'm' }).eq('id', uid);
  if (eNombre) throw new Error(eNombre.code === '23505' ? `el nombre "${usuario}" ya está tomado` : eNombre.message);
  if (dias > 0) await ponerRacha(s, uid, dias);
  return { s, uid, correo, usuario };
}

// Los días de a cincuenta: cada fila dispara el recálculo de la racha (ver `capturas-tienda.mjs`).
async function ponerRacha(s, uid, dias) {
  const HOY = (await s.rpc('mi_hoy')).data;
  const filas = [];
  for (let atras = dias - 1; atras >= 0; atras--) {
    const d = new Date(HOY + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() - atras);
    filas.push({ user_id: uid, fecha: d.toISOString().slice(0, 10) });
  }
  for (let i = 0; i < filas.length; i += 50) {
    const { error } = await s.from('logs').insert(filas.slice(i, i + 50));
    if (error) throw new Error(`no se pudieron cargar los días: ${error.message}`);
  }
  await s.rpc('recalcular_desde_cero');
}

async function hacerseAmigos(a, b) {
  const { data } = await b.s.from('friendships').insert({ solicitante: b.uid, destinatario: a.uid }).select('id').single();
  if (data?.id) await a.s.from('friendships').update({ estado: 'aceptada' }).eq('id', data.id);
}

const nav = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu'] });
const ctx = await nav.newContext({ viewport: { width: ANCHO, height: ALTO }, deviceScaleFactor: DENSIDAD, locale: 'es-UY', timezoneId: 'America/Montevideo' });
const page = await ctx.newPage();
const errores = [];
page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)));

async function foto(nombre, nota) {
  await page.screenshot({ path: join(SALIDA, `${nombre}.png`) });
  console.log(`  ${nombre.padEnd(34)} ${nota}`);
}

const cuentas = [];
try {
  console.log(`\nCapturas de la 1.1.0 · ${ANCHO * DENSIDAD}×${ALTO * DENSIDAD}\n`);
  if (!SOLO_TARJETA) {
  // La racha propia en el medio de la tabla: gente arriba y gente abajo. 65 es la galaxia.
  const yo = await cuenta('yo', 'agustin_c', 65);
  cuentas.push(yo);
  const amigos = {};
  for (const [usuario, dias] of [['martina_p', 112], ['lucia_g', 63], ['juanma_r', 21], ['nico_b', 12], ['fede_rossi', 9]]) {
    const c = await cuenta(usuario, usuario, dias);
    cuentas.push(c);
    amigos[usuario] = c;
    await hacerseAmigos(yo, c);
  }

  // La foto de hoy, de relleno y colgada del día: sin ella Inicio la pide con un renglón de más.
  const HOY = (await yo.s.rpc('mi_hoy')).data;
  const lienzo = await (await nav.newContext({ viewport: { width: 900, height: 1200 } })).newPage();
  await lienzo.setContent('<body style="margin:0;background:radial-gradient(circle at 40% 35%, #c9c4b8, #4a5f7a 60%, #111 100%)"></body>');
  const jpg = await lienzo.screenshot({ type: 'jpeg', quality: 82 });
  await lienzo.context().close();
  const ruta = `${yo.uid}/${HOY}-900.jpg`;
  await yo.s.storage.from('fotos').upload(ruta, jpg, { contentType: 'image/jpeg' });
  const logDeHoy = (await yo.s.from('logs').select('id').eq('user_id', yo.uid).eq('fecha', HOY).maybeSingle()).data?.id ?? null;
  await yo.s.from('photos').insert({ user_id: yo.uid, storage_path: ruta, visibilidad: 'privada', log_id: logDeHoy });

  // Entrar a la nativa sin globitos: la guía de esta cuenta, ya vista.
  await page.goto(NATIVA, { waitUntil: 'domcontentloaded', timeout: 240000 });
  await page.evaluate(([uid, globos]) => localStorage.setItem(`ascent:guia:${uid}`, JSON.stringify({ uid, recorrido: true, paso: 0, globos })), [yo.uid, GLOBOS]);
  await pasarLaEntradaNativa(page, 90000);
  await page.locator('input[type=email], input[inputmode=email]').first().fill(yo.correo, { timeout: 90000 });
  await page.locator('input[type=password]').first().fill(CLAVE);
  await page.getByText(T.entrar.entrar, { exact: true }).last().click();
  await page.getByText(T.inicio.iniciarEntrenamiento, { exact: true }).first().waitFor({ timeout: 180000 });
  await page.waitForFunction(() => !!document.querySelector('canvas'), null, { timeout: 120000 });
  await page.waitForTimeout(9000);
  await foto('1-racha', 'Inicio, racha 65: la galaxia');

  // ENTRENAR JUNTOS: arranco, elijo el ejercicio y sumo una serie (arranca el descanso);
  // Lucía y Juanma entrenan y se unen, cada uno en lo suyo.
  await page.getByText(T.nav.inicio, { exact: true }).last().click({ timeout: 60000 });
  await page.waitForTimeout(1500);
  await page.getByText(T.inicio.iniciarEntrenamiento, { exact: true }).first().click({ timeout: 60000 });
  await page.getByText(T.sesion.sinEjercicio, { exact: true }).first().click({ timeout: 60000 });
  await page.getByText('Press de banca', { exact: true }).first().click({ timeout: 60000 });
  await page.waitForTimeout(1200);
  await page.getByText('×4', { exact: true }).first().click({ timeout: 20000 }).catch(() => {});
  await page.getByLabel(T.inicio.sumarSerie).first().click({ timeout: 30000 });
  await page.waitForTimeout(2500);
  for (const quien of [amigos.lucia_g, amigos.juanma_r]) {
    await quien.s.rpc('iniciar_sesion');
    const { data: r } = await quien.s.rpc('pedir_unirse', { p_a: yo.uid });
    if (r !== 'ok') console.log(`  aviso: ${quien.usuario} pidió unirse y la base dijo ${r}`);
  }
  const { data: pedidos } = await yo.s.rpc('mis_uniones');
  for (const p of (pedidos ?? []).filter((x) => x.estado === 'pendiente')) await yo.s.rpc('responder_union', { p_id: p.id, p_acepta: true });
  await amigos.lucia_g.s.rpc('publicar_en_vivo', { p_ejercicio: 'sentadilla', p_serie: 2, p_meta: 4, p_descanso_faltan: 75 });
  await amigos.juanma_r.s.rpc('publicar_en_vivo', { p_ejercicio: 'remo_barra', p_serie: 1, p_meta: 3, p_descanso_faltan: null });
  await page.waitForTimeout(14000);
  await foto('2-entrenando-con-el-grupo', 'Inicio entrenando, con el grupo arriba');
  await page.getByText(T.nav.social, { exact: true }).last().click({ timeout: 60000 });
  await page.waitForTimeout(6000);
  await foto('4-social', 'el ranking y, debajo, el grupo: Lucía descansando, Juanma en su serie');

  }

  // LA TARJETA, RECREADA. La letra de la web (Inter y Outfit), prestada de una página pública.
  await page.goto(WEB + '/privacidad', { waitUntil: 'networkidle', timeout: 240000 });
  await page.evaluate(() => {
    const css = getComputedStyle(document.body);
    // Comillas simples: las dobles de la letra cortaban el atributo style y se perdía el resto (el fondo).
    const letra = css.fontFamily.replace(/"/g, "'");
    const numero = (css.getPropertyValue('--f-numero') || css.fontFamily).replace(/"/g, "'");
    document.head.querySelectorAll('meta[name=theme-color]').forEach((m) => m.remove());
    document.body.className = '';
    document.body.innerHTML = `
<div style="position:fixed;inset:0;font-family:${letra};color:#fff;overflow:hidden;
  background-color:#05060a;background-image:radial-gradient(ellipse at 75% 18%, #4a3f8c 0%, #23285a 32%, #0d1030 62%, #05060a 100%)">
  <div style="position:absolute;inset:0;background:radial-gradient(1.2px 1.2px at 12% 18%, #fff8 50%, transparent 51%),radial-gradient(1px 1px at 33% 9%, #fff6 50%, transparent 51%),radial-gradient(1.4px 1.4px at 78% 31%, #fff7 50%, transparent 51%),radial-gradient(1px 1px at 58% 44%, #fff5 50%, transparent 51%),radial-gradient(1.2px 1.2px at 86% 12%, #fff6 50%, transparent 51%),radial-gradient(1px 1px at 22% 52%, #fff4 50%, transparent 51%),radial-gradient(1.3px 1.3px at 67% 63%, #fff5 50%, transparent 51%),radial-gradient(1px 1px at 9% 71%, #fff4 50%, transparent 51%)"></div>
  <div style="position:absolute;top:11px;left:50%;transform:translateX(-50%);width:126px;height:37px;border-radius:19px;background:#000"></div>
  <div style="position:absolute;top:16px;left:28px;right:22px;display:flex;justify-content:space-between;font-size:15px;font-weight:600">
    <span></span><span style="display:flex;gap:7px;align-items:center"><svg width="18" height="12" viewBox="0 0 18 12" fill="#fff"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg><svg width="16" height="12" viewBox="0 0 16 12" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round"><path d="M1.5 4.5a9.5 9.5 0 0 1 13 0"/><path d="M4 7.2a6 6 0 0 1 8 0"/><circle cx="8" cy="10" r="1" fill="#fff" stroke="none"/></svg><svg width="27" height="13" viewBox="0 0 27 13"><rect x="0.5" y="0.5" width="23" height="12" rx="3.5" fill="none" stroke="#ffffff88"/><rect x="2" y="2" width="16" height="9" rx="2" fill="#fff"/><rect x="24.5" y="4.5" width="1.5" height="4" rx="0.7" fill="#ffffff88"/></svg></span>
  </div>
  <div style="position:absolute;top:92px;width:100%;text-align:center">
    <div style="font-size:20px;font-weight:500;opacity:.92">viernes 16 de octubre</div>
    <div style="font-family:${numero};font-size:104px;font-weight:600;line-height:1.05;letter-spacing:-2px">19:42</div>
  </div>
  <div style="position:absolute;left:14px;right:14px;bottom:128px;background:#05060ae6;border-radius:24px;padding:16px 20px;box-shadow:0 10px 40px #0008">
    <div style="display:flex;align-items:baseline;gap:14px">
      <div style="flex:1;min-width:0">
        <div style="font-size:11px;font-weight:500;letter-spacing:2.4px;color:#8a93a8">DESCANSO</div>
        <div style="font-size:17px;color:#e8ecf6;margin-top:4px">Press de banca</div>
        <div style="font-size:13px;color:#8a93a8;margin-top:4px">Serie 1 de 4</div>
      </div>
      <div style="font-family:${numero};font-size:46px;font-weight:300;color:#e8ecf6;font-variant-numeric:tabular-nums">1:38</div>
    </div>
    <div style="height:3px;border-radius:2px;background:#ffffff1f;margin-top:12px;overflow:hidden"><div style="width:18%;height:100%;background:#c4c2ba"></div></div>
    <div style="display:flex;gap:8px;margin-top:12px;font-size:12px">
      <span style="color:#8a93a8">3.214 pasos</span><span style="flex:1"></span>
      <span style="color:#e8ecf6">lucia_g</span><span style="color:#8a93a8;width:40px;text-align:right;font-variant-numeric:tabular-nums">0:52</span>
    </div>
  </div>
  <div style="position:absolute;bottom:44px;left:46px;width:50px;height:50px;border-radius:25px;background:#ffffff26;display:flex;align-items:center;justify-content:center">
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8"><path d="M8 2h8l-1 6H9z"/><path d="M9 8v12a3 3 0 0 0 6 0V8"/></svg></div>
  <div style="position:absolute;bottom:44px;right:46px;width:50px;height:50px;border-radius:25px;background:#ffffff26;display:flex;align-items:center;justify-content:center">
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8"><rect x="3" y="7" width="18" height="13" rx="3"/><circle cx="12" cy="13.5" r="3.5"/><path d="M9 7l1.5-2.5h3L15 7"/></svg></div>
  <div style="position:absolute;bottom:9px;left:50%;transform:translateX(-50%);width:140px;height:5px;border-radius:3px;background:#fff"></div>
</div>`;
  });
  await page.waitForTimeout(1200);
  await foto('3-tarjeta-bloqueo-RECREACION', 'recreación: reemplazar por la captura del iPhone');
} finally {
  console.log('errores de la página:', errores.length ? errores.slice(0, 5) : 'ninguno');
  await nav.close();
  console.log('\n  borrando las cuentas de la sesión de fotos…');
  for (const c of cuentas) {
    const { error } = await borrarCuentaDePrueba(c.s);
    if (error) console.log(`  aviso: ${c.usuario} no se borró — ${error.message}`);
  }
  console.log(`  ${cuentas.length} borradas. Capturas en ${SALIDA}\n`);
}
