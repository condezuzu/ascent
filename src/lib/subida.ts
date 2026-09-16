/**
 * LA SUBIDA DE RANGO, sin GPU: las formas, las fases y dónde está cada
 * partícula en cada instante.
 *
 * POR QUÉ EXISTE ESTE ARCHIVO. La subida es la animación que paga los ochenta
 * días de racha y hasta acá no tenía un solo test: toda la aritmética vivía
 * adentro del bucle de `motor/subida.ts`, donde no se puede probar sin un
 * navegador. Y el navegador sin cabeza corre `requestAnimationFrame` a un
 * cuadro por segundo, así que tampoco se podía mirar (ver `spec/trampas.md`).
 *
 * LO QUE ENCONTRÓ SACARLA. Medido contra la cámara de un teléfono vertical
 * (390×844: la cámara muestra x entre ±0,46), las formas de destino se salían
 * de la pantalla: el sol dejaba afuera el 24% de sus partículas, el sistema el
 * 26%, la galaxia el 19% y el agujero negro el 10%. O sea que las subidas más
 * raras —las que llegan después de cuarenta, cincuenta, sesenta días— eran
 * justamente las que se veían cortadas por los costados. Se diseñaron en una
 * pantalla horizontal, donde entraban. Ver `escalaParaEntrar`.
 *
 * NO IMPORTA three.js. Las formas son `Float32Array` y los colores quedan en
 * el motor, que es lo único que necesita la biblioteca.
 */

/** Partículas por forma. Son LAS MISMAS en el objeto viejo y en el nuevo. */
export const N = 900;

/** Lo que dura una subida común, y la ignición 4→5, que es la más larga. */
export const DURACION_S = 4.0;
export const DURACION_IGNICION_S = 5.2;

/** Hasta dónde llega la dispersión, en proporción al total. */
export const FIN_DISPERSION = 0.4;
/** Cuándo se calma el remolino. Después de esto la forma solo se asienta. */
export const FIN_CAOS = 0.75;
/** Dónde pega el flash de la ignición. */
export const PICO_FLASH = 0.92;

/** Margen contra el borde: la forma no puede tocar el costado de la pantalla. */
export const MARGEN = 0.86;

/**
 * El Sol se enciende. De las siete subidas es la única con flash: si todas lo
 * tuvieran, la ignición dejaría de ser la ignición.
 */
export function esIgnicion(antes: number, despues: number): boolean {
  return antes === 4 && despues === 5;
}

export function duracionDeSubida(antes: number, despues: number): number {
  return esIgnicion(antes, despues) ? DURACION_IGNICION_S : DURACION_S;
}

/**
 * La forma de cada rango, como nube de puntos.
 *
 * `azar` se inyecta para poder probarla con una semilla fija; en la app es
 * `Math.random`.
 */
export function formaDeRango(rango: number, azar: () => number = Math.random): Float32Array {
  const pos = new Float32Array(N * 3);
  const poner = (i: number, x: number, y: number, z: number) => {
    pos[i * 3] = x;
    pos[i * 3 + 1] = y;
    pos[i * 3 + 2] = z;
  };
  // Un punto cualquiera de la superficie de una esfera, repartido parejo.
  const enLaEsfera = () => {
    const u = azar() * 2 - 1;
    const th = azar() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    return { x: Math.cos(th) * s, y: u, z: Math.sin(th) * s };
  };

  if (rango <= 1) {
    // POLVO: nube suelta, sin centro. Todavía no es nada.
    for (let i = 0; i < N; i++) {
      const r = Math.pow(azar(), 0.5) * 0.8;
      const a = azar() * Math.PI * 2;
      const b = (azar() - 0.5) * Math.PI;
      poner(i, Math.cos(a) * Math.cos(b) * r, Math.sin(b) * r * 0.7, Math.sin(a) * Math.cos(b) * r * 0.3);
    }
  } else if (rango === 2) {
    // ASTEROIDE: una papa, no una pelota. El radio se deforma con tres lóbulos
    // lentos —que es lo que hace la silueta irregular— y encima el grano.
    // Antes era una esfera con ruido fino y se leía como una bola rugosa.
    for (let i = 0; i < N; i++) {
      const e = enLaEsfera();
      const th = Math.atan2(e.z, e.x);
      const lobulos =
        1 + 0.22 * Math.sin(th * 2 + 0.7) + 0.14 * Math.sin(th * 3 - 1.2) + 0.1 * Math.sin(e.y * 5);
      const r = 0.3 * lobulos * (0.92 + azar() * 0.16);
      poner(i, e.x * r * 1.15, e.y * r * 0.8, e.z * r * 0.5);
    }
  } else if (rango === 3) {
    // LUNA: una esfera CON CRÁTERES, que es lo único que la hace una luna y no
    // una bola gris. Cada cráter deja un hueco en la superficie y amontona las
    // partículas en su borde: el ojo lee el anillo, no el agujero.
    const crateres = [
      { x: -0.35, y: 0.3, r: 0.3 },
      { x: 0.32, y: 0.12, r: 0.24 },
      { x: -0.1, y: -0.38, r: 0.2 },
      { x: 0.12, y: 0.45, r: 0.15 },
      { x: 0.45, y: -0.35, r: 0.17 },
    ];
    const R = 0.42;
    for (let i = 0; i < N; i++) {
      let e = enLaEsfera();
      // La cara que se ve es la de adelante: los cráteres se calculan en el
      // plano de la pantalla.
      for (const c of crateres) {
        const d = Math.hypot(e.x - c.x, e.y - c.y);
        if (e.z > -0.2 && d < c.r) {
          // adentro del cráter no hay superficie: la partícula se va al borde
          const a = Math.atan2(e.y - c.y, e.x - c.x);
          const rr = c.r * (0.93 + azar() * 0.12);
          const x = c.x + Math.cos(a) * rr;
          const y = c.y + Math.sin(a) * rr;
          const z = Math.sqrt(Math.max(0.02, 1 - x * x - y * y));
          e = { x, y, z };
          break;
        }
      }
      const rugoso = 0.985 + azar() * 0.03;
      poner(i, e.x * R * rugoso, e.y * R * rugoso, e.z * R * rugoso * 0.5);
    }
  } else if (rango === 4) {
    // SATURNO: la esfera con el ANILLO. Es el objeto más reconocible de todos
    // —se identifica en una silueta de un centímetro— y por eso el rango 4 es
    // este planeta y no uno cualquiera (pedido del 15/9). El anillo va
    // inclinado: de canto sería una raya.
    const R = 0.34;
    const inclina = 0.38; // radianes
    const cos = Math.cos(inclina);
    const sen = Math.sin(inclina);
    const EN_EL_ANILLO = Math.round(N * 0.42);
    for (let i = 0; i < N; i++) {
      if (i < EN_EL_ANILLO) {
        // El anillo tiene un hueco adentro (la división de Cassini) porque un
        // disco lleno se ve como un plato y no como un anillo.
        const t = azar();
        const r = R * (1.55 + t * 0.85) * (t > 0.45 && t < 0.55 ? 1.02 : 1);
        const a = azar() * Math.PI * 2;
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        const grosor = (azar() - 0.5) * 0.02;
        poner(i, x, z * sen + grosor * cos, z * cos * 0.5);
      } else {
        const e = enLaEsfera();
        const rugoso = 0.99 + azar() * 0.02;
        poner(i, e.x * R * rugoso, e.y * R * rugoso, e.z * R * rugoso * 0.5);
      }
    }
  } else if (rango === 5) {
    // SOL: el disco con RAYOS. Sin los rayos es una esfera amarilla, que es
    // exactamente lo que pasaba: el salto del planeta al sol no se notaba.
    const R = 0.42;
    const RAYOS = 12;
    const EN_LOS_RAYOS = Math.round(N * 0.3);
    for (let i = 0; i < N; i++) {
      if (i < EN_LOS_RAYOS) {
        const rayo = i % RAYOS;
        const a = (rayo / RAYOS) * Math.PI * 2 + (azar() - 0.5) * 0.09;
        const t = azar();
        // Se afinan hacia afuera: un rayo de grosor parejo parece un palo.
        const r = R * (1.05 + t * 1.05);
        const ancho = (1 - t) * 0.05;
        poner(i, Math.cos(a) * r + (azar() - 0.5) * ancho, Math.sin(a) * r * 0.9 + (azar() - 0.5) * ancho, 0);
      } else {
        const e = enLaEsfera();
        const r = R * (0.88 + azar() * 0.14);
        poner(i, e.x * r, e.y * r, e.z * r * 0.4);
      }
    }
  } else if (rango === 6) {
    // SISTEMA: un sol chico y TRES planetas en sus órbitas. Antes eran cinco
    // anillos de puntos sueltos y no se veía nada: la órbita vacía no se lee,
    // lo que se lee es el planeta que la recorre.
    const ORBITAS = [0.4, 0.62, 0.84];
    const EN_EL_CENTRO = Math.round(N * 0.3);
    const PLANETA = Math.round(N * 0.09); // partículas por planeta
    for (let i = 0; i < N; i++) {
      if (i < EN_EL_CENTRO) {
        const e = enLaEsfera();
        const r = 0.16 * (0.85 + azar() * 0.2);
        poner(i, e.x * r, e.y * r, e.z * r * 0.4);
        continue;
      }
      const k = (i - EN_EL_CENTRO) % 3;
      const radio = ORBITAS[k];
      const resto = i - EN_EL_CENTRO;
      if (resto < PLANETA * 3) {
        // los planetas: un grumo denso sobre cada órbita
        const anguloPlaneta = [0.6, 2.7, 4.5][k];
        const e = enLaEsfera();
        const rr = (0.07 - k * 0.012) * (0.8 + azar() * 0.4);
        poner(
          i,
          Math.cos(anguloPlaneta) * radio + e.x * rr,
          Math.sin(anguloPlaneta) * radio * 0.42 + e.y * rr,
          e.z * rr
        );
      } else {
        // la órbita: una línea fina de polvo, para que se vea el camino
        const a = azar() * Math.PI * 2;
        const j = (azar() - 0.5) * 0.012;
        poner(i, Math.cos(a) * (radio + j), Math.sin(a) * (radio + j) * 0.42, 0);
      }
    }
  } else if (rango === 7) {
    // GALAXIA: bulbo denso, DOS brazos anchos y un halo. Lo que la hacía sosa
    // no era la espiral sino la falta de contraste: brazos de una partícula de
    // ancho y un centro igual de tenue que el resto. Ahora el bulbo se lleva
    // un tercio de las partículas y los brazos tienen grosor —se abren y se
    // deshilachan— en vez de ser una línea.
    const EN_EL_NUCLEO = Math.round(N * 0.32);
    const EN_EL_HALO = Math.round(N * 0.1);
    for (let i = 0; i < N; i++) {
      if (i < EN_EL_NUCLEO) {
        // Bulbo: muy denso en el centro y cayendo rápido hacia afuera.
        const r = Math.pow(azar(), 2.4) * 0.26;
        const a = azar() * Math.PI * 2;
        poner(i, Math.cos(a) * r, Math.sin(a) * r * 0.72, (azar() - 0.5) * 0.02);
      } else if (i < EN_EL_NUCLEO + EN_EL_HALO) {
        const r = 0.3 + Math.pow(azar(), 0.6) * 0.5;
        const a = azar() * Math.PI * 2;
        poner(i, Math.cos(a) * r, Math.sin(a) * r * 0.48, 0);
      } else {
        const brazo = i % 2;
        const t = Math.pow(azar(), 0.7);
        const r = 0.16 + t * 0.64;
        // El brazo se ensancha con el radio: cerca del centro es una banda
        // fina y en la punta se desarma.
        const ancho = 0.05 + t * 0.16;
        const ang = brazo * Math.PI + t * 2.6 + (azar() - 0.5) * ancho;
        const jx = (azar() - 0.5) * 0.03;
        poner(i, Math.cos(ang) * r + jx, Math.sin(ang) * r * 0.45 + jx * 0.5, (azar() - 0.5) * 0.02);
      }
    }
  } else {
    // AGUJERO NEGRO: el disco de acreción visto casi de canto, con el centro
    // VACÍO y un anillo de luz fino pegado al borde del horizonte. El hueco
    // negro del medio es el objeto: sin él es una dona.
    const EN_EL_ANILLO = Math.round(N * 0.22);
    for (let i = 0; i < N; i++) {
      if (i < EN_EL_ANILLO) {
        // el anillo de fotones: fino, redondo, pegado al horizonte
        const a = azar() * Math.PI * 2;
        const r = 0.3 * (0.99 + azar() * 0.02);
        poner(i, Math.cos(a) * r, Math.sin(a) * r, 0);
      } else {
        // el disco: más ancho que alto, con el brillo hacia adentro
        const t = Math.pow(azar(), 1.6);
        const r = 0.34 + t * 0.42;
        const a = azar() * Math.PI * 2;
        poner(i, Math.cos(a) * r, Math.sin(a) * r * 0.3 + (azar() - 0.5) * 0.01, 0);
      }
    }
  }
  return pos;
}

/** Hasta dónde llega la forma en cada eje, en valor absoluto. */
export function extension(forma: Float32Array): { x: number; y: number } {
  let x = 0;
  let y = 0;
  for (let i = 0; i < forma.length; i += 3) {
    const ax = Math.abs(forma[i]);
    const ay = Math.abs(forma[i + 1]);
    if (ax > x) x = ax;
    if (ay > y) y = ay;
  }
  return { x, y };
}

/**
 * CUÁNTO HAY QUE ACHICAR LA FORMA PARA QUE ENTRE EN ESTA PANTALLA.
 *
 * La cámara es ortográfica y muestra y entre ±1 y x entre ±`aspecto`. En un
 * teléfono vertical el aspecto es 0,46, así que cualquier forma más ancha que
 * eso se sale por los costados — y el sol, el sistema, la galaxia y el
 * agujero negro lo son.
 *
 * NUNCA AGRANDA. En una pantalla ancha la forma queda como fue diseñada: la
 * escala solo existe para que algo que no entra, entre. Agrandar cambiaría el
 * tamaño relativo entre rangos, que es parte de lo que se cuenta (el asteroide
 * es chico a propósito).
 */
export function escalaParaEntrar(
  ext: { x: number; y: number },
  aspecto: number,
  margen: number = MARGEN
): number {
  if (!Number.isFinite(aspecto) || aspecto <= 0) return 1;
  const porX = ext.x > 0 ? (aspecto * margen) / ext.x : Infinity;
  const porY = ext.y > 0 ? margen / ext.y : Infinity;
  return Math.min(1, porX, porY);
}

/** Entrada suave y salida suave, acotada: nunca devuelve algo fuera de [0, 1]. */
export function suave(x: number): number {
  const c = Math.min(1, Math.max(0, Number.isFinite(x) ? x : 0));
  return c * c * (3 - 2 * c);
}

/**
 * Cuánto va de la animación, de 0 a 1.
 *
 * Un tiempo negativo o roto es el principio, y nunca un número fuera de rango:
 * el primer cuadro de `requestAnimationFrame` puede llegar con un tiempo
 * anterior al del arranque, y eso ya rompió el pulso una vez.
 */
export function progresoEn(segundos: number, duracion: number): number {
  if (!Number.isFinite(segundos) || segundos <= 0 || !(duracion > 0)) return 0;
  return Math.min(1, segundos / duracion);
}

/**
 * Las tres fases, a partir del progreso.
 *
 *  - `disp`: cuánto se dispersó el objeto viejo (0..1, llega a 1 en el 40%).
 *  - `junta`: cuánto se armó el nuevo (0 hasta el 40%, 1 al final).
 *  - `caos`: el remolino, que sube y se calma. Vale 0 EXACTO desde el 75%: la
 *    versión anterior usaba `sin(π)` para apagarlo, que da 1,2·10⁻¹⁶ y no
 *    cero, así que la forma nunca terminaba de quedar quieta del todo.
 */
export function fasesEn(p: number): { disp: number; junta: number; caos: number } {
  const q = Math.min(1, Math.max(0, Number.isFinite(p) ? p : 0));
  return {
    disp: suave(q / FIN_DISPERSION),
    junta: q < FIN_DISPERSION ? 0 : suave((q - FIN_DISPERSION) / (1 - FIN_DISPERSION)),
    caos: q <= 0 || q >= FIN_CAOS ? 0 : Math.sin((Math.PI * q) / FIN_CAOS),
  };
}

/**
 * Hacia dónde sale disparada cada partícula al dispersarse. Una vez por
 * subida: las direcciones son fijas, o la nube no se leería como una sola cosa.
 */
export function azarDeDispersion(azar: () => number = Math.random): Float32Array {
  const a = new Float32Array(N * 3);
  for (let i = 0; i < N * 3; i++) a[i] = (azar() - 0.5) * 2.6;
  return a;
}

/**
 * Dónde está cada partícula. Escribe en `destino`: corre sesenta veces por
 * segundo, y reservar memoria en cada cuadro es lo que hace tironear.
 *
 * DOS COSAS QUE LA VERSIÓN ANTERIOR HACÍA MAL, y que se ven recién acá:
 *
 *  - EL REMOLINO LEÍA EL CUADRO ANTERIOR. Desplazaba x según la y de la
 *    partícula, pero el bucle calculaba x antes que y, así que la y que leía
 *    era la del cuadro pasado. Ahora la y se calcula primero.
 *  - EN LOS BORDES NO QUEDABA EXACTO. Al principio tiene que ser la forma
 *    vieja y al final la nueva, sin una sola partícula corrida: el objeto que
 *    queda en pantalla es el mismo que se va a ver todos los días.
 */
export function posicionesSubida(
  desde: Float32Array,
  hasta: Float32Array,
  azar: Float32Array,
  p: number,
  segundos: number,
  ignicion: boolean,
  destino: Float32Array
): void {
  const { disp, junta, caos } = fasesEn(p);
  if (disp === 0 && junta === 0) {
    destino.set(desde);
    return;
  }
  if (junta === 1) {
    destino.set(hasta);
    return;
  }
  const empuje = ignicion ? 1.4 : 1;
  for (let i = 0; i < desde.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      const libre = desde[i + k] + azar[i + k] * disp * empuje;
      destino[i + k] = libre + (hasta[i + k] - libre) * junta;
    }
    if (caos > 0) {
      // la y de ESTE cuadro, que ya está escrita en destino
      destino[i] += Math.sin(destino[i + 1] * 6 + segundos * 3) * 0.05 * caos;
    }
  }
}

/** La luz de las partículas: se apaga un poco al dispersarse y vuelve entera. */
export function opacidadEn(p: number): number {
  const { disp, junta } = fasesEn(p);
  return 0.55 + 0.45 * Math.max(disp, junta);
}

/**
 * El flash de la ignición. Solo en 4→5, pega cuando las partículas terminan de
 * juntarse, y vale 0 en el último cuadro: si no, la subida del Sol terminaría
 * con la pantalla blanca congelada.
 */
export function flashEn(p: number, ignicion: boolean): number {
  if (!ignicion || !Number.isFinite(p)) return 0;
  if (p >= 1) return 0;
  return Math.max(0, 1 - Math.abs(p - PICO_FLASH) * 14) * 0.85;
}

/** El giro. Galaxia y agujero negro giran más: son lo que gira. */
export function rotacionEn(segundos: number, rangoDespues: number): number {
  if (!Number.isFinite(segundos)) return 0;
  return segundos * (rangoDespues >= 7 ? 0.25 : 0.08);
}

/**
 * La escala en este instante: pasa de la que necesita la forma vieja a la que
 * necesita la nueva, al ritmo en que se arma.
 *
 * No una sola para toda la subida: del polvo (ancho) al asteroide (chico), una
 * escala única calculada para el polvo dejaría el asteroide diminuto al final,
 * que es justo el momento que se mira.
 */
export function escalaEn(p: number, escalaDesde: number, escalaHasta: number): number {
  const { junta } = fasesEn(p);
  return escalaDesde + (escalaHasta - escalaDesde) * junta;
}
