/**
 * ─────────────────────────────────────────────────────────────────────
 * LO QUE UN MES DE FOTOS PUEDE CONTESTAR (25/9)
 * ─────────────────────────────────────────────────────────────────────
 *
 * *"El Álbum está aburrido y muy simple."* Y lo estaba porque era una grilla:
 * una grilla muestra lo que hay y no dice nada de lo que hay. Las dos cosas que
 * una persona le pregunta de verdad a sus fotos de gimnasio son **cuánto fui**
 * y **cómo cambié**, y las dos estaban ahí adentro sin que nadie las sacara.
 *
 * ACÁ NO SE DIBUJA NADA, como siempre: esto es la cuenta, y por eso se prueba
 * con fechas inventadas y sin abrir una pantalla.
 */

/** Los números del encabezado del mes: cuántas fotos y de cuántos días. */
export function resumenDelMes(fotos: readonly { fecha: string }[]): { fotos: number; dias: number } {
  return { fotos: fotos.length, dias: new Set(fotos.map((f) => f.fecha)).size };
}

/**
 * LA PRIMERA Y LA ÚLTIMA DEL MES, para la comparación.
 *
 * `null` con menos de dos, y ahí está la mitad de la decisión: comparar una
 * foto con sí misma no es una comparación, es la misma foto dos veces. Y con
 * dos del MISMO DÍA tampoco —no pasó nada entre una y otra— así que se pide
 * además que las fechas sean distintas.
 *
 * El orden de entrada es el del álbum, de la más nueva a la más vieja, así que
 * la primera del mes es la última de la lista.
 */
export function primeraYUltima<T extends { fecha: string }>(fotos: readonly T[]): { primera: T; ultima: T } | null {
  if (fotos.length < 2) return null;
  const primera = fotos[fotos.length - 1];
  const ultima = fotos[0];
  return primera.fecha === ultima.fecha ? null : { primera, ultima };
}
