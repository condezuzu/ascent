// PUBLICAR UNA OTA, PERO SOLO SI LE VA A LLEGAR A ALGUIEN.
//
// El problema que esto vigila (27/9): durante días se publicaron OTAs contra
// una huella que no coincidía con ninguna build instalada, y `eas update`
// decía "Published!" igual — un éxito silencioso que no le llegaba a nadie.
// Acá una publicación al vacío es un ERROR, no un éxito: si la huella de ahora
// no coincide con una build REAL del canal, esto corta y no publica.
//
//   node supabase/publicar-ota.mjs <canal> "<mensaje>"
//
// El canal `store` NO se publica desde acá (es el build de la tienda).

import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { estadoDeHuella } from './huella.mjs';
import { exigirApagados } from './puertos.mjs';

const MOVIL = join(dirname(fileURLToPath(import.meta.url)), '..', 'movil');
const canal = process.argv[2];
const mensaje = process.argv[3];

if (!canal || !mensaje) {
  console.error('Uso: node supabase/publicar-ota.mjs <canal> "<mensaje>"');
  process.exit(1);
}
if (canal === 'store') {
  console.error('El canal `store` NO se publica desde acá.');
  process.exit(1);
}

// La huella es un retrato quieto: los dev servers, apagados.
await exigirApagados([3020, 8090]);

const { hash, builds, coinciden, motivo } = estadoDeHuella();
if (builds === null) {
  console.error(`No pude consultar EAS (${motivo}). NO publico sin confirmar que llegue.`);
  process.exit(2);
}

const enCanal = coinciden.filter((b) => b.canal === canal);
if (enCanal.length === 0) {
  console.error(`\nLa huella de ahora (${hash}) NO coincide con ninguna build del canal \`${canal}\`.`);
  console.error('Una OTA publicada así no le llegaría a nadie: hace falta una build nueva de ese canal.');
  const otras = coinciden.map((b) => `${b.id}/${b.canal}`).join(', ');
  console.error('Builds que SÍ coinciden con esta huella:', otras || '(ninguna)');
  process.exit(1);
}

console.log(`Huella ${hash} coincide con ${enCanal.map((b) => b.id).join(', ')} en \`${canal}\`. Publicando…\n`);
execFileSync('npx', ['eas', 'update', '--channel', canal, '--message', mensaje, '--non-interactive'], {
  cwd: MOVIL,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
