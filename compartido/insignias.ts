// LAS INSIGNIAS DE RANGO, como datos: las dibujan las dos apps.
//
// Insignia chica de alto contraste para listas (24px por omisión, 38 en el
// ranking). Los rangos 1, 2 y 3 se parecen demasiado en chico: la silueta va
// exagerada más de lo realista, a propósito.
// El color sale de la paleta del rango que representa (no de la del usuario):
// en una lista de amigos, cada insignia lleva el color de SU rango.
//
// VIVEN ACÁ Y NO EN UN COMPONENTE desde el 18/9, cuando la app nativa las
// necesitó. Son ocho dibujos afinados a mano —cada número tiene su porqué,
// abajo— y copiarlos a `react-native-svg` era tenerlos dos veces: el primer
// retoque dejaba a las dos apps distintas. La web los dibuja con `<svg>`
// (`src/components/Insignia.tsx`) y la nativa con `react-native-svg`
// (`movil/src/Insignia.tsx`); ninguna de las dos sabe qué forma tiene cada una.
//
// ─────────────────────────────────────────────────────────────────────
// LA RECETA, que salió de arreglar la luna y después se aplicó a todos.
//
// 1. VOLUMEN CON CAPAS PLANAS, no con degradados. Un `<linearGradient>` pide
//    un `id`, y estos íconos se dibujan diez veces en la misma lista: dos ids
//    iguales en un documento es un error que el navegador resuelve callado y
//    mal. Dos o tres formas planas superpuestas dan la misma sensación de
//    esfera sin ese riesgo.
// 2. UNA CARA OSCURA Y UN LADO ILUMINADO. Es lo que separa un objeto de una
//    figura: un polígono naranja plano es una mancha; el mismo polígono con
//    la cara de arriba clara y la de abajo apagada es una roca.
// 3. SE ELIGE MIRANDO EL TAMAÑO REAL. Todo esto se ve bien a 96 px; la
//    pregunta siempre es qué queda a 16, que es donde vive de verdad.

import { PALETAS_RANGO } from '@nucleo/paletas';

/** Los colores con los que se pinta: de la paleta del rango, o fijos. */
export type ColorInsignia = 'trazo' | 'principal' | 'apagado' | 'oscuro' | 'negro';

type Pintura = {
  fill?: ColorInsignia | 'none';
  stroke?: ColorInsignia;
  strokeWidth?: number;
  strokeLinecap?: 'round';
  opacity?: number;
  transform?: string;
};

export type Trazo =
  | ({ t: 'circle'; cx: number; cy: number; r: number } & Pintura)
  | ({ t: 'ellipse'; cx: number; cy: number; rx: number; ry: number } & Pintura)
  | ({ t: 'path'; d: string } & Pintura)
  | ({ t: 'g'; hijos: Trazo[] } & Pintura);

/** El color de verdad de cada nombre, para el rango de la insignia. */
export function coloresDeInsignia(rango: number): Record<ColorInsignia, string> {
  const pal = PALETAS_RANGO[rango] ?? PALETAS_RANGO[1];
  return { trazo: pal.claro, principal: pal.principal, apagado: pal.apagado, oscuro: '#05060a', negro: '#020204' };
}

/** Todas se dibujan en una caja de 24 x 24. */
export const CAJA_INSIGNIA = 24;

export const INSIGNIAS: Record<number, Trazo[]> = {
  // Polvo: puntos sueltos, con una veladura que los junta.
  //
  // La veladura de atrás es lo que hace que a 16 px esto se lea como UNA cosa
  // —una nube— y no como cuatro píxeles sueltos que podrían ser suciedad de
  // la pantalla.
  1: [
    { t: 'circle', cx: 12, cy: 12, r: 9, fill: 'apagado', opacity: 0.14 },
    {
      t: 'g',
      fill: 'trazo',
      hijos: [
        { t: 'circle', cx: 8.5, cy: 9.5, r: 2 },
        { t: 'circle', cx: 15, cy: 7.5, r: 1.2 },
        { t: 'circle', cx: 16.5, cy: 14, r: 1.7 },
        { t: 'circle', cx: 10, cy: 16.5, r: 1.15 },
        { t: 'circle', cx: 6, cy: 14, r: 0.8, opacity: 0.65 },
        { t: 'circle', cx: 13, cy: 12, r: 0.6, opacity: 0.5 },
      ],
    },
  ],

  // Asteroide: roca angulosa, con su cara iluminada y su sombra.
  //
  // La misma silueta irregular de antes —es lo que lo distingue de todo lo
  // demás, que es redondo— pero en tres planos: sombra, cuerpo y la cara de
  // arriba. Antes era un polígono de un solo color con dos agujeros, o sea una
  // mancha con lunares.
  2: [
    { t: 'path', d: 'M7 5 L15 4 L20 9 L19 15 L13 20 L6 18 L4 11 Z', fill: 'apagado' },
    { t: 'path', d: 'M7 5 L15 4 L20 9 L14.5 12.5 L6 13.5 L4 11 Z', fill: 'principal' },
    { t: 'path', d: 'M7 5 L15 4 L17.5 6.5 L8.5 8 Z', fill: 'trazo', opacity: 0.55 },
    { t: 'circle', cx: 10.2, cy: 9.6, r: 1.6, fill: 'oscuro', opacity: 0.38 },
    { t: 'circle', cx: 15, cy: 14.5, r: 1.15, fill: 'oscuro', opacity: 0.3 },
  ],

  // Luna: esfera con la cara oscura visible y cráteres.
  //
  // La versión anterior era un disco con un mordisco chico: a 16 px parecía
  // una galletita, no una luna. Tres cosas la arreglan.
  // 1) La CARA OSCURA: un disco tenue detrás. Sin él hay un creciente
  //    flotando; con él hay una esfera de la que se ve un pedazo iluminado,
  //    que es lo que se ve en el cielo.
  // 2) El creciente MÁS FINO, o sea la mordida más honda. El de antes se comía
  //    poco y la silueta no llegaba a leerse.
  // 3) Los CRÁTERES, que son lo único que distingue una luna de cualquier
  //    creciente. Van dos y no cuatro: a 18 px se pisan.
  // Los cortes del arco están calculados —intersección de r=9 con la mordida
  // r=8 centrada en (16.2, 9.4)— y no estimados: con un número a ojo el
  // creciente se cierra o se abre de golpe.
  3: [
    { t: 'circle', cx: 12, cy: 12, r: 9, fill: 'apagado', opacity: 0.2 },
    { t: 'path', d: 'M 11.37 3.03 A 9 9 0 1 0 19.75 16.57 A 8 8 0 0 1 11.37 3.03 Z', fill: 'trazo' },
    { t: 'circle', cx: 6.5, cy: 11.4, r: 1.55, fill: 'oscuro', opacity: 0.28 },
    { t: 'circle', cx: 8.8, cy: 16.3, r: 1.15, fill: 'oscuro', opacity: 0.24 },
  ],

  // Planeta: una ESFERA con bandas, iluminada de un lado.
  //
  // Las bandas eran dos arcos de un pelo de grosor y a 18 px no existían:
  // quedaba un círculo de color con una sombra. Ahora son franjas con cuerpo
  // —una clara arriba, una apagada abajo— que es lo que hace que se lea
  // "planeta con atmósfera" y no "pelota". El terminador sigue siendo lo que
  // lo separa de un disco plano.
  4: [
    { t: 'circle', cx: 12, cy: 12, r: 8.4, fill: 'principal' },
    { t: 'path', d: 'M5.2 8.4 Q12 11.6 18.8 8.4 L18.8 10.6 Q12 13.8 5.2 10.6 Z', fill: 'trazo', opacity: 0.5 },
    { t: 'path', d: 'M4.6 13.4 Q12 16.6 19.4 13.4 L19.4 15.4 Q12 18.6 4.6 15.4 Z', fill: 'apagado', opacity: 0.75 },
    { t: 'path', d: 'M12 3.6 a8.4 8.4 0 0 1 0 16.8 a11 11 0 0 0 0 -16.8 Z', fill: 'oscuro', opacity: 0.46 },
  ],

  // Sol: disco incandescente, con núcleo y corona.
  //
  // Antes: un círculo de un color plano y ocho palitos iguales, o sea el sol
  // de un pronóstico del tiempo. Ahora el disco tiene un núcleo más claro
  // desplazado —de dónde viene la luz— y los rayos son de dos largos
  // alternados, que es lo que hace que parezca radiar en vez de tener púas.
  5: [
    { t: 'circle', cx: 12, cy: 12, r: 8.6, fill: 'principal', opacity: 0.18 },
    { t: 'circle', cx: 12, cy: 12, r: 6.2, fill: 'principal' },
    { t: 'circle', cx: 10.8, cy: 10.8, r: 3.4, fill: 'trazo' },
    {
      t: 'g',
      stroke: 'trazo',
      strokeWidth: 1.7,
      strokeLinecap: 'round',
      hijos: [{ t: 'path', d: 'M12 1.4 v2.6 M12 20 v2.6 M1.4 12 h2.6 M20 12 h2.6' }],
    },
    {
      t: 'g',
      stroke: 'principal',
      strokeWidth: 1.5,
      strokeLinecap: 'round',
      hijos: [{ t: 'path', d: 'M4.5 4.5 l1.7 1.7 M17.8 17.8 l1.7 1.7 M19.5 4.5 l-1.7 1.7 M6.2 17.8 l-1.7 1.7' }],
    },
  ],

  // Sistema: sol + órbita inclinada + planeta.
  //
  // LA ÓRBITA VA INCLINADA, y es todo el arreglo: derecha y simétrica, un
  // anillo con un círculo en el medio es un OJO, y a 16 px eso es lo único
  // que se ve. Veinte grados alcanzan para que deje de serlo sin dejar de ser
  // una órbita.
  // Y pasa por detrás del sol: el arco de adelante se dibuja después del
  // disco, que es lo que da la vuelta completa.
  6: [
    {
      t: 'g',
      transform: 'rotate(-20 12 12)',
      hijos: [
        { t: 'ellipse', cx: 12, cy: 12, rx: 10.4, ry: 4.2, stroke: 'principal', strokeWidth: 1.6, fill: 'none', opacity: 0.5 },
        { t: 'circle', cx: 12, cy: 12, r: 5.8, fill: 'principal', opacity: 0.2 },
        { t: 'circle', cx: 12, cy: 12, r: 3.7, fill: 'trazo' },
        { t: 'path', d: 'M1.6 12 a10.4 4.2 0 0 0 20.8 0', stroke: 'principal', strokeWidth: 1.7, fill: 'none' },
        { t: 'circle', cx: 21.6, cy: 12.9, r: 2.1, fill: 'principal' },
        { t: 'path', d: 'M21.6 10.8 a2.1 2.1 0 0 1 0 4.2 a2.8 2.8 0 0 0 0 -4.2 Z', fill: 'oscuro', opacity: 0.45 },
      ],
    },
  ],

  // Galaxia: bulbo encendido y dos brazos que se abren y se afinan.
  //
  // Sigue a la forma de la animación (15/9), que es lo que se ve al subir de
  // rango y en la entrada: BULBO grande y brillante, dos brazos ANCHOS que
  // arrancan pegados al centro y se deshilachan, y un halo elíptico. La
  // versión anterior tenía el núcleo del mismo peso que los brazos, y sin ese
  // contraste una espiral chica se lee como un garabato.
  //
  // Los brazos van con `stroke-width` decreciente en dos tramos: uno grueso
  // cerca del bulbo y uno fino en la punta. Un brazo de grosor parejo parece
  // un alambre.
  //
  // El bulbo: tres discos, del halo al corazón. Es lo que hace que a 16 px se
  // lea una galaxia y no dos rayas cruzadas.
  7: [
    { t: 'ellipse', cx: 12, cy: 12, rx: 10.8, ry: 6.2, fill: 'principal', opacity: 0.16, transform: 'rotate(-24 12 12)' },
    {
      t: 'g',
      fill: 'none',
      stroke: 'principal',
      strokeLinecap: 'round',
      hijos: [
        { t: 'path', d: 'M13.6 11 C 17 9.8, 19.4 12, 18.6 15.4', strokeWidth: 2.8 },
        { t: 'path', d: 'M10.4 13 C 7 14.2, 4.6 12, 5.4 8.6', strokeWidth: 2.8 },
      ],
    },
    {
      t: 'g',
      fill: 'none',
      stroke: 'principal',
      strokeLinecap: 'round',
      opacity: 0.7,
      hijos: [
        { t: 'path', d: 'M18.6 15.4 C 18.3 17.6, 16.8 18.8, 15 19', strokeWidth: 1.3 },
        { t: 'path', d: 'M5.4 8.6 C 5.7 6.4, 7.2 5.2, 9 5', strokeWidth: 1.3 },
      ],
    },
    { t: 'circle', cx: 12, cy: 12, r: 5.4, fill: 'trazo', opacity: 0.16 },
    { t: 'circle', cx: 12, cy: 12, r: 3.4, fill: 'trazo', opacity: 0.45 },
    { t: 'circle', cx: 12, cy: 12, r: 2, fill: 'trazo' },
  ],

  // Agujero negro: disco de acreción + la luz doblada por arriba.
  //
  // El orden importa y es todo el dibujo: el disco pasa POR DETRÁS, la esfera
  // lo tapa, la luz del lado de atrás aparece curvada por ARRIBA —que es la
  // firma de un agujero negro y es lo que este ícono no tenía— y el frente del
  // disco vuelve por delante. Todos los trazos un poco más gruesos, para que a
  // 16 px el anillo de luz no desaparezca.
  8: [
    { t: 'ellipse', cx: 12, cy: 13, rx: 11, ry: 3.6, fill: 'none', stroke: 'principal', strokeWidth: 2.4 },
    { t: 'circle', cx: 12, cy: 12, r: 6.2, fill: 'negro' },
    { t: 'path', d: 'M4.2 11.5 A 8.4 8.4 0 0 1 19.8 11.5', fill: 'none', stroke: 'trazo', strokeWidth: 2.2, strokeLinecap: 'round' },
    { t: 'circle', cx: 12, cy: 12, r: 6.2, fill: 'none', stroke: 'trazo', strokeWidth: 1.1 },
    { t: 'path', d: 'M1.1 13 A 11 3.6 0 0 0 22.9 13', fill: 'none', stroke: 'principal', strokeWidth: 2.4, strokeLinecap: 'round' },
  ],
};
