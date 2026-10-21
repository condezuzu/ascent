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
//   4. probar-salto-marca — «La próxima, más» no se mueve cuando se va solo el
//      cuadro de «¿La guardo como marca?» (18/10), en la nativa.
//   5. probar-doble-toque — dos toques seguidos en el «+» o en «Terminar serie» no
//      suman una serie de más (19/10), en la nativa.
//   6. probar-rutina-en-perfil — tu perfil y Stats → Entrenamiento muestran los ejercicios de tu rutina al
//      abrir, sin tocar ningún día (20/10), en la nativa.
//   7. probar-entrada-logo — el aro del logo se dibuja y la app se monta recién con
//      el zoom (20/10), en la nativa y sin cuenta.
//   8. probar-peso-y-fotos — anotar el peso con el número grande, − y + y la regla
//      guarda lo que dice el número, y la hoja nueva de la foto registra el día con
//      la foto colgada (20/10), en la nativa.
//   9. probar-lista-de-amigos — la lista de amigos muestra cinco y la flechita la
//      abre y la cierra (20/10), en la nativa, con seis cuentas.
//  10. probar-olvidar-dia — «Olvidar este día» en la ventana de reemplazo no toca la
//      rutina y ese día no vuelve a preguntar (20/10), en la nativa.
//  11. probar-ultima-vez — con «Mostrar la última vez» prendido (viene apagado), al entrar o al elegir
//      a entrenar sale debajo del ejercicio lo de la última sesión que lo tuvo (20/10).
//  12. probar-timbre-descanso — la píldora del descanso se sacude como un despertador
//      al llegar a 0:00 y después dice cuánto se pasó (20/10), en la nativa, con el reloj de Playwright.
//  13. probar-sesion-siguiente — rutina A, B y C; una sesión cambiando A por X; la
//      siguiente del mismo día propone B (20/10), en la nativa.
//  14. probar-arranque — al abrir con sesión, Inicio se monta recién al terminar la entrada,
//      con sus datos pedidos una sola vez mientras corría (21/10), en la nativa.
//  15. probar-reps — con «Registrar repeticiones» (viene apagado) hay un cuadradito al lado del
//      peso, con la pista de la última sesión, que se vacía con el + (21/10), en la nativa.
//  16. probar-estrellas — las vidas son estrellas: en Inicio, arriba de los días; en el aviso,
//      arriba, en el cuadro y dentro de «Usar vida» (21/10), en la nativa.
//  17. probar-cardio — el cardio es un cronómetro (0:00 quieto, cuenta para arriba) y anota la
//      distancia de la vuelta (21/10), en la nativa.
//  18. probar-octogonos — los botones de Inicio y del bloque tienen las esquinas cortadas en
//      diagonal (21/10), en la nativa.
//  19. probar-dos-por-dos — el aviso de subir el peso con la regla 2 por 2: avisa con el rango,
//      y no avisa si la última serie no llegó al objetivo + 2 (21/10), en la nativa.
//
// NECESITA LOS DOS DEV SERVERS PRENDIDOS: la web en :3020 y la nativa en
// :8090. No los levanta: compilar mientras otro dev server corre es justo lo
// que no se hace en este repo.
//
// Borra lo que crea. Si una prueba revienta a la mitad, igual intenta borrar
// su cuenta; lo que no pueda, lo dice.
//
//   npm run test:real            (todas)
//   npm run test:real -- api     (sin navegador: 1 y 2)
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const DIR = dirname(fileURLToPath(import.meta.url));
const soloApi = process.argv.includes('api');

const PRUEBAS = [
  { nombre: 'cuatro semanas', archivo: 'simular-cuatro-semanas.mjs', args: [] },
  { nombre: 'privacidad', archivo: 'probar-privacidad.mjs', args: [] },
  // Dos cuentas, y con navegador dos pantallas a la vez: lo más parecido a dos
  // teléfonos que hay acá. Con `api` corre solo la parte de la base.
  { nombre: 'entrenar con otro', archivo: 'probar-juntos.mjs', args: soloApi ? ['api'] : [] },
  ...(soloApi ? [] : [{ nombre: 'web y nativa', archivo: 'bateria-dos-apps.mjs', args: ['ambas'], navegador: true }]),
  ...(soloApi ? [] : [{ nombre: 'sin salto al irse la marca', archivo: 'probar-salto-marca.mjs', args: [], navegador: true }]),
  ...(soloApi ? [] : [{ nombre: 'doble toque en el +', archivo: 'probar-doble-toque.mjs', args: [], navegador: true }]),
  ...(soloApi ? [] : [{ nombre: 'la rutina en tu perfil', archivo: 'probar-rutina-en-perfil.mjs', args: [], navegador: true }]),
  ...(soloApi ? [] : [{ nombre: 'la entrada del logo', archivo: 'probar-entrada-logo.mjs', args: [], navegador: true }]),
  ...(soloApi ? [] : [{ nombre: 'peso y fotos', archivo: 'probar-peso-y-fotos.mjs', args: [], navegador: true }]),
  ...(soloApi ? [] : [{ nombre: 'la lista de amigos', archivo: 'probar-lista-de-amigos.mjs', args: [], navegador: true }]),
  ...(soloApi ? [] : [{ nombre: 'olvidar este día', archivo: 'probar-olvidar-dia.mjs', args: [], navegador: true }]),
  ...(soloApi ? [] : [{ nombre: 'mostrar la última vez', archivo: 'probar-ultima-vez.mjs', args: [], navegador: true }]),
  ...(soloApi ? [] : [{ nombre: 'el timbre del descanso', archivo: 'probar-timbre-descanso.mjs', args: [], navegador: true }]),
  ...(soloApi ? [] : [{ nombre: 'la sesión siguiente del día', archivo: 'probar-sesion-siguiente.mjs', args: [], navegador: true }]),
  ...(soloApi ? [] : [{ nombre: 'el arranque', archivo: 'probar-arranque.mjs', args: [], navegador: true }]),
  ...(soloApi ? [] : [{ nombre: 'registrar repeticiones', archivo: 'probar-reps.mjs', args: [], navegador: true }]),
  ...(soloApi ? [] : [{ nombre: 'las vidas son estrellas', archivo: 'probar-estrellas.mjs', args: [], navegador: true }]),
  ...(soloApi ? [] : [{ nombre: 'el cardio', archivo: 'probar-cardio.mjs', args: [], navegador: true }]),
  ...(soloApi ? [] : [{ nombre: 'los botones en octágono', archivo: 'probar-octogonos.mjs', args: [], navegador: true }]),
  ...(soloApi ? [] : [{ nombre: 'subir el peso, 2 por 2', archivo: 'probar-dos-por-dos.mjs', args: [], navegador: true }]),
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
