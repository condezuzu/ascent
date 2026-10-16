import type { Metadata } from 'next';
import type { ReactNode } from 'react';

// LAS PROPUESTAS DE DISEÑO ESTÁN EN LA WEB DESPLEGADA (12/10/2026) y se abren sin
// sesión, como el resto de la galería (15/10: son maquetas, sin datos de nadie).
// Que ningún buscador las liste: son diseños sin decidir.
export const metadata: Metadata = { title: 'Propuestas · Ascent', robots: { index: false, follow: false } };

export default function Propuestas({ children }: { children: ReactNode }) {
  return children;
}
