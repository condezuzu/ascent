import { useCallback, useEffect, useState } from 'react';
import { plataforma } from '@plataforma';
import { traerUniones, type Uniones } from '@compartido/enVivo';
import { CADA_CUANTO_MS } from '@nucleo/enVivo';
import { supabase } from './supabase';

/**
 * MIS VÍNCULOS DE "ENTRENAR CON OTRO", preguntados cada diez segundos mientras
 * `activo`. No es tiempo real: es una pregunta repetida, y solo con la app
 * adelante. Si una no contesta, queda lo que había.
 */
export function useUniones(activo: boolean, olvidarAlApagar = false): Uniones & { recargar: () => Promise<void> } {
  const [datos, setDatos] = useState<Uniones>({ uniones: [], recibidoEn: Date.now() });

  const recargar = useCallback(async () => {
    const r = await traerUniones(supabase).catch(() => null);
    if (r) setDatos(r);
  }, []);

  useEffect(() => {
    if (!activo) return;
    void recargar();
    const t = setInterval(() => {
      if (plataforma.ciclo.visible()) void recargar();
    }, CADA_CUANTO_MS);
    return () => {
      clearInterval(t);
      // Quien deja de preguntar no se queda con la última lista: en Inicio,
      // el pedido de alguien quedaba pegado en pantalla después de terminar.
      if (olvidarAlApagar) setDatos({ uniones: [], recibidoEn: Date.now() });
    };
  }, [activo, recargar, olvidarAlApagar]);

  return { ...datos, recargar };
}
