// ¿ESTÁN LOS DEV SERVERS PRENDIDOS O APAGADOS? — el guardián de puertos.
//
// POR QUÉ EXISTE. Dos rituales tienen requisitos OPUESTOS sobre los dev
// servers, y hasta ahora dependían de que un humano se acordara de cuál:
//
//   - EL CIERRE los necesita PRENDIDOS: `test:real` corre la batería web+nativa
//     contra :3020 y :8090. Sin ellos no prueba nada.
//   - LA HUELLA (el paso previo a buildear) conviene con todo APAGADO: es un
//     retrato del proyecto quieto, y un Metro reconstruyendo al lado es ruido.
//
// Acordarse "no es un sistema" (dixit el humano, 26/9). Esto lo hace
// determinista: cada ritual dice en su primera línea qué esperaba y aborta con
// un mensaje claro si no se cumple, en vez de correr igual y dar un resultado
// que no vale.
//
// SIN DEPENDENCIAS: un intento de conexión TCP crudo. Prendido = algo acepta la
// conexión; apagado = la rechaza. No pega a ninguna ruta ni interpreta HTTP.
import { createConnection } from 'node:net';

/** ¿Hay algo escuchando en ese puerto de localhost? Resuelve true/false, nunca tira. */
export function estaPrendido(puerto, ms = 1500) {
  return new Promise((listo) => {
    const sock = createConnection({ host: '127.0.0.1', port: puerto });
    let resuelto = false;
    const fin = (v) => {
      if (resuelto) return;
      resuelto = true;
      sock.destroy();
      listo(v);
    };
    sock.once('connect', () => fin(true));
    sock.once('error', () => fin(false));
    sock.setTimeout(ms, () => fin(false));
  });
}

const NOMBRE = { 3020: 'la web (npm run dev)', 8090: 'la nativa (movil/dev-web.cmd)' };

/**
 * Para el CIERRE: exige que los puertos estén PRENDIDOS. Aborta temprano y
 * claro si falta alguno, en vez de dejar que `test:real` lo descubra a la
 * mitad.
 */
export async function exigirPrendidos(puertos) {
  const caidos = [];
  for (const p of puertos) if (!(await estaPrendido(p))) caidos.push(p);
  if (caidos.length) {
    console.error(
      `\n  ✗ El cierre necesita los dev servers PRENDIDOS y falta:\n` +
        caidos.map((p) => `      :${p} — ${NOMBRE[p] ?? 'servidor'}`).join('\n') +
        `\n\n    Prendé los dos y volvé a correr el cierre.\n`
    );
    process.exit(1);
  }
  console.log(`  ✓ dev servers prendidos (${puertos.map((p) => ':' + p).join(', ')})`);
}

/**
 * Para la HUELLA / lo previo a buildear: exige que los puertos estén APAGADOS.
 * Escape: `FORZAR=1` lo saltea, para el caso raro en que se sepa lo que se hace.
 */
export async function exigirApagados(puertos) {
  if (process.env.FORZAR === '1') return;
  const vivos = [];
  for (const p of puertos) if (await estaPrendido(p)) vivos.push(p);
  if (vivos.length) {
    console.error(
      `\n  ✗ Hay dev servers PRENDIDOS y esto se corre con todo apagado:\n` +
        vivos.map((p) => `      :${p} — ${NOMBRE[p] ?? 'servidor'}`).join('\n') +
        `\n\n    Apagalos antes de buildear (o FORZAR=1 si sabés lo que hacés).\n`
    );
    process.exit(1);
  }
}
