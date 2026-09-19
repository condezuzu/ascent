// La paleta aplicada a la WEB: las variables CSS.
//
// Las tablas y `paletaDe` viven en `nucleo/paletas.ts` desde el 18/9, porque
// el motor las necesita y el motor se comparte con la app nativa. Esto es lo
// único que tocaba el DOM y por eso se quedó acá. Se reexporta el resto para
// que los que importan `@/lib/paletas` no tengan que enterarse de la mudanza.
import { paletaDe, FONDO_BASE, FONDO_RANGO_8 } from '@nucleo/paletas';
import { guardarTema } from '@/plataforma/web/tema';

export * from '@nucleo/paletas';

// Aplica la paleta a toda la app reasignando el único set de variables CSS
// (--pal-apagado, --pal-principal, --pal-claro).
//
// `propio`: es el rango de quien usa la app, sabido de verdad (no el de otra
// persona, no el de una pantalla de entrada). Ese se recuerda para pintar la
// próxima apertura con su color desde el primer cuadro (ver
// `plataforma/web/tema.ts`).
export function aplicarTema(rango: number, planeta?: string | null, propio = false) {
  const p = paletaDe(rango, planeta);
  const v: Record<string, string> = {
    '--pal-apagado': p.apagado,
    '--pal-principal': p.principal,
    '--pal-claro': p.claro,
    '--fondo': rango === 8 ? FONDO_RANGO_8 : FONDO_BASE,
  };
  const raiz = document.documentElement.style;
  for (const [k, valor] of Object.entries(v)) raiz.setProperty(k, valor);
  if (propio) guardarTema({ rango, planeta: planeta ?? null, v });
}
