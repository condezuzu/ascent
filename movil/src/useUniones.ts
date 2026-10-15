import { useCallback, useEffect, useState } from 'react';
import { plataforma } from '@plataforma';
import { escucharGrupo, traerUniones, type Uniones } from '@compartido/enVivo';
import { CADA_CUANTO_MS } from '@nucleo/enVivo';
import { supabase } from './supabase';

/**
 * MIS VÍNCULOS DE "ENTRENAR CON OTRO" mientras `activo`. Con grupo (migración 88)
 * llegan en tiempo real: cualquier cambio del grupo hace volver a pedir la lista.
 * La pregunta cada diez segundos queda de respaldo, por si el canal se cae. Si una
 * no contesta, queda lo que había.
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

  // EL TIEMPO REAL: se escucha el grupo y a los que están adentro; se vuelve a
  // escuchar si cambia quién está. Los avisos que llegan juntos se juntan en uno.
  const grupo = datos.uniones.find((u) => u.grupo)?.grupo ?? null;
  const companeros = datos.uniones.filter((u) => u.estado === 'aceptada').map((u) => u.otro.id).sort().join(',');
  useEffect(() => {
    if (!activo || !grupo) return;
    let espera: ReturnType<typeof setTimeout> | null = null;
    const dejar = escucharGrupo(supabase, grupo, companeros ? companeros.split(',') : [], () => {
      if (espera) clearTimeout(espera);
      espera = setTimeout(() => void recargar(), 250);
    });
    return () => {
      if (espera) clearTimeout(espera);
      dejar();
    };
  }, [activo, grupo, companeros, recargar]);

  return { ...datos, recargar };
}
