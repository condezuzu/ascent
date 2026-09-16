/**
 * EL CAMPO DE ESTRELLAS DE LA ENTRADA, sin GPU.
 *
 * POR QUÉ NO SE USA EL MOTOR. Las tres primeras pantallas corren MIENTRAS
 * three.js se descarga (son ~3 s de arranque, ver `lib/fondo.ts`): si el fondo
 * de la primera pantalla necesitara el motor, la primera imagen de la app
 * sería negro pelado durante tres segundos, que es justo lo que se quiere
 * evitar. Esto son doscientos puntos en un canvas 2D: aparece en el primer
 * cuadro y no compite con la descarga.
 *
 * ES OTRA COSA QUE EL CAMPO DEL FONDO (`motor/escena.ts`): aquel vive detrás
 * de la app entera y se tiñe con el rango. Este existe solo en la entrada, no
 * sabe de rangos y se va cuando la cuarta pantalla toma la pantalla.
 *
 * NO IMPORTA NADA: se prueba con node pelado.
 */

export type Estrella = {
  /** En 0..1 sobre el ancho y el alto: la pantalla la escala. */
  x: number;
  y: number;
  /** Radio en píxeles, antes de la densidad de la pantalla. */
  r: number;
  /** De 0 a 1. Las lejanas son más tenues y más chicas. */
  brillo: number;
  /** Para que no titilen todas juntas. */
  fase: number;
  /** Cuánto se mueve con el paralaje: las cercanas, más. */
  capa: number;
};

/** Un azar con semilla: el mismo cielo en cada corrida y en cada captura. */
export function azarConSemilla(semilla: number): () => number {
  let s = Math.max(1, Math.floor(semilla)) % 2147483647;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

/**
 * El cielo. Tres capas: el paralaje es lo que da profundidad cuando el texto
 * se mueve, y sin él un campo de puntos se ve como una textura pegada.
 */
export function cielo(cuantas: number, semilla = 11): Estrella[] {
  const azar = azarConSemilla(semilla);
  const n = Math.max(0, Math.floor(Number.isFinite(cuantas) ? cuantas : 0));
  const e: Estrella[] = [];
  for (let i = 0; i < n; i++) {
    const capa = i % 3;
    e.push({
      x: azar(),
      y: azar(),
      // Las de la capa de adelante son más grandes y más brillantes.
      r: 0.5 + capa * 0.45 + azar() * 0.5,
      brillo: 0.18 + capa * 0.2 + azar() * 0.25,
      fase: azar() * Math.PI * 2,
      capa: (capa + 1) / 3,
    });
  }
  return e;
}

/**
 * El titileo. Suave y CHICO: un cielo que parpadea fuerte se lee como un error
 * de dibujo. Nunca apaga una estrella del todo.
 */
export function brilloEn(e: Estrella, segundos: number): number {
  const t = Number.isFinite(segundos) ? segundos : 0;
  const pulso = 0.82 + 0.18 * Math.sin(t * 0.9 + e.fase);
  return Math.min(1, Math.max(0, e.brillo * pulso));
}

/**
 * CUÁNTAS ESTRELLAS PARA ESTA PANTALLA. Por área y con tope: en una pantalla
 * grande un número fijo se ve vacío, y en un teléfono flojo mil puntos cuestan
 * más que todo lo demás junto.
 */
export function cuantasPara(ancho: number, alto: number): number {
  const area = (Number.isFinite(ancho) ? ancho : 0) * (Number.isFinite(alto) ? alto : 0);
  if (area <= 0) return 0;
  return Math.round(Math.min(260, Math.max(70, area / 3200)));
}
