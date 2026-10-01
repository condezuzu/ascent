// PUBLICAR UNA OTA, PERO SOLO SI LE VA A LLEGAR A ALGUIEN.
//
// El problema que esto vigila (27/9): durante días se publicaron OTAs contra
// una huella que no coincidía con ninguna build instalada, y `eas update`
// decía "Published!" igual — un éxito silencioso que no le llegaba a nadie.
// Acá una publicación al vacío es un ERROR, no un éxito.
//
// LA VERDAD SALE DEL REGISTRO DE EAS, NO DE UN CÁLCULO SUELTO. La huella de
// ahora se calcula con la MISMA herramienta que usa EAS (`expo-updates
// fingerprint:generate`, en `huella.mjs`), pero eso NO es lo que autoriza a
// publicar: lo que autoriza es que esa huella APAREZCA como el `runtime` de una
// build REAL y terminada del canal, leído de `eas build:list`. Si no está en el
// registro, esto corta. Así, aunque el cálculo local derivara distinto de lo que
// EAS guardó, nunca se publica hacia una huella que ninguna build tiene: en el
// peor caso se niega (seguro), nunca publica al vacío.
//
//   node supabase/publicar-ota.mjs <canal> "<mensaje>"
//   node supabase/publicar-ota.mjs store "arreglo" --simular          (no publica)
//   node supabase/publicar-ota.mjs store "x" --simular --huella-de-prueba <hash>
//        (para VER el freno: fuerza una huella y comprueba que se niega)
//
// El canal `store` es el de la build de la tienda: los OTA de arreglo del app
// publicado van ahí. Se publica solo si una build `store` del registro lleva
// esta huella.

import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { estadoDeHuella } from './huella.mjs';
import { exigirApagados } from './puertos.mjs';

const MOVIL = join(dirname(fileURLToPath(import.meta.url)), '..', 'movil');
const args = process.argv.slice(2);
const simular = args.includes('--simular');
// SOLO para el dry-run: forzar la huella "de ahora" y así demostrar que el freno
// corta cuando no coincide. Fuera de `--simular` está prohibido —no se publica
// jamás con una huella inventada—.
const iHuella = args.indexOf('--huella-de-prueba');
const huellaDePrueba = iHuella >= 0 ? args[iHuella + 1] : null;
const positional = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--huella-de-prueba');
const canal = positional[0];
const mensaje = positional[1];

if (!canal || !mensaje) {
  console.error('Uso: node supabase/publicar-ota.mjs <canal> "<mensaje>" [--simular] [--huella-de-prueba <hash>]');
  process.exit(1);
}
if (huellaDePrueba && !simular) {
  console.error('`--huella-de-prueba` SOLO se permite con `--simular`: no se publica con una huella inventada.');
  process.exit(1);
}

// La huella es un retrato quieto: los dev servers, apagados.
await exigirApagados([3020, 8090]);

const estado = estadoDeHuella();
const { builds, motivo } = estado;
// La huella efectiva: la real, salvo en un dry-run que la fuerza para probar el freno.
const hash = huellaDePrueba ?? estado.hash;
if (huellaDePrueba) console.log(`(dry-run con huella forzada: ${hash})`);

if (builds === null) {
  console.error(`No pude consultar EAS (${motivo}). NO publico sin confirmar que llegue.`);
  process.exit(2);
}

// EL FRENO: la huella tiene que ser el runtime de una build REAL del canal,
// leído del registro. No se confía en el cálculo: se confía en lo que EAS tiene.
const enCanal = builds.filter((b) => b.canal === canal && b.runtime === hash);
if (enCanal.length === 0) {
  console.error(`\nLa huella ${hash} NO es el runtime de ninguna build \`${canal}\` en el registro de EAS.`);
  console.error('Una OTA publicada así no le llegaría a nadie: hace falta una build nueva de ese canal.');
  const otras = builds.filter((b) => b.runtime === hash).map((b) => `${b.id}/${b.canal}`).join(', ');
  console.error('Builds del registro con esta huella:', otras || '(ninguna)');
  process.exit(1);
}

console.log(`Huella ${hash} = runtime de la build ${enCanal.map((b) => b.id).join(', ')} en \`${canal}\` (registro EAS).`);
if (simular) {
  console.log('DRY-RUN: coincide, PUBLICARÍA. No se publicó nada (--simular).\n');
  process.exit(0);
}
console.log('Publicando…\n');
// EL MENSAJE VA ENTRECOMILLADO (bug de Windows, 29/9). Con `shell: true` —que en
// Windows hace falta para correr `npx.cmd`— los args se pegan en una linea de
// comando SIN comillas, asi que un mensaje con espacios, comas o parentesis lo
// re-parte cmd.exe y `eas update` falla. Se lo envuelve en comillas (sacando las
// comillas internas, que romperian el entrecomillado) para que viaje como un arg.
const mensajeArg = process.platform === 'win32' ? `"${mensaje.replace(/"/g, '')}"` : mensaje;
execFileSync('npx', ['eas-cli', 'update', '--channel', canal, '--message', mensajeArg, '--non-interactive'], {
  cwd: MOVIL,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
