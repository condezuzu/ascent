// Marcas de rendimiento. performance.mark cuesta microsegundos, así que
// quedan siempre puestas: permiten volver a medir cuando haga falta sin
// tener que instrumentar de nuevo.
//
// Para leerlas desde la consola del navegador: window.__ascentPerf()

export function marca(nombre: string) {
  if (typeof performance !== 'undefined') performance.mark(nombre);
}

export function medir(nombre: string, desde: string, hasta: string) {
  if (typeof performance === 'undefined') return;
  try {
    performance.measure(nombre, desde, hasta);
  } catch {
    // si falta alguna marca, no vale la pena romper nada por una métrica
  }
}

export function instalarLector() {
  if (typeof window === 'undefined') return;
  (window as unknown as { __ascentPerf?: () => unknown }).__ascentPerf = () => {
    const pintado = performance.getEntriesByType('paint').map((e) => ({
      nombre: e.name,
      ms: Math.round(e.startTime),
    }));
    const medidas = performance
      .getEntriesByType('measure')
      .filter((e) => e.name.startsWith('ascent:'))
      .map((e) => ({ nombre: e.name, ms: Math.round(e.duration * 10) / 10 }));
    const marcas = performance
      .getEntriesByType('mark')
      .filter((e) => e.name.startsWith('ascent:'))
      .map((e) => ({ nombre: e.name, ms: Math.round(e.startTime) }));
    return { pintado, medidas, marcas };
  };
}
