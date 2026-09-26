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
import { fileURLToPath, pathToFileURL } from 'node:url';
import { exigirApagados } from './puertos.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const MOVIL = join(RAIZ, 'movil');

/** Dónde se guarda el detalle de la última corrida, para poder comparar. */
const GUARDADO = join(RAIZ, 'capturas-tienda', '.huella.json');

/** La huella nativa de AHORA (el runtime que tendría lo que se publique hoy). */
export function calcular() {
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

/**
 * LAS BUILDS REALES, DE EAS — NO UN DATO A MANO (27/9).
 *
 * Antes la build instalada estaba escrita a mano acá y quedó vieja: durante
 * días la huella dijo "coincide" contra una build que ya no era la del
 * teléfono, y las OTAs se publicaban al vacío sin avisar. Es el mismo patrón
 * que el `finally` del barrido y el `:3020` del cierre: una herramienta que
 * miente en silencio. Ahora la verdad sale de EAS. Si no se puede consultar,
 * esto TIRA —no asume—: quien llama decide qué hacer con esa falla, pero nadie
 * publica una OTA creyendo que llega cuando no se pudo confirmar.
 */
export function buildsDeEas() {
  const salida = execFileSync(
    'npx',
    ['eas', 'build:list', '--platform', 'ios', '--limit', '20', '--json', '--non-interactive'],
    { cwd: MOVIL, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32' }
  );
  const arr = JSON.parse(salida);
  return arr
    .filter((b) => b.status === 'FINISHED' || b.status === 'finished')
    .map((b) => ({
      id: String(b.id ?? '').slice(0, 8),
      runtime: b.runtime?.version ?? b.fingerprint?.hash ?? null,
      canal: b.updateChannel?.name ?? b.buildProfile ?? '?',
      cuando: b.completedAt ?? b.createdAt ?? '',
    }))
    .filter((b) => b.runtime);
}

/**
 * El estado de la huella: la de ahora, las builds reales, y con cuáles coincide.
 * `builds` es null si EAS no se pudo consultar (y `motivo` dice por qué).
 */
export function estadoDeHuella() {
  const ahora = calcular();
  try {
    const builds = buildsDeEas();
    const coinciden = builds.filter((b) => b.runtime === ahora.hash);
    return { hash: ahora.hash, ahora, builds, coinciden, motivo: null };
  } catch (e) {
    return { hash: ahora.hash, ahora, builds: null, coinciden: [], motivo: String(e?.message ?? e).split('\n')[0] };
  }
}

function guardar(ahora) {
  try {
    mkdirSync(dirname(GUARDADO), { recursive: true });
    writeFileSync(GUARDADO, JSON.stringify(ahora));
  } catch {
    /* el guardado es una ayuda para el diff, no el resultado */
  }
}

// ---- COMO SCRIPT (`npm run huella`) ----
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  // Los dev servers, apagados: la huella es un retrato del proyecto quieto, y
  // un Metro reconstruyendo al lado es ruido. `FORZAR=1` lo saltea.
  await exigirApagados([3020, 8090]);
  const { hash, ahora, builds, coinciden, motivo } = estadoDeHuella();
  console.log(`\nhuella de ahora   : ${hash}\n`);
  guardar(ahora);

  if (builds === null) {
    console.error('NO PUDE CONSULTAR EAS para saber qué build hay de verdad:');
    console.error('  ' + motivo);
    console.error('\nSin eso NO se puede confirmar si una OTA llegaría. Revisá la sesión');
    console.error('(cd movil && npx eas whoami) y volvé a correr. NO asumo un valor viejo.\n');
    process.exit(2);
  }

  console.log('builds en EAS (iOS, terminadas):');
  for (const b of builds.slice(0, 8)) {
    console.log(`  ${b.runtime === hash ? '➜' : ' '} ${b.id}  canal ${String(b.canal).padEnd(9)}  runtime ${b.runtime}`);
  }
  console.log('');

  if (coinciden.length) {
    const canales = [...new Set(coinciden.map((b) => b.canal))];
    console.log(`COINCIDE con ${coinciden.length} build(s). Una OTA a ${canales.map((c) => `\`${c}\``).join(' / ')} le llega.\n`);
    process.exit(0);
  }

  console.log('NO COINCIDE con NINGUNA build: una OTA publicada ahora NO le llegaría a NADIE.');
  // QUÉ LA MOVIÓ, contra la última corrida guardada.
  if (existsSync(GUARDADO)) {
    try {
      const antes = JSON.parse(readFileSync(GUARDADO, 'utf8'));
      const clave = (s) => s.filePath ?? s.id ?? JSON.stringify(s).slice(0, 70);
      const deAntes = new Map((antes.sources ?? []).map((s) => [clave(s), s.hash]));
      const cambiadas = (ahora.sources ?? []).filter((s) => deAntes.get(clave(s)) !== s.hash);
      if (antes.hash !== hash && cambiadas.length) {
        console.log('Lo que cambió desde la última corrida:');
        for (const s of cambiadas.slice(0, 12)) console.log('  - ' + clave(s));
        if (cambiadas.length > 12) console.log(`  …y ${cambiadas.length - 12} más`);
      }
    } catch {
      /* si el guardado está roto, no es el problema de hoy */
    }
  }
  console.log('\nHace falta una BUILD nueva (o, si no cambió nada nativo, mirá los finales');
  console.log('de línea: movil/.gitattributes explica por qué pueden mover la huella).\n');
  process.exit(1);
}
