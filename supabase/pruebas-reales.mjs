// LAS PRUEBAS CONTRA LA BASE DE VERDAD, de una. Se corren al final de cada
// tanda, igual que las capturas.
//
// POR QUÉ EXISTE: `test:db` prueba el schema en PGlite, con la red perfecta y
// el storage imitado. Las cuatro de acá usan Supabase real y cuentas
// descartables, y en su primera corrida (15/9/2026) encontraron seis bugs que
// PGlite no podía ver: el día que se borraba al terminar sin señal, la vida que
// decía "guardada" sin guardarse, la foto que la nativa tiraba, la visita al
// gimnasio que no vencía, las series que no subían solas y las funciones que
// contaban datos ajenos. Lo que no se vuelva a correr, se pierde.
//
//   1. simular-cuatro-semanas — la racha, las vidas, las sesiones y la red
//      cortándose, por la API.
//   2. probar-privacidad — qué ve otra persona, siendo amiga y sin serlo.
//   3. bateria-dos-apps — la web y la nativa con el mismo guion, por la
//      pantalla y desde una cuenta nueva: es también la PRIMERA VEZ de las dos
//      (cuenta → nombre → recorrido y gimnasio → sesión que crea el día →
//      primera marca → primera foto → Stats). Reemplaza a `primera-vez.mjs`,
//      que había quedado atrás de la pantalla actual.
//
// NECESITA LOS DOS DEV SERVERS PRENDIDOS: la web en :3020 y la nativa en
// :8090. No los levanta: compilar mientras otro dev server corre es justo lo
// que no se hace en este repo.
//
// Borra lo que crea. Si una prueba revienta a la mitad, igual intenta borrar
// su cuenta; lo que no pueda, lo dice.
//
//   npm run test:real            (las tres)
//   npm run test:real -- api     (sin navegador: 1 y 2)
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const DIR = dirname(fileURLToPath(import.meta.url));
const soloApi = process.argv.includes('api');

const PRUEBAS = [
  { nombre: 'cuatro semanas', archivo: 'simular-cuatro-semanas.mjs', args: [] },
  { nombre: 'privacidad', archivo: 'probar-privacidad.mjs', args: [] },
  ...(soloApi ? [] : [{ nombre: 'web y nativa', archivo: 'bateria-dos-apps.mjs', args: ['ambas'], navegador: true }]),
];

if (!soloApi) {
  const vivo = (u) => fetch(u, { redirect: 'manual' }).then(() => true).catch(() => false);
  const faltan = [];
  if (!(await vivo('http://localhost:3020/login'))) faltan.push('la web en :3020 (npm run dev)');
  if (!(await vivo('http://localhost:8090'))) faltan.push('la nativa en :8090 (movil/dev-web.cmd)');
  if (faltan.length) {
    console.log(`Faltan prendidos: ${faltan.join(' y ')}.\nO corré solo las de la API: npm run test:real -- api`);
    process.exit(1);
  }
}

function correr({ archivo, args }) {
  return new Promise((resolver) => {
    const hijo = spawn(
      process.execPath,
      ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', join(DIR, archivo), ...args],
      { env: process.env, stdio: ['ignore', 'pipe', 'pipe'] }
    );
    let salida = '';
    const juntar = (d) => {
      salida += d;
      process.stdout.write(d);
    };
    hijo.stdout.on('data', juntar);
    hijo.stderr.on('data', juntar);
    hijo.on('close', (codigo) => resolver({ codigo, salida }));
  });
}

const resultados = [];
for (const p of PRUEBAS) {
  console.log(`\n================ ${p.nombre} ================`);
  const t0 = Date.now();
  const { codigo, salida } = await correr(p);
  // La batería no sale con error cuando un paso falla (junta los problemas y
  // los imprime): se lee su propio resumen.
  const pasosMal = /--- \w+: (\d+)\/(\d+) pasos/g;
  let bien = codigo === 0;
  for (const m of salida.matchAll(pasosMal)) if (m[1] !== m[2]) bien = false;
  if (/PROBLEMAS:|DISTINTO|REVENTÓ|FALLA/.test(salida)) bien = false;
  resultados.push({ nombre: p.nombre, bien, segundos: Math.round((Date.now() - t0) / 1000) });
}

console.log('\n================ resumen ================');
for (const r of resultados) console.log(`  ${r.bien ? 'ok  ' : 'FALLA'} ${r.nombre} (${r.segundos} s)`);
const mal = resultados.filter((r) => !r.bien).length;
console.log(mal ? `\n${mal} con problemas: mirá arriba y en capturas/bateria/.` : '\nTodo bien contra la base real.');
process.exit(mal ? 1 : 0);
