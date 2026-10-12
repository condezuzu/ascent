// Genera los dos archivos de sonido de la build 8. Sin dependencias: WAV PCM 16 bits, mono, 44,1 kHz.
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

// LA CAMPANA NUEVA. Cuatro golpes en 2,4 s (la de antes: tres en uno). Cada
// golpe es una campana: la fundamental y tres parciales que no son múltiplos
// exactos, que es lo que la hace sonar a metal y no a pitido. La energía va
// entre 1,5 y 6,5 kHz: donde el oído es más sensible y donde la música y la voz
// de un video tienen menos, así se separa sin tapar nada.
const DURA = 2.4;
const GOLPES = [0, 0.42, 0.84, 1.26];
const F0 = 1568; // sol 6
const PARCIALES = [[1, 1], [2.0, 0.6], [2.76, 0.45], [4.07, 0.25]];
const n = Math.round(DURA * FS);
const s = new Float64Array(n);
for (const t0 of GOLPES) {
  for (let i = Math.round(t0 * FS); i < n; i++) {
    const t = i / FS - t0;
    const ataque = Math.min(1, t / 0.003); // 3 ms: sin clic
    const cae = Math.exp(-t / 0.33);
    let v = 0;
    for (const [mult, amp] of PARCIALES) v += amp * Math.sin(2 * Math.PI * F0 * mult * t) * Math.exp(-t * (mult - 1) * 1.2);
    s[i] += v * ataque * cae;
  }
}
// Compresión suave (sube lo que se percibe sin recortar feo) y al 97 % de la escala.
let pico = 0;
for (let i = 0; i < n; i++) {
  s[i] = Math.tanh(1.5 * s[i]);
  pico = Math.max(pico, Math.abs(s[i]));
}
// Cola: los últimos 60 ms bajan a cero, para que no termine en un chasquido.
const cola = Math.round(0.06 * FS);
const fuerte = Array.from(s, (v, i) => (v / pico) * 0.97 * (i > n - cola ? (n - i) / cola : 1));
fs.writeFileSync('movil/assets/aviso-descanso.wav', wav(fuerte));

// EL SILENCIO: medio segundo de nada. Una notificación con este "sonido" hace
// vibrar el teléfono sin sonar: es lo que usa "Sonido al terminar" apagado.
fs.writeFileSync('movil/assets/silencio.wav', wav(new Array(Math.round(0.5 * FS)).fill(0)));

const rms = Math.sqrt(fuerte.reduce((a, v) => a + v * v, 0) / n);
console.log(`aviso-descanso.wav: ${DURA} s, pico ${Math.max(...fuerte.map(Math.abs)).toFixed(2)}, RMS ${rms.toFixed(3)} (${(20 * Math.log10(rms)).toFixed(1)} dBFS)`);
