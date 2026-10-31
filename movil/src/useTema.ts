import { useSyncExternalStore } from 'react';
import { suscribirPaleta, versionDePaleta } from './colores';

/** Redibuja este componente cuando cambia la paleta. Ver `colores.ts`. */
export function useTema() {
  useSyncExternalStore(suscribirPaleta, versionDePaleta, versionDePaleta);
}
