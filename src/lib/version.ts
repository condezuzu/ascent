'use client';

import { useVersionDelEsquema } from '@compartido/esquema';
import { useEsperar } from '@/components/PantallaDeslizable';

/**
 * LA VERSIÓN DE LA BASE, EN LA WEB, ESPERADA (19/9).
 *
 * Hasta que la base contesta, `useVersionDelEsquema` devuelve `null`, y todo
 * lo que depende de ella (`disponible(...)`) no se dibuja: el aviso diario,
 * el peso por serie, los umbrales. Aparecía después que el resto y empujaba
 * lo de abajo (Ajustes lo tenía). Con esto la pantalla no se muestra hasta
 * saberla —es una sola consulta por apertura, después queda en memoria—.
 *
 * Todo componente web usa ESTE y no el de `compartido/` directo (lo mira el
 * test). La app nativa usa el de `compartido/`.
 */
export function useVersion(): number | null {
  const version = useVersionDelEsquema();
  useEsperar(version !== null);
  return version;
}
