/**
 * AVISA CUANDO UN ELEMENTO CAMBIA DE TAMAÑO, por la razón que sea.
 *
 * EL BUG: "al iniciar el entrenamiento la imagen de atrás queda más flaca". Los
 * tres lienzos del motor —el fondo, la subida y el gesto del impulso— se
 * volvían a medir solo con el `resize` de la VENTANA. Pero el tamaño del
 * contenedor puede cambiar sin que la ventana cambie: en el teléfono, cuando la
 * página pasa a ser desplazable (al empezar la sesión aparece el bloque y el
 * contenido ya no entra) el navegador esconde su barra y la zona fija crece.
 * El lienzo, que se estira al 100% por CSS, se agrandaba; el buffer y la
 * cámara quedaban con la proporción vieja, y todo se dibujaba estirado a lo alto.
 *
 * Reproducido sin teléfono estirando el contenedor por CSS: 390×964 de caja con
 * un buffer de 780×1688, o sea 0,876 de la proporción que corresponde.
 *
 * `ResizeObserver` mira la CAJA del elemento, así que se entera de cualquier
 * causa. Se deja además el `resize` de la ventana para los navegadores viejos
 * que no lo tienen: ahí es lo que había y no se pierde nada.
 */
export function alCambiarDeTamano(elemento: Element, fn: () => void): () => void {
  window.addEventListener('resize', fn);
  let observador: ResizeObserver | null = null;
  if (typeof ResizeObserver !== 'undefined') {
    // El primer aviso llega apenas se observa; es inofensivo —medir dos veces
    // la misma caja deja todo igual— y así no hay que acordarse de medir antes.
    observador = new ResizeObserver(() => fn());
    observador.observe(elemento);
  }
  return () => {
    window.removeEventListener('resize', fn);
    observador?.disconnect();
  };
}
