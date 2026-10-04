// LOS ALIAS, PARA LAS PRUEBAS. `test:db` corre con node pelado, que no sabe qué
// es `@nucleo/...` ni `@plataforma`. Sin esto solo se podían cargar los
// archivos que no importan nada por alias —la cuenta pura—, y lo que los usa
// quedaba afuera: así pasó que el peso por modo tenía la cuenta probada y en el
// teléfono no proponía nada (ver spec/trampas.md, "La cuenta probada no es la
// función probada").
//
// `@nucleo` y `@compartido` van a los archivos de verdad. `@plataforma` va a un
// doble: lo único que cambia entre la web, el teléfono y la prueba es dónde se
// guarda.
const RAIZ = new URL('../../', import.meta.url);
const DOBLES = {
  '@plataforma': new URL('./plataforma.mjs', import.meta.url).href,
  '@cliente': new URL('./cliente.mjs', import.meta.url).href,
};

export async function resolve(especificador, contexto, siguiente) {
  if (DOBLES[especificador]) return { url: DOBLES[especificador], shortCircuit: true };
  const m = especificador.match(/^@(nucleo|compartido)\/(.+)$/);
  if (m) return { url: new URL(`${m[1]}/${m[2]}.ts`, RAIZ).href, shortCircuit: true };
  return siguiente(especificador, contexto);
}
