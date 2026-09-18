// Marcas de rendimiento. performance.mark cuesta microsegundos, así que
// quedan siempre puestas: permiten volver a medir cuando haga falta sin
// tener que instrumentar de nuevo.
//
// VIVE EN `compartido/` desde el 18/9: el motor las usa y el motor se
// comparte con la app nativa. El lector de consola (`instalarLector`) es de la
// web y quedó en `src/lib/medir.ts`.
//
// EN `compartido/` Y NO EN `nucleo/`, y la diferencia importa. Primero fue a
// `nucleo/` y la sección 51 de `test:db` lo rechazó con razón: `nucleo/` es
// lógica pura, sin ninguna API de plataforma, y esto envuelve una. Que
// `performance` exista en las dos plataformas no la vuelve lógica.
//
// SE PREGUNTA POR `mark` Y `measure`, NO SOLO POR `performance`. En el
// navegador están siempre; en React Native `performance.now` está pero la API
// de marcas depende de la versión y de la arquitectura. Sin esta pregunta, el
// primer `marca()` de `montarEscena` tiraría una excepción en el teléfono y el
// fondo no aparecería nunca — por una métrica, que es lo último que tendría
// que poder romper algo. Por eso además todo va adentro de un `try`.

export function marca(nombre: string) {
  if (typeof performance === 'undefined' || typeof performance.mark !== 'function') return;
  try {
    performance.mark(nombre);
  } catch {
    // una marca que no se pudo poner no vale una pantalla rota
  }
}

export function medir(nombre: string, desde: string, hasta: string) {
  if (typeof performance === 'undefined' || typeof performance.measure !== 'function') return;
  try {
    performance.measure(nombre, desde, hasta);
  } catch {
    // si falta alguna marca, no vale la pena romper nada por una métrica
  }
}
