import { useEffect, useState } from 'react';
import { supabase } from './supabase';

// Los nombres no cambian mientras la app está abierta: se piden una vez y los
// comparten Ranking y la pantalla del descanso, que antes los pedía cada una y
// de nuevo en cada apertura.
let sabidos: Record<string, string> | null = null;
let enVuelo: Promise<Record<string, string> | null> | null = null;

/** `null` si no se pudo: el que llama vuelve a intentar. */
export function traerNombresDeEjercicios(): Promise<Record<string, string> | null> {
  if (sabidos) return Promise.resolve(sabidos);
  if (!enVuelo) {
    enVuelo = Promise.resolve(supabase.from('ejercicios').select('id, nombre'))
      .then(({ data, error }) => {
        if (error || !data) return null;
        sabidos = Object.fromEntries((data as { id: string; nombre: string }[]).map((e) => [e.id, e.nombre]));
        return sabidos;
      })
      .catch(() => null)
      .finally(() => {
        enVuelo = null;
      });
  }
  return enVuelo;
}

/**
 * LOS NOMBRES DE LOS EJERCICIOS, PARA EL RENGLÓN DEL COMPAÑERO: lo que se
 * publica es el id.
 *
 * SE REINTENTA (13/10). Se pedían una sola vez y sin mirar el error: con la
 * señal del gimnasio, si ese pedido fallaba el renglón decía "… · serie 2 de 4"
 * todo el entrenamiento. `latido` cambia cada vez que llega la lista de
 * vínculos (cada diez segundos): mientras falten los nombres, se vuelve a pedir.
 */
export function useNombresDeEjercicios(hacenFalta: boolean, latido: number): Record<string, string> {
  const [nombres, setNombres] = useState<Record<string, string>>(sabidos ?? {});
  const tengo = Object.keys(nombres).length > 0;
  useEffect(() => {
    if (!hacenFalta || tengo) return;
    let vivo = true;
    void traerNombresDeEjercicios().then((n) => {
      if (vivo && n) setNombres(n);
    });
    return () => {
      vivo = false;
    };
  }, [hacenFalta, tengo, latido]);
  return nombres;
}
