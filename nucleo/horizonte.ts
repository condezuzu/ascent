/**
 * EL PLANETA COMO HORIZONTE (2/11, la propuesta de la sección 14 de la galería). El cuerpo deja de ser
 * un objeto en una esquina: crece hasta ser el horizonte, y su lado de noche hace de velo. Lo que tiene
 * superficie (rangos 2 a 4) da un borde que cruza la pantalla; el polvo, el Sol, la galaxia y el agujero
 * negro no tienen borde que seguir o se ven flojos tan grandes, y quedan en su esquina.
 *
 * Los números son los de la maqueta, en el teléfono de 390×844 donde se midió el piso de 4,5:1. Se pasan
 * al mundo del motor, donde el alto de la pantalla va de -1 a 1 y el ancho se cuenta en fracciones: así
 * un teléfono de otra medida mantiene la composición.
 */
const ANCHO = 390;
const ALTO = 844;

/** Cuánto asoma el cuerpo: entero en Inicio, menos entrenando, y apenas en el resto. */
export type Altura = 'alta' | 'media' | 'baja';

const CIMA: Record<Altura, number> = { alta: 505, media: 640, baja: 768 };
const CAIDA: Record<Altura, number> = { alta: 0, media: 70, baja: 170 };

export const tieneBorde = (rango: number) => rango >= 2 && rango <= 4;

function radioDe(rango: number, planeta: string | null | undefined) {
  // Saturno lleva sus anillos, y con el radio de los demás se salían de la pantalla.
  if (planeta === 'Saturno') return 300;
  return rango === 7 ? 92 : rango === 5 ? 165 : 470;
}

/** Centro y radio del cuerpo, en los puntos de la pantalla de 390×844. */
export function cuerpoEn(rango: number, planeta: string | null | undefined, altura: Altura) {
  const R = radioDe(rango, planeta);
  if (tieneBorde(rango)) return { x: 300, y: CIMA[altura] + R, R };
  const y = rango === 7 ? 716 : rango === 5 ? 744 : 640;
  return { x: rango === 5 || rango === 7 ? 352 : 300, y: y + CAIDA[altura], R };
}

/** La esquina de siempre del motor, usada como nombre de cada altura: `mover` ya sabe viajar entre ellas. */
export const ESQUINA_DE_ALTURA = { alta: 'abajo-derecha', media: 'arriba-derecha', baja: 'centro' } as const;

/** Lo que el motor necesita: el radio y los tres lugares, en su mundo (x como fracción del ancho). */
export function horizonteDe(rango: number, planeta: string | null | undefined) {
  const enMundo = (altura: Altura) => {
    const c = cuerpoEn(rango, planeta, altura);
    return { x: (c.x - ANCHO / 2) / (ANCHO / 2), y: 1 - c.y / (ALTO / 2) };
  };
  return {
    radio: radioDe(rango, planeta) / (ALTO / 2),
    // Las nubes no tienen borde: se agrandan para llenar el lugar del planeta, sin llegar a su escala.
    nube: rango === 1 ? 1.5 : 1.2,
    lugares: {
      [ESQUINA_DE_ALTURA.alta]: enMundo('alta'),
      [ESQUINA_DE_ALTURA.media]: enMundo('media'),
      [ESQUINA_DE_ALTURA.baja]: enMundo('baja'),
    },
  };
}

/** Qué altura le toca a una pantalla: Inicio en reposo, lo que muestra un cuerpo con contenido encima, o el resto. */
export function alturaDe(esquina: string | undefined, enReposo: boolean | undefined): Altura {
  if (esquina !== 'abajo-derecha') return 'baja';
  return enReposo ? 'alta' : 'media';
}

/**
 * LOS VELOS (2/11): se va el parejo, que apagaba todo por igual. Cuando el planeta hace de horizonte,
 * lo oscuro lo pone su noche. El Sol y el agujero negro no tienen noche, y arriba de ellos hay texto.
 *
 * `conTextoAbajo`: lo que se lee sobre el borde encendido del planeta, como el resumen al terminar o el
 * día listo. Medido con `probar-contraste`: sin esto, «minutos» daba 1,21:1. El Sol y la nebulosa son lo
 * más claro que llega a la franja de abajo de las otras pantallas, y por eso llevan más.
 */
export function velosDe(rango: number, altura: Altura, conTextoAbajo = false) {
  if (altura === 'baja') return { velo: 0.4, lectura: rango === 5 ? 0.9 : rango === 1 ? 0.75 : 0.6 };
  return { velo: rango === 5 ? 0.16 : rango === 7 ? 0.2 : 0.1, lectura: conTextoAbajo ? 1 : rango === 5 ? 0.42 : 0 };
}
