// ¿LA ACTUALIZACIÓN LE VA A LLEGAR AL TELÉFONO?
//
// EL PROBLEMA QUE ESTO VIGILA ES SILENCIOSO, y por eso existe un script. Una
// actualización por el aire solo le llega a las builds cuya **huella nativa**
// es idéntica a la del proyecto en el momento de publicar. Si no coincide,
// `eas update` igual dice "Published!" y el teléfono no recibe nada: no hay
// error, no hay aviso, y se descubre cuando alguien pregunta por qué no ve el
// cambio que se subió hace tres días.
//
// Y LA HUELLA SE MUEVE POR COSAS QUE NO PARECEN CÓDIGO. Se hashean los BYTES
// de `app.json`, `eas.json`, `.gitignore`, los config plugins y lo nativo
// propio — así que alcanza con un final de línea distinto para romperla sin
// cambiar una sola línea. Pasó el 23/9 al mergear la rama de la Live Activity
// (ver `movil/.gitattributes`).
//
// QUÉ HACE: compara la huella de ahora contra la de la build instalada, que
// está anotada abajo. Si no coinciden, dice qué archivo la movió.
//
//   npm run huella
//
// CUANDO SE INSTALA UNA BUILD NUEVA, se cambia `INSTALADA` acá. Es a mano y a
// propósito: es el único lugar donde está escrito qué hay en el teléfono de
// verdad, y una nota vieja es peor que no tener nota.

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const MOVIL = join(RAIZ, 'movil');

/** La build que el humano tiene puesta, y su versión de ejecución. */
const INSTALADA = {
  id: 'a4aaf8d4',
  runtime: '150d200e43c0d9addf3cee2ad25eb40a0c9fce87',
  cuando: '23/9/2026',
  que: 'la primera con la Live Activity del descanso',
};

/** Dónde se guarda el detalle de la última corrida, para poder comparar. */
const GUARDADO = join(RAIZ, 'capturas-tienda', '.huella.json');

function calcular() {
  // `shell: true` EN WINDOWS y no un `.cmd` a mano: desde Node 20, spawnear un
  // `.cmd` directo tira EINVAL —es el arreglo de una vulnerabilidad de
  // inyección de argumentos— y `npx` en Windows ES un `.cmd`.
  const salida = execFileSync('npx', ['expo-updates', 'fingerprint:generate', '--platform', 'ios'], {
    cwd: MOVIL,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'ignore'],
    shell: process.platform === 'win32',
  });
  return JSON.parse(salida);
}

const ahora = calcular();
const coincide = ahora.hash === INSTALADA.runtime;

console.log(`\nhuella de ahora   : ${ahora.hash}`);
console.log(`build ${INSTALADA.id} (${INSTALADA.cuando}) : ${INSTALADA.runtime}`);
console.log(`  ${INSTALADA.que}\n`);

if (coincide) {
  console.log('IGUALES: una actualización publicada ahora le llega al teléfono.\n');
} else {
  console.log('DISTINTAS: lo que se publique ahora NO le llega a esa build.\n');
  // QUÉ LA MOVIÓ, que es la pregunta siguiente y la que cuesta contestar a
  // mano: son cientos de fuentes y la mayoría son archivos de node_modules.
  if (existsSync(GUARDADO)) {
    try {
      const antes = JSON.parse(readFileSync(GUARDADO, 'utf8'));
      const clave = (s) => s.filePath ?? s.id ?? JSON.stringify(s).slice(0, 70);
      const deAntes = new Map((antes.sources ?? []).map((s) => [clave(s), s.hash]));
      const cambiadas = ahora.sources.filter((s) => deAntes.get(clave(s)) !== s.hash);
      if (antes.hash === INSTALADA.runtime && cambiadas.length) {
        console.log('Lo que cambió desde la última corrida que sí coincidía:');
        for (const s of cambiadas.slice(0, 12)) console.log('  - ' + clave(s));
        if (cambiadas.length > 12) console.log(`  …y ${cambiadas.length - 12} más`);
        console.log('');
      }
    } catch {
      /* si el guardado está roto, no es el problema de hoy */
    }
  }
  console.log('Si el cambio es NATIVO a propósito, hace falta una build nueva.');
  console.log('Si no cambió nada nativo, mirá los finales de línea:');
  console.log('  movil/.gitattributes explica por qué eso puede moverla.\n');
}

// Se guarda SIEMPRE, también cuando falla: la próxima corrida necesita saber
// contra qué comparar, y la última que coincidió es la referencia útil.
mkdirSync(dirname(GUARDADO), { recursive: true });
writeFileSync(GUARDADO, JSON.stringify(ahora));

process.exit(coincide ? 0 : 1);
