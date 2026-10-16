// ¿Producción ya sirve ESTE commit? Correr con:
//   npm run verificar:deploy              mira una vez
//   npm run verificar:deploy -- esperar   insiste hasta 10 minutos
//
// LE PREGUNTA AL DEPLOY QUÉ COMMIT ES (`/version`, que lee lo que Vercel pone
// en el entorno) y lo compara con el `HEAD` de acá. Hace falta antes de una
// migración de ORDEN INVERTIDO: primero desplegar, después correrla.
//
// Hasta el 13/10/2026 buscaba una MARCA elegida a mano en cada tanda —un texto
// que solo tuviera el cliente nuevo— y casi nunca había una: dio "no
// concluyente" tres veces seguidas. Una verificación que nunca verifica da
// confianza falsa.
//
// Deducirlo sigue sin servir (ver trampas.md): el nombre de los chunks cambia
// por el entorno, y los textos obvios están antes y después.
//
// TRES VEREDICTOS, y solo el primero sale con 0:
//   DESPLEGADO     el deploy dice el mismo commit que HEAD
//   TODAVÍA VIEJO  dice otro
//   NO SUPE MIRAR  no contestó, o contestó sin commit
import { execSync } from 'node:child_process';
import { limiteDeSonda } from './utiles.mjs';

// Ninguna sonda corre sin limite (ver utiles.mjs).
limiteDeSonda(12);

const BASE = process.env.DEPLOY_URL ?? 'https://ascent-blush-seven.vercel.app';
const ESPERAR = process.argv.includes('esperar');
const CADA_MS = 15_000;
const HASTA_MS = 10 * 60_000;

const git = (orden) => execSync(`git ${orden}`, { encoding: 'utf8' }).trim();
const aca = git('rev-parse HEAD');
// Lo que GitHub tiene, según la última vez que se le preguntó: sin red no se actualiza.
const subido = (() => {
  try {
    return git('rev-parse origin/main');
  } catch {
    return null;
  }
})();
const corto = (c) => c.slice(0, 7);

/** `{ commit }` si el deploy lo dijo; `{ porQue }` si no se pudo saber. */
async function preguntar() {
  let r;
  try {
    // El parámetro es para que ninguna caché del camino conteste por el deploy.
    r = await fetch(`${BASE}/version?t=${Date.now()}`, { redirect: 'manual', cache: 'no-store' });
  } catch (e) {
    return { porQue: `no contestó (${e?.cause?.code ?? e?.message ?? 'sin red'})` };
  }
  if (r.status === 404) return { porQue: '/version no existe: ese deploy es anterior a esta sonda' };
  if (r.status >= 300 && r.status < 400) return { porQue: `/version rebota a ${r.headers.get('location')}: ese deploy es anterior a esta sonda, o /version dejó de ser pública` };
  if (!r.ok) return { porQue: `/version contestó ${r.status}` };
  const commit = (await r.json().catch(() => null))?.commit;
  if (typeof commit !== 'string' || !/^[0-9a-f]{40}$/.test(commit)) return { porQue: 'contestó sin commit: no es un deploy de Vercel, o Vercel dejó de exponerlo' };
  return { commit };
}

console.log(BASE);
console.log(`Acá: ${corto(aca)}`);
// Un commit que no se subió no puede estar desplegado: se dice antes de mirar.
if (subido && subido !== aca) console.log(`OJO: GitHub tiene ${corto(subido)}, no este. Sin push, producción no va a llegar nunca.`);

const empezo = Date.now();
let visto = await preguntar();
while (ESPERAR && visto.commit !== aca && Date.now() - empezo < HASTA_MS) {
  console.log(`  ${visto.commit ? `sirve ${corto(visto.commit)}` : visto.porQue}; espero…`);
  await new Promise((ok) => setTimeout(ok, CADA_MS));
  visto = await preguntar();
}

// EL MIDDLEWARE NO PUEDE DESLOGUEAR POR UN HIPO DE RED (ver trampas.md).
// Pregunta por el COMPORTAMIENTO: con una cookie de sesión que no sirve, el
// middleware deja pasar —no pudo confirmar, así que no desloguea—. Un 3xx acá
// significa que volvió el bug que dejaba a alguien afuera de su propia app.
{
  const r = await fetch(`${BASE}/stats`, {
    redirect: 'manual',
    headers: { cookie: 'sb-okeanaihymbvbdmrdqph-auth-token=basura' },
  }).catch(() => null);
  if (!r) {
    console.log('  --   no pude comprobar el middleware (sin red)');
  } else if (r.status >= 300 && r.status < 400) {
    console.log(`  ATENCIÓN: con una cookie rota rebota a ${r.headers.get('location')}`);
    console.log('       Volvió el bug de deslogueo. Ver trampas.md.');
  } else {
    console.log('  ok   con una cookie de sesión rota no desloguea');
  }
}

// `exitCode` y no `exit()`: cortar con pedidos a medio cerrar revienta en Windows.
if (!visto.commit) {
  console.log(`\nNO SUPE MIRAR: ${visto.porQue}.`);
  process.exitCode = 1;
} else if (visto.commit !== aca) {
  console.log(`\nTODAVÍA VIEJO: producción sirve ${corto(visto.commit)}, no ${corto(aca)}.`);
  console.log('NO corras una migración de orden invertido hasta que el deploy termine.');
  process.exitCode = 1;
} else {
  console.log(`\nDESPLEGADO: producción sirve ${corto(aca)}.`);
}
