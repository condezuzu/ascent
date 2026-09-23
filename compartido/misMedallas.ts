import { useEffect, useState } from 'react';
import type { Cliente } from '@cliente';
import { cargarMisMedallas } from '@compartido/perfil';
import type { Medalla } from '@nucleo/medallas';

/**
 * TUS MEDALLAS, PARA UNA PANTALLA QUE NO ES EL PERFIL.
 *
 * El perfil las trae con todo lo demás en su segunda tanda de consultas; esto
 * es para Inicio, que no carga nada de fuerza y necesita las mismas. La regla
 * de qué se gana sigue siendo una sola (`cargarMisMedallas`).
 *
 * EMPIEZA VACÍO Y NO EN "CARGANDO", a propósito. Inicio es la pantalla que
 * tiene que aparecer rápido: las medallas son un adorno al lado del nombre y
 * entran cuando llegan. Un espacio reservado o un esqueleto gris moverían el
 * nombre de lugar medio segundo después, que es peor que aparecer.
 *
 * SIN `uid` NO PREGUNTA NADA: mientras el perfil carga, la fila queda vacía.
 */
export function useMisMedallas(
  supabase: Cliente,
  uid: string | null | undefined,
  sexo: string | null | undefined,
  /**
   * Cambiarlo las hace pedir de nuevo. Existe porque una medalla se gana
   * cargando una marca en OTRA pantalla: sin esto, la que acabás de ganar no
   * aparece al lado de tu nombre hasta reiniciar la app.
   */
  refrescar = 0
): Medalla[] {
  const [medallas, setMedallas] = useState<Medalla[]>([]);

  useEffect(() => {
    if (!uid) return;
    let vivo = true;
    cargarMisMedallas(supabase, uid, sexo ?? null)
      .then((m) => {
        if (vivo) setMedallas(m);
      })
      .catch(() => {
        // Sin medallas la pantalla se dibuja igual: es un adorno, no un dato
        // sin el cual Inicio no se entiende.
      });
    return () => {
      vivo = false;
    };
    // `supabase` es el mismo cliente siempre; meterlo acá no cambia nada y
    // obliga a memorizarlo en cada pantalla.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, sexo, refrescar]);

  return medallas;
}
