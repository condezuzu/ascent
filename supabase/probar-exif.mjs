// ¿DE VERDAD SE VAN LAS COORDENADAS AL SUBIR UNA FOTO?
//
// La promesa nueva es fuerte —"tus fotos ya no llevan la ubicación de tu
// gimnasio"— y no se puede sostener con "el canvas no copia metadatos, es
// obvio". Esto arma un JPEG con un GPS REAL adentro, lo mete por la interfaz
// de verdad —el mismo input de archivo que toca el usuario—, y después BAJA
// de Supabase el objeto que quedó guardado y le mira los bytes.
//
// POR QUÉ POR LA INTERFAZ Y NO LLAMANDO A `prepararFoto`. Importar la función
// suelta probaría que la función limpia, no que la app la usa: si mañana
// alguien vuelve a pasar el `File` original al `upload`, un test de la función
// seguiría en verde y la fuga estaría de vuelta. Lo que hay que comprobar es
// lo que TERMINA en el storage.
//
//   node --env-file=.env.local supabase/probar-exif.mjs
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUERTO = Number(process.env.EXIF_PUERTO ?? 3027);
const BASE = `http://localhost:${PUERTO}`;

const MARCA_EXIF = Buffer.from([0x45, 0x78, 0x69, 0x66, 0x00, 0x00]); // "Exif\0\0"
const PUNTERO_GPS = Buffer.from([0x25, 0x88]); // tag 0x8825 en little-endian

// ---------------------------------------------------------------
// UN JPEG CON COORDENADAS ADENTRO
//
// APP1 mínimo pero legítimo: cabecera "Exif\0\0", TIFF little-endian, un IFD0
// con un campo que apunta al IFD de GPS, y ahí latitud y longitud como tres
// racionales cada una — la forma exacta en que lo escribe una cámara.
// ---------------------------------------------------------------
const GRADOS = [34, 54, 30]; // 34° 54' 30" S — Montevideo
const MINUTOS = [56, 10, 15]; // 56° 10' 15" O

function conGps(jpegBase) {
  const b = [];
  const u8 = (n) => b.push(n & 255);
  const u16 = (n) => { u8(n); u8(n >> 8); };
  const u32 = (n) => { u16(n); u16(n >> 16); };
  for (const ch of 'Exif') u8(ch.charCodeAt(0));
  u8(0); u8(0);
  u8(0x49); u8(0x49); u16(42); u32(8);   // "II", 42, IFD0 en el offset 8
  u16(1);
  u16(0x8825); u16(4); u32(1); u32(26);  // GPSInfoIFDPointer -> 26
  u32(0);
  u16(2);                                 // IFD de GPS: dos campos
  u16(0x0002); u16(5); u32(3); u32(56);  // GPSLatitude  -> 56
  u16(0x0004); u16(5); u32(3); u32(80);  // GPSLongitude -> 80
  u32(0);
  for (const n of [...GRADOS, ...MINUTOS]) { u32(n); u32(1); }
  const app1 = Buffer.from(b);
  const largo = app1.length + 2;
  return Buffer.concat([
    jpegBase.subarray(0, 2), // SOI
    Buffer.from([0xff, 0xe1, largo >> 8, largo & 255]), // marcador APP1
    app1,
    jpegBase.subarray(2),
  ]);
}

// ---------------------------------------------------------------
let fallos = 0;
const chequear = (que, obtuve, esperaba) => {
  const bien = JSON.stringify(obtuve) === JSON.stringify(esperaba);
  console.log(
    `  ${bien ? 'ok  ' : 'FALLA'} ${que}${bien ? '' : ` — esperaba ${JSON.stringify(esperaba)}, obtuve ${JSON.stringify(obtuve)}`}`
  );
  if (!bien) fallos++;
};

const entorno = { ...process.env, NEXT_DIST_DIR: '.next-exif' };
console.log('  compilando…');
const compilacion = spawnSync('npx', ['next', 'build'], {
  cwd: RAIZ, shell: true, stdio: ['ignore', 'pipe', 'pipe'], env: entorno, encoding: 'utf8',
});
if (compilacion.status !== 0) {
  console.log('NO COMPILA:\n' + (compilacion.stdout ?? ''));
  process.exit(1);
}
const servidor = spawn('npx', ['next', 'start', '-p', String(PUERTO)], {
  cwd: RAIZ, shell: true, stdio: ['ignore', 'pipe', 'pipe'], env: entorno,
});
const cerrar = () => {
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(servidor.pid), '/f', '/t'], { stdio: 'ignore' });
  } else servidor.kill('SIGTERM');
};
process.on('exit', cerrar);
for (let i = 0; i < 90; i++) {
  if (await fetch(BASE + '/login', { redirect: 'manual' }).then(() => true).catch(() => false)) break;
  await new Promise((r) => setTimeout(r, 1000));
}

const nav = await chromium.launch();
const page = await nav.newPage({ viewport: { width: 390, height: 844 } });

// El JPEG base lo hace el propio navegador: así no hace falta traer ninguna
// biblioteca de imágenes solo para armar uno.
await page.goto(BASE + '/galeria', { waitUntil: 'domcontentloaded' });
const baseB64 = await page.evaluate(async () => {
  const c = document.createElement('canvas');
  c.width = 2400;
  c.height = 1800;
  const cx = c.getContext('2d');
  cx.fillStyle = '#22384f';
  cx.fillRect(0, 0, 2400, 1800);
  cx.fillStyle = '#f0c040';
  cx.fillRect(200, 200, 900, 700);
  const b = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.92));
  const buf = new Uint8Array(await b.arrayBuffer());
  let s = '';
  for (const x of buf) s += String.fromCharCode(x);
  return btoa(s);
});
const conExif = conGps(Buffer.from(baseB64, 'base64'));
const ruta = join(tmpdir(), `ascent-exif-${Date.now()}.jpg`);
writeFileSync(ruta, conExif);

console.log('\nLa foto que se sube');
chequear('el archivo de entrada TIENE cabecera Exif', conExif.includes(MARCA_EXIF), true);
chequear('y tiene el puntero al IFD de GPS', conExif.includes(PUNTERO_GPS), true);

// ---- subirla por la interfaz de verdad ----
await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
await page.locator('input[type=email]').fill(process.env.CONEXION_EMAIL);
await page.locator('input[type=password]').fill(process.env.CONEXION_PASSWORD);
await page.getByRole('button', { name: 'Entrar', exact: true }).click();
await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 180000 });

// El botón cambia según si el día ya estaba registrado; los dos abren la hoja.
const abrir = page.getByRole('button', { name: /Registrar día|Foto/ }).first();
await abrir.waitFor({ timeout: 60000 });
await abrir.click();
await page.locator('.hoja').waitFor({ timeout: 30000 });
await page.locator('.hoja input[type=file]').setInputFiles(ruta);
await page
  .locator('.hoja')
  .getByRole('button', { name: /Registrar|Guardar|Sumar|Listo/ })
  .first()
  .click();
await page.locator('.hoja').waitFor({ state: 'detached', timeout: 60000 }).catch(() => {});

// ---- bajar lo que QUEDÓ guardado ----
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
await supabase.auth.signInWithPassword({
  email: process.env.CONEXION_EMAIL,
  password: process.env.CONEXION_PASSWORD,
});
const {
  data: { user },
} = await supabase.auth.getUser();
const { data: fotos } = await supabase
  .from('photos')
  .select('id, storage_path, creado')
  .eq('user_id', user.id)
  .order('creado', { ascending: false })
  .limit(1);

console.log('\nLo que quedó en el storage');
if (!fotos?.length) {
  console.log('  FALLA no se subió ninguna foto — no se puede comprobar nada');
  fallos++;
} else {
  const { data: bajado, error } = await supabase.storage
    .from('fotos')
    .download(fotos[0].storage_path);
  if (error) {
    console.log('  FALLA no se pudo bajar:', error.message);
    fallos++;
  } else {
    const salida = Buffer.from(await bajado.arrayBuffer());
    chequear('NO tiene cabecera Exif', salida.includes(MARCA_EXIF), false);
    chequear('NO tiene el puntero de GPS', salida.includes(PUNTERO_GPS), false);
    // Los números crudos también, por si algún día el EXIF llegara en otro
    // formato y la cabecera no alcanzara para encontrarlo.
    const crudo = Buffer.alloc(8);
    crudo.writeUInt32LE(GRADOS[2], 0);
    crudo.writeUInt32LE(1, 4);
    chequear('NO están los segundos de la latitud sueltos', salida.includes(crudo), false);
    chequear('sigue siendo un JPEG', salida.subarray(0, 2).equals(Buffer.from([0xff, 0xd8])), true);
    // Achicar es un efecto secundario, pero si NO achicó tampoco recodificó.
    chequear('pesa menos que el original', salida.length < conExif.length, true);
    console.log(
      `  --   entró ${(conExif.length / 1024).toFixed(0)} kB, salió ${(salida.length / 1024).toFixed(0)} kB`
    );
  }
  // La foto de prueba no se queda en la cuenta.
  await supabase.storage.from('fotos').remove([fotos[0].storage_path]);
  await supabase.from('photos').delete().eq('id', fotos[0].id);
}

unlinkSync(ruta);
await nav.close();
cerrar();
console.log(`\n${fallos === 0 ? 'todo ok' : fallos + ' fallaron'}`);
process.exit(fallos ? 1 : 0);
