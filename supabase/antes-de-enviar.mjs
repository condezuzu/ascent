// ANTES DE MANDAR UNA BUILD A APPLE (16/10/2026).
//
// Revisa lo que se puede revisar desde acá y PREGUNTA lo que solo sabe el humano. No
// manda nada: no llama a `eas submit` ni habla con Apple. El envío lo hace Agustín.
//
// Lo que mira, de la build de store que se va a mandar (por omisión, la última terminada):
//   1. el número de build es el que se espera (`--numero`, o el de `movil/app.json`);
//   2. la versión es la que se espera (`--version`, por omisión 1.1.0);
//   3. Associated Domains: en el `app.json` con que se compiló, y en el perfil que quedó
//      ADENTRO del .ipa (lo baja de EAS, unos 30 MB; `--sin-ipa` lo saltea);
//   4. el runtime de la build es el que da este proyecto ahora: si no, una OTA hecha
//      desde acá no le llega a esa build (correrlo en la rama de donde salió);
//   5. que no haya nada en revisión: lo confirma el humano, mirando App Store Connect.
//
//   node supabase/antes-de-enviar.mjs [--build <id>] [--numero 9] [--version 1.1.0] [--sin-ipa]
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { inflateRawSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { calcular, llamadaAEas } from './huella.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
export const DOMINIO = 'applinks:ascent-blush-seven.vercel.app';

/** Un archivo de adentro de un .zip (un .ipa es un zip), sin dependencias. Sin zip64: un .ipa no llega. */
export function archivoDelZip(zip, quiere) {
  let fin = -1;
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 65557); i--) {
    if (zip.readUInt32LE(i) === 0x06054b50) {
      fin = i;
      break;
    }
  }
  if (fin < 0) throw new Error('no es un zip');
  const cuantos = zip.readUInt16LE(fin + 10);
  let p = zip.readUInt32LE(fin + 16);
  for (let n = 0; n < cuantos; n++) {
    if (zip.readUInt32LE(p) !== 0x02014b50) throw new Error('el índice del zip está roto');
    const metodo = zip.readUInt16LE(p + 10);
    const comprimido = zip.readUInt32LE(p + 20);
    const largoNombre = zip.readUInt16LE(p + 28);
    const largoExtra = zip.readUInt16LE(p + 30);
    const largoComentario = zip.readUInt16LE(p + 32);
    const local = zip.readUInt32LE(p + 42);
    const nombre = zip.toString('utf8', p + 46, p + 46 + largoNombre);
    if (quiere(nombre)) {
      const desde = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
      const datos = zip.subarray(desde, desde + comprimido);
      return { nombre, datos: metodo === 8 ? inflateRawSync(datos) : Buffer.from(datos) };
    }
    p += 46 + largoNombre + largoExtra + largoComentario;
  }
  return null;
}

/** El perfil de la APP (no el del widget, que está en PlugIns): ¿trae Associated Domains con el dominio? */
export function perfilDeLaApp(ipa) {
  const e = archivoDelZip(ipa, (n) => /^Payload\/[^/]+\.app\/embedded\.mobileprovision$/.test(n));
  if (!e) return { hay: false, conDominios: false, conElDominio: false };
  // El perfil es un CMS firmado, pero el plist va adentro en texto plano.
  const texto = e.datos.toString('latin1');
  const plist = texto.slice(texto.indexOf('<?xml'), texto.indexOf('</plist>') + 8);
  return {
    hay: true,
    conDominios: plist.includes('<key>com.apple.developer.associated-domains</key>'),
    conElDominio: plist.includes(DOMINIO),
    nombre: (plist.match(/<key>Name<\/key>\s*<string>([^<]*)<\/string>/) ?? [])[1] ?? '?',
  };
}

function argumento(args, nombre) {
  const i = args.indexOf(nombre);
  return i >= 0 ? args[i + 1] : undefined;
}

function buildsDeStore() {
  const l = llamadaAEas(['build:list', '--platform', 'ios', '--limit', '20', '--json', '--non-interactive']);
  const salida = execFileSync(l.comando, l.args, { ...l.opciones, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  return JSON.parse(salida).filter((b) => b.buildProfile === 'store');
}

async function preguntar(texto) {
  // Sin una terminal de verdad no hay a quién preguntarle: no se contesta por el humano.
  if (!process.stdin.isTTY) return null;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const r = (await rl.question(texto)).trim().toLowerCase();
  rl.close();
  return r === 's' || r === 'si' || r === 'sí';
}

async function principal() {
  const args = process.argv.slice(2);
  const appJson = JSON.parse(readFileSync(join(RAIZ, 'movil', 'app.json'), 'utf8')).expo;
  const numero = argumento(args, '--numero') ?? appJson.ios?.buildNumber;
  const version = argumento(args, '--version') ?? '1.1.0';
  const resultados = [];
  const anotar = (que, ok, detalle) => {
    resultados.push({ que, ok, detalle });
    console.log(`  ${ok === true ? 'ok  ' : ok === false ? 'MAL ' : '??  '} ${que}: ${detalle}`);
  };

  console.log('\nAntes de mandar a Apple (no se manda nada desde acá)\n');
  const pedida = argumento(args, '--build');
  const builds = buildsDeStore();
  const b = pedida ? builds.find((x) => x.id.startsWith(pedida)) : builds.find((x) => x.status === 'FINISHED');
  if (!b) {
    console.log(`  MAL  no encontré la build de store${pedida ? ` ${pedida}` : ' terminada'}`);
    process.exit(1);
  }
  console.log(`  build ${b.id} · ${b.appVersion} (${b.appBuildVersion}) · ${b.status} · commit ${String(b.gitCommitHash).slice(0, 7)}\n`);

  anotar('terminada y de store', b.status === 'FINISHED' && b.distribution === 'STORE', `${b.status}, ${b.distribution}`);
  anotar('número de build', String(b.appBuildVersion) === String(numero), `la build tiene ${b.appBuildVersion}, se espera ${numero}`);
  anotar('versión', b.appVersion === version, `la build tiene ${b.appVersion}, se espera ${version}`);

  // Associated Domains en la configuración con que se compiló.
  try {
    const conf = JSON.parse(execFileSync('git', ['show', `${b.gitCommitHash}:movil/app.json`], { cwd: RAIZ, encoding: 'utf8' })).expo;
    anotar('app.json de esa build pide los dominios', (conf.ios?.associatedDomains ?? []).includes(DOMINIO), (conf.ios?.associatedDomains ?? []).join(', ') || 'no tiene associatedDomains');
  } catch {
    anotar('app.json de esa build pide los dominios', null, `no encontré el commit ${b.gitCommitHash} acá`);
  }

  // Y en el perfil que quedó adentro del .ipa, que es lo que mira Apple.
  if (args.includes('--sin-ipa')) {
    anotar('perfil del .ipa con Associated Domains', null, 'salteado (--sin-ipa)');
  } else if (!b.artifacts?.buildUrl) {
    anotar('perfil del .ipa con Associated Domains', null, 'la build no tiene .ipa para bajar');
  } else {
    const r = await fetch(b.artifacts.buildUrl);
    if (!r.ok) {
      anotar('perfil del .ipa con Associated Domains', null, `no se pudo bajar el .ipa (${r.status})`);
    } else {
      const p = perfilDeLaApp(Buffer.from(await r.arrayBuffer()));
      anotar(
        'perfil del .ipa con Associated Domains',
        p.hay && p.conDominios && p.conElDominio,
        !p.hay ? 'el .ipa no tiene perfil' : `perfil «${p.nombre}»: ${p.conDominios ? 'con' : 'SIN'} la capacidad, ${p.conElDominio ? 'con' : 'SIN'} ${DOMINIO}`
      );
    }
  }

  // El runtime: lo que da este proyecto ahora contra lo que tiene la build.
  const rama = execFileSync('git', ['branch', '--show-current'], { cwd: RAIZ, encoding: 'utf8' }).trim();
  const ahora = calcular().hash;
  anotar(
    'runtime: una OTA desde acá le llega',
    ahora === b.runtime?.version,
    `la build ${String(b.runtime?.version).slice(0, 12)}…, este proyecto (${rama}) ${ahora.slice(0, 12)}…`
  );

  // Lo único que no se puede mirar desde acá.
  const enRevision = await preguntar('\n  ¿Confirmaste en App Store Connect que no hay nada en revisión ni ninguna build enviada? (s/n) ');
  anotar('nada en revisión (lo confirma el humano)', enRevision, enRevision === null ? 'sin terminal para preguntar: confirmalo a mano' : enRevision ? 'confirmado' : 'NO confirmado');

  const malos = resultados.filter((x) => x.ok !== true);
  console.log(
    malos.length === 0
      ? '\nLISTA. Desde acá no se manda nada: el envío lo hacés vos.\n'
      : `\nNO ENVIAR TODAVÍA: ${malos.map((x) => x.que).join('; ')}.\n`
  );
  process.exit(malos.length === 0 ? 0 : 1);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await principal();
