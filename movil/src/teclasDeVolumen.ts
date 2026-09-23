import { useEffect, useRef } from 'react';
import { plataforma } from '@plataforma';

/**
 * LAS TECLAS DE VOLUMEN SUMAN UNA SERIE, mientras dure la sesión (§13f).
 *
 * El porqué y las trampas están en `plataforma/volumen.ts`. Acá está lo único
 * que decide esta capa: **CUÁNDO SE ESCUCHA**.
 *
 * SOLO CON LA SESIÓN CORRIENDO, y no mientras la app está abierta. Fuera de
 * la sesión no hay ninguna serie que sumar, y quedarse con las teclas tomadas
 * —devolviéndole el volumen a su lugar cada vez que alguien lo mueve— sería
 * romper el teléfono de la persona para nada.
 *
 * LA ACCIÓN VIAJA EN UNA REF a propósito. `serieHecha` es una función nueva en
 * cada dibujo de Inicio, y si fuera dependencia del efecto, cada serie sumada
 * desarmaría y volvería a armar la escucha: el volumen iría a su valor
 * original y de vuelta al parado en medio de la sesión, con el cartelito del
 * sistema prendiéndose y apagándose. Se arma una vez al empezar y se desarma
 * al terminar.
 */
export function useTeclasDeVolumen(corriendo: boolean, sumarSerie: () => void) {
  const sumar = useRef(sumarSerie);
  sumar.current = sumarSerie;

  useEffect(() => {
    if (!corriendo || !plataforma.volumen.disponible()) return;
    return plataforma.volumen.escucharTeclas(() => sumar.current());
  }, [corriendo]);
}
