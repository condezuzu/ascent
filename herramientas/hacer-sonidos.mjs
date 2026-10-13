// Los dos archivos de sonido de la build 8. Sin dependencias: WAV PCM 16 bits, mono, 44,1 kHz.
//
//   node herramientas/hacer-sonidos.mjs                      → solo el silencio
//   node herramientas/hacer-sonidos.mjs <recorte.wav> [dB]   → además, el aviso a partir de ese recorte
//
// El aviso NO se sintetiza: es un recorte de un archivo que trajo el humano
// (ver spec/sonido-del-aviso.md). Acá solo se le sube el volumen.
import fs from 'node:fs';
const FS = 44100;

function wav(muestras) {
  const datos = Buffer.alloc(muestras.length * 2);
  muestras.forEach((m, i) => datos.writeInt16LE(Math.round(Math.max(-1, Math.min(1, m)) * 32767), i * 2));
  const cab = Buffer.alloc(44);
  cab.write('RIFF', 0);
  cab.writeUInt32LE(36 + datos.length, 4);
  cab.write('WAVEfmt ', 8);
  cab.writeUInt32LE(16, 16);
  cab.writeUInt16LE(1, 20); // PCM
  cab.writeUInt16LE(1, 22); // mono
  cab.writeUInt32LE(FS, 24);
  cab.writeUInt32LE(FS * 2, 28);
  cab.writeUInt16LE(2, 32);
  cab.writeUInt16LE(16, 34);
  cab.write('data', 36);
  cab.writeUInt32LE(datos.length, 40);
  return Buffer.concat([cab, datos]);
}

function leer(ruta) {
  const b = fs.readFileSync(ruta);
  const m = [];
  for (let i = 44; i + 1 < b.length; i += 2) m.push(b.readInt16LE(i) / 32768);
  return m;
}

// La energía de la parte que SUENA: con los silencios adentro, un sonido corto
// y uno largo igual de fuertes dan números distintos.
function medir(m) {
  const sonando = m.filter((v) => Math.abs(v) > 0.01);
  let suma = 0;
  let pico = 0;
  for (const v of sonando) suma += v * v;
  for (const v of m) pico = Math.max(pico, Math.abs(v));
  return { seg: m.length / FS, pico, db: 20 * Math.log10(Math.sqrt(suma / Math.max(1, sonando.length))) };
}
const decir = (nombre, r) => console.log(`${nombre}: ${r.seg.toFixed(2)} s, pico ${r.pico.toFixed(2)}, ${r.db.toFixed(1)} dBFS mientras suena`);

// EL SILENCIO: medio segundo de nada. Una notificación con este "sonido" hace
// vibrar el teléfono sin sonar: es lo que usa "Sonido al terminar" apagado.
fs.writeFileSync('movil/assets/silencio.wav', wav(new Array(Math.round(0.5 * FS)).fill(0)));

const [recorte, db] = process.argv.slice(2);
if (recorte) {
  const original = leer(recorte);
  const campana = medir(leer('movil/assets/campana.wav'));
  // Sin número, se iguala a la campana de antes.
  const sube = db === undefined ? campana.db - medir(original).db : Number(db);
  const aviso = original.map((v) => v * 10 ** (sube / 20));
  const r = medir(aviso);
  if (r.pico >= 1) throw new Error(`Con ${sube.toFixed(1)} dB el pico llega a ${r.pico.toFixed(2)}: recorta.`);
  fs.writeFileSync('movil/assets/aviso-descanso.wav', wav(aviso));
  decir('el recorte   ', medir(original));
  decir('la campana   ', campana);
  decir(`el aviso (+${sube.toFixed(1)} dB)`, r);
}
