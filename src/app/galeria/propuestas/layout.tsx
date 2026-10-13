import type { Metadata } from 'next';
import type { ReactNode } from 'react';

// LAS PROPUESTAS DE DISEÑO ESTÁN EN LA WEB DESPLEGADA (12/10/2026), para
// abrirlas desde el teléfono a tamaño real: un PNG en el monitor engaña con los
// tamaños. NO SON PÚBLICAS: las ve solo quien entra con una cuenta de la lista
// (`puedeVerPropuestas`, en `nucleo/veredicto.ts`; lo decide el middleware).
// Y que ningún buscador las liste, por si un día la regla se afloja sin querer.
export const metadata: Metadata = { title: 'Propuestas · Ascent', robots: { index: false, follow: false } };

export default function Propuestas({ children }: { children: ReactNode }) {
  return children;
}
