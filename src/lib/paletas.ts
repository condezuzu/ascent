// La paleta aplicada a la WEB: las variables CSS.
//
// Las tablas y `paletaDe` viven en `nucleo/paletas.ts` desde el 18/9, porque
// el motor las necesita y el motor se comparte con la app nativa. Esto es lo
// único que tocaba el DOM y por eso se quedó acá. Se reexporta el resto para
// que los que importan `@/lib/paletas` no tengan que enterarse de la mudanza.
import { paletaDe, FONDO_BASE, FONDO_RANGO_8 } from '@nucleo/paletas';

export * from '@nucleo/paletas';

// Aplica la paleta a toda la app reasignando el único set de variables CSS
// (--pal-apagado, --pal-principal, --pal-claro).
export function aplicarTema(rango: number, planeta?: string | null) {
  const p = paletaDe(rango, planeta);
  const raiz = document.documentElement.style;
  raiz.setProperty('--pal-apagado', p.apagado);
  raiz.setProperty('--pal-principal', p.principal);
  raiz.setProperty('--pal-claro', p.claro);
  raiz.setProperty('--fondo', rango === 8 ? FONDO_RANGO_8 : FONDO_BASE);
}
