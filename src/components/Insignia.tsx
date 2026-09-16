import { PALETAS_RANGO } from '@/lib/paletas';

// Insignia chica de alto contraste para listas (24px por omisión, 38 en el
// ranking). Los rangos 1, 2 y 3 se parecen demasiado en chico: la silueta va
// exagerada más de lo realista, a propósito.
// El color sale de la paleta del rango que representa (no de la del usuario):
// en una lista de amigos, cada insignia lleva el color de SU rango.
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
export default function Insignia({ rango, tam = 24 }: { rango: number; tam?: number }) {
  const pal = PALETAS_RANGO[rango] ?? PALETAS_RANGO[1];
  const trazo = pal.claro;
  const oscuro = '#05060a';
  const s = { width: tam, height: tam, flex: 'none' } as const;

  switch (rango) {
    case 1: // Polvo: puntos sueltos, con una veladura que los junta
      return (
        <svg style={s} viewBox="0 0 24 24" aria-hidden>
          {/* La veladura de atrás es lo que hace que a 16 px esto se lea como
              UNA cosa —una nube— y no como cuatro píxeles sueltos que podrían
              ser suciedad de la pantalla. */}
          <circle cx="12" cy="12" r="9" fill={pal.apagado} opacity=".14" />
          <g fill={trazo}>
            <circle cx="8.5" cy="9.5" r="2" />
            <circle cx="15" cy="7.5" r="1.2" />
            <circle cx="16.5" cy="14" r="1.7" />
            <circle cx="10" cy="16.5" r="1.15" />
            <circle cx="6" cy="14" r=".8" opacity=".65" />
            <circle cx="13" cy="12" r=".6" opacity=".5" />
          </g>
        </svg>
      );
    case 2: // Asteroide: roca angulosa, con su cara iluminada y su sombra
      return (
        <svg style={s} viewBox="0 0 24 24" aria-hidden>
          {/* La misma silueta irregular de antes —es lo que lo distingue de
              todo lo demás, que es redondo— pero en tres planos: sombra,
              cuerpo y la cara de arriba. Antes era un polígono de un solo
              color con dos agujeros, o sea una mancha con lunares. */}
          <path d="M7 5 L15 4 L20 9 L19 15 L13 20 L6 18 L4 11 Z" fill={pal.apagado} />
          <path d="M7 5 L15 4 L20 9 L14.5 12.5 L6 13.5 L4 11 Z" fill={pal.principal} />
          <path d="M7 5 L15 4 L17.5 6.5 L8.5 8 Z" fill={trazo} opacity=".55" />
          <circle cx="10.2" cy="9.6" r="1.6" fill={oscuro} opacity=".38" />
          <circle cx="15" cy="14.5" r="1.15" fill={oscuro} opacity=".3" />
        </svg>
      );
    case 3: // Luna: esfera con la cara oscura visible y cráteres
      return (
        <svg style={s} viewBox="0 0 24 24" aria-hidden>
          {/* La versión anterior era un disco con un mordisco chico: a 16 px
              parecia una galletita, no una luna. Tres cosas la arreglan.
              1) La CARA OSCURA: un disco tenue detras. Sin el hay un creciente
              flotando; con el hay una esfera de la que se ve un pedazo
              iluminado, que es lo que se ve en el cielo.
              2) El creciente MAS FINO, o sea la mordida mas honda. El de antes
              se comia poco y la silueta no llegaba a leerse.
              3) Los CRATERES, que son lo unico que distingue una luna de
              cualquier creciente. Van dos y no cuatro: a 18 px se pisan.
              Los cortes del arco estan calculados —interseccion de r=9 con la
              mordida r=8 centrada en (16.2, 9.4)— y no estimados: con un
              numero a ojo el creciente se cierra o se abre de golpe. */}
          <circle cx="12" cy="12" r="9" fill={pal.apagado} opacity=".2" />
          <path d="M 11.37 3.03 A 9 9 0 1 0 19.75 16.57 A 8 8 0 0 1 11.37 3.03 Z" fill={trazo} />
          <circle cx="6.5" cy="11.4" r="1.55" fill={oscuro} opacity=".28" />
          <circle cx="8.8" cy="16.3" r="1.15" fill={oscuro} opacity=".24" />
        </svg>
      );
    case 4: // Planeta: una ESFERA con bandas, iluminada de un lado
      return (
        <svg style={s} viewBox="0 0 24 24" aria-hidden>
          {/* Las bandas eran dos arcos de un pelo de grosor y a 18 px no
              existían: quedaba un círculo de color con una sombra. Ahora son
              franjas con cuerpo —una clara arriba, una apagada abajo— que es
              lo que hace que se lea "planeta con atmósfera" y no "pelota".
              El terminador sigue siendo lo que lo separa de un disco plano. */}
          <circle cx="12" cy="12" r="8.4" fill={pal.principal} />
          <path
            d="M5.2 8.4 Q12 11.6 18.8 8.4 L18.8 10.6 Q12 13.8 5.2 10.6 Z"
            fill={trazo}
            opacity=".5"
          />
          <path
            d="M4.6 13.4 Q12 16.6 19.4 13.4 L19.4 15.4 Q12 18.6 4.6 15.4 Z"
            fill={pal.apagado}
            opacity=".75"
          />
          <path d="M12 3.6 a8.4 8.4 0 0 1 0 16.8 a11 11 0 0 0 0 -16.8 Z" fill={oscuro} opacity=".46" />
        </svg>
      );
    case 5: // Sol: disco incandescente, con núcleo y corona
      return (
        <svg style={s} viewBox="0 0 24 24" aria-hidden>
          {/* Antes: un círculo de un color plano y ocho palitos iguales, o
              sea el sol de un pronóstico del tiempo. Ahora el disco tiene un
              núcleo más claro desplazado —de dónde viene la luz— y los rayos
              son de dos largos alternados, que es lo que hace que parezca
              radiar en vez de tener púas. */}
          <circle cx="12" cy="12" r="8.6" fill={pal.principal} opacity=".18" />
          <circle cx="12" cy="12" r="6.2" fill={pal.principal} />
          <circle cx="10.8" cy="10.8" r="3.4" fill={trazo} />
          <g stroke={trazo} strokeWidth="1.7" strokeLinecap="round">
            <path d="M12 1.4 v2.6 M12 20 v2.6 M1.4 12 h2.6 M20 12 h2.6" />
          </g>
          <g stroke={pal.principal} strokeWidth="1.5" strokeLinecap="round">
            <path d="M4.5 4.5 l1.7 1.7 M17.8 17.8 l1.7 1.7 M19.5 4.5 l-1.7 1.7 M6.2 17.8 l-1.7 1.7" />
          </g>
        </svg>
      );
    case 6: // Sistema: sol + órbita inclinada + planeta
      return (
        <svg style={s} viewBox="0 0 24 24" aria-hidden>
          {/* LA ÓRBITA VA INCLINADA, y es todo el arreglo: derecha y
              simétrica, un anillo con un círculo en el medio es un OJO, y a
              16 px eso es lo único que se ve. Veinte grados alcanzan para que
              deje de serlo sin dejar de ser una órbita.
              Y pasa por detrás del sol: el arco de adelante se dibuja después
              del disco, que es lo que da la vuelta completa. */}
          <g transform="rotate(-20 12 12)">
            <ellipse
              cx="12" cy="12" rx="10.4" ry="4.2"
              stroke={pal.principal} strokeWidth="1.6" fill="none" opacity=".5"
            />
            <circle cx="12" cy="12" r="5.8" fill={pal.principal} opacity=".2" />
            <circle cx="12" cy="12" r="3.7" fill={trazo} />
            <path
              d="M1.6 12 a10.4 4.2 0 0 0 20.8 0"
              stroke={pal.principal} strokeWidth="1.7" fill="none"
            />
            <circle cx="21.6" cy="12.9" r="2.1" fill={pal.principal} />
            <path
              d="M21.6 10.8 a2.1 2.1 0 0 1 0 4.2 a2.8 2.8 0 0 0 0 -4.2 Z"
              fill={oscuro} opacity=".45"
            />
          </g>
        </svg>
      );
    case 7: // Galaxia: bulbo encendido y dos brazos que se abren y se afinan
      return (
        <svg style={s} viewBox="0 0 24 24" aria-hidden>
          {/* Sigue a la forma de la animación (15/9), que es lo que se ve al
              subir de rango y en la entrada: BULBO grande y brillante, dos
              brazos ANCHOS que arrancan pegados al centro y se deshilachan, y
              un halo elíptico. La versión anterior tenía el núcleo del mismo
              peso que los brazos, y sin ese contraste una espiral chica se lee
              como un garabato.

              Los brazos van con `stroke-width` decreciente en dos tramos: uno
              grueso cerca del bulbo y uno fino en la punta. Un brazo de grosor
              parejo parece un alambre. */}
          <ellipse
            cx="12" cy="12" rx="10.8" ry="6.2"
            fill={pal.principal} opacity=".16"
            transform="rotate(-24 12 12)"
          />
          <g fill="none" stroke={pal.principal} strokeLinecap="round">
            <path d="M13.6 11 C 17 9.8, 19.4 12, 18.6 15.4" strokeWidth="2.8" />
            <path d="M10.4 13 C 7 14.2, 4.6 12, 5.4 8.6" strokeWidth="2.8" />
          </g>
          <g fill="none" stroke={pal.principal} strokeLinecap="round" opacity=".7">
            <path d="M18.6 15.4 C 18.3 17.6, 16.8 18.8, 15 19" strokeWidth="1.3" />
            <path d="M5.4 8.6 C 5.7 6.4, 7.2 5.2, 9 5" strokeWidth="1.3" />
          </g>
          {/* El bulbo: tres discos, del halo al corazón. Es lo que hace que a
              16 px se lea una galaxia y no dos rayas cruzadas. */}
          <circle cx="12" cy="12" r="5.4" fill={trazo} opacity=".16" />
          <circle cx="12" cy="12" r="3.4" fill={trazo} opacity=".45" />
          <circle cx="12" cy="12" r="2" fill={trazo} />
        </svg>
      );
    case 8: // Agujero negro: disco de acreción + la luz doblada por arriba
      return (
        <svg style={s} viewBox="0 0 24 24" aria-hidden>
          {/* El orden importa y es todo el dibujo: el disco pasa POR DETRÁS,
              la esfera lo tapa, la luz del lado de atrás aparece curvada por
              ARRIBA — que es la firma de un agujero negro y es lo que este
              icono no tenía — y el frente del disco vuelve por delante.
              Lo único que cambió: todos los trazos un poco más gruesos, para
              que a 16 px el anillo de luz no desaparezca. */}
          <ellipse cx="12" cy="13" rx="11" ry="3.6" fill="none" stroke={pal.principal} strokeWidth="2.4" />
          <circle cx="12" cy="12" r="6.2" fill="#020204" />
          <path
            d="M4.2 11.5 A 8.4 8.4 0 0 1 19.8 11.5"
            fill="none" stroke={pal.claro} strokeWidth="2.2" strokeLinecap="round"
          />
          <circle cx="12" cy="12" r="6.2" fill="none" stroke={pal.claro} strokeWidth="1.1" />
          <path
            d="M1.1 13 A 11 3.6 0 0 0 22.9 13"
            fill="none" stroke={pal.principal} strokeWidth="2.4" strokeLinecap="round"
          />
        </svg>
      );
    default:
      return null;
  }
}
