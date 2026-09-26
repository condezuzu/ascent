// EL CANDADO DEL DESLIZAMIENTO ENTRE PESTAÑAS.
//
// POR QUÉ. `Pestanas` agarra cualquier arrastre horizontal >14px con un
// `PanResponder` de contenedor y NO lo suelta (`onPanResponderTerminationRequest:
// () => false`). Eso le roba el gesto a los hijos que también quieren horizontal
// —la foto abierta, un carrusel, un campo de texto que uno está deslizando por
// encima—: el dedo empieza sobre la foto y termina en otra pestaña.
//
// Este candado invierte la prioridad cuando hace falta: mientras un hijo dice
// "yo manejo el horizontal", `Pestanas` NO agarra. Es un contador y no un
// booleano porque puede haber dos a la vez (una hoja sobre otra); solo cuando
// el último suelta, las pestañas vuelven a deslizar.
//
// Vive en su propio archivo para que cualquiera lo pueda tomar sin importar
// `Pestanas`, que lo importa a él.

let bloqueos = 0;

/** Un hijo pasa a manejar el horizontal: las pestañas dejan de deslizar. */
export function bloquearDeslizarPestanas(): void {
  bloqueos += 1;
}

/** Ese hijo terminó. Cuando el contador vuelve a cero, las pestañas deslizan. */
export function desbloquearDeslizarPestanas(): void {
  bloqueos = Math.max(0, bloqueos - 1);
}

/** ¿Hay alguien manejando el horizontal ahora? Lo consulta `Pestanas`. */
export function deslizarPestanasBloqueado(): boolean {
  return bloqueos > 0;
}
