// El lector de las marcas de rendimiento, para la consola del navegador:
// window.__ascentPerf()
//
// `marca` y `medir` viven en `compartido/medir.ts` desde el 18/9, porque el motor
// las usa y se comparte con la app nativa. Esto es de la web —toca `window`—
// y se reexporta el resto para que nadie tenga que enterarse de la mudanza.
export { marca, medir } from '@compartido/medir';

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
