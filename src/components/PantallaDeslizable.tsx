'use client';

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { T } from '@nucleo/textos';
import { cambiaDePestana, CURVA as CURVA_BEZIER, VIAJE_MS } from '@nucleo/deslizar';

// El mismo orden que la barra de abajo
export const PESTANAS = ['/', '/social', '/album', '/stats', '/ajustes'] as const;

// Las reglas del gesto viven en `nucleo/deslizar.ts`: la nativa usa las
// mismas, y un gesto que pide la mitad de la pantalla de un lado y un quinto
// del otro no es la misma app con dos interfaces, son dos apps.
const CURVA = `cubic-bezier(${CURVA_BEZIER.join(',')})`;

/**
 * LA PESTAÑA DE AL LADO ASOMA MIENTRAS SE ARRASTRA (19/9).
 *
 * Antes la pantalla seguía al dedo pero sola: del costado no venía nada, al
 * soltar se desvanecía, recién ahí se navegaba y la pestaña nueva aparecía
 * entera y de golpe cuando terminaba de cargar. Se sentía "se mueve, carga, se
 * mueve, carga".
 *
 * Ahora del costado entra una COPIA de cómo quedó esa pestaña la última vez
 * que se vio (`instantaneas`, guardada al irse de ella), pegada a la actual y
 * siguiendo el mismo dedo. Al soltar terminan el viaje juntas, se navega, y la
 * copia se queda puesta hasta que la pestaña de verdad está montada: no hay un
 * momento en que no haya nada. Si nunca se abrió, asoma con su título.
 *
 * La copia es un clon del DOM, quieta y sin eventos (`inert`): sirve para
 * mirar, no para tocar. Los `canvas` salen vacíos; el fondo es de todas.
 */
const instantaneas = new Map<string, HTMLElement>();
let asomoVivo: HTMLDivElement | null = null;

const TITULOS: Partial<Record<(typeof PESTANAS)[number], string>> = {
  '/social': T.social.titulo,
  '/album': T.album.titulo,
  '/stats': T.stats.titulo,
  '/ajustes': T.ajustes.titulo,
};

function quitarAsomo() {
  asomoVivo?.remove();
  asomoVivo = null;
}

function armarAsomo(ruta: (typeof PESTANAS)[number]): HTMLDivElement {
  quitarAsomo();
  const cont = document.createElement('div');
  cont.className = 'asomo';
  cont.setAttribute('aria-hidden', 'true');
  cont.inert = true;
  const foto = instantaneas.get(ruta);
  if (foto) {
    cont.appendChild(foto.cloneNode(true));
  } else {
    const p = document.createElement('div');
    p.className = 'pantalla';
    const t = document.createElement('div');
    t.className = 'titulo-pantalla';
    t.textContent = TITULOS[ruta] ?? '';
    p.appendChild(t);
    cont.appendChild(p);
  }
  document.body.appendChild(cont);
  asomoVivo = cont;
  return cont;
}

/**
 * LA PANTALLA NO SE MUESTRA HASTA SABER (19/9).
 *
 * Cada pantalla pintaba su estado vacío antes de tener los datos y después
 * saltaba al de verdad: "Buscar gente" y la lista de golpe en Ranking, "Tus
 * días" arriba y después abajo en Stats, "Marca tu gimnasio" un instante en
 * Inicio. Era siempre lo mismo, así que se arregla acá y no en cada pantalla.
 *
 * La pantalla arranca oculta (se ve el fondo, con su rango, y la barra) y
 * aparece entera cuando:
 *   - quien la usa dice `listo` (sus datos principales llegaron), y
 *   - toda sección de adentro que llamó `useEsperar(false)` pasó a `true`.
 * Una sección que carga lo suyo por separado (el calendario de Stats) avisa
 * con `useEsperar`, y la pantalla no aparece sin ella.
 *
 * TOPE: a los `ESPERA_MAXIMA_MS` aparece igual. Sin red, mostrar lo que haya
 * es mejor que el vacío para siempre. Un error ("no cargó") cuenta como listo:
 * es algo que se sabe.
 *
 * Al deslizar, la copia de la pestaña (ver arriba) se queda puesta hasta que
 * la de verdad aparece: no hay un cuadro sin nada.
 */
const ESPERA_MAXIMA_MS = 4000;
const Espera = createContext<((id: symbol, listo: boolean) => void) | null>(null);

/**
 * Una sección que carga sus datos por separado: la pantalla no aparece hasta
 * que esto sea `true`. Fuera de una `PantallaDeslizable` no hace nada.
 */
export function useEsperar(listo: boolean) {
  const avisar = useContext(Espera);
  const [id] = useState(() => Symbol('seccion'));
  // Antes de pintar: la pantalla lo decide en el mismo paso (ver abajo).
  useLayoutEffect(() => {
    avisar?.(id, listo);
  }, [avisar, id, listo]);
  useLayoutEffect(() => () => avisar?.(id, true), [avisar, id]);
}

/**
 * LO MISMO PARA UNA PARTE DE LA PANTALLA: lo que se monta DESPUÉS de que la
 * pantalla apareció (la pestaña "Entrenamiento" de Stats). Sus secciones
 * avisan con `useEsperar` a esto y no a la pantalla; hasta que todas avisan,
 * se ocupa el lugar pero no se ve. Si la pantalla todavía no apareció, la
 * espera también a ella.
 */
export function Esperar({ children, listo = true }: { children: React.ReactNode; listo?: boolean }) {
  const pendientes = useRef(new Map<symbol, boolean>());
  const [cambio, setCambio] = useState(0);
  const [revelada, setRevelada] = useState(false);
  const avisar = useCallback((id: symbol, ok: boolean) => {
    if (pendientes.current.get(id) === ok) return;
    pendientes.current.set(id, ok);
    setCambio((n) => n + 1);
  }, []);
  useLayoutEffect(() => {
    if (revelada) return;
    if (listo && ![...pendientes.current.values()].some((ok) => !ok)) setRevelada(true);
  }, [listo, cambio, revelada]);
  useEffect(() => {
    const t = setTimeout(() => setRevelada(true), ESPERA_MAXIMA_MS);
    return () => clearTimeout(t);
  }, []);
  useEsperar(revelada);
  return (
    <Espera.Provider value={avisar}>
      <div className={revelada ? 'parte-lista' : 'parte-esperando'} aria-busy={!revelada || undefined}>
        {children}
      </div>
    </Espera.Provider>
  );
}

/**
 * Envuelve el contenido de una pestaña y permite cambiar deslizando.
 *
 * El contenido SIGUE AL DEDO mientras se arrastra —no salta al soltar— y al
 * soltar completa el movimiento o vuelve a su lugar. La barra de abajo sigue
 * funcionando igual.
 */
export default function PantallaDeslizable({
  children,
  onClick,
  clase,
  listo = true,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  /** Una clase más para la `.pantalla` (Inicio pone `en-sesion`). */
  clase?: string;
  /** Los datos principales de la pantalla ya están (ver arriba). */
  listo?: boolean;
}) {
  const router = useRouter();
  const ruta = usePathname();
  const ref = useRef<HTMLDivElement>(null);
  const [saliendo, setSaliendo] = useState<'izq' | 'der' | null>(null);

  const indice = PESTANAS.indexOf(ruta as (typeof PESTANAS)[number]);

  // ---- la espera ----
  const pendientes = useRef(new Map<symbol, boolean>());
  const [cambio, setCambio] = useState(0);
  const [revelada, setRevelada] = useState(false);
  // Si hubo que esperar de verdad: solo ahí la aparición se anima. La que ya
  // estaba lista aparece como siempre, sin un fundido que no dice nada.
  const [espero, setEspero] = useState(false);
  const avisar = useCallback((id: symbol, ok: boolean) => {
    const antes = pendientes.current.get(id);
    if (antes === ok) return;
    pendientes.current.set(id, ok);
    setCambio((n) => n + 1);
  }, []);
  // Los efectos de los hijos corren antes que este: cuando se evalúa, las
  // secciones ya avisaron si esperan algo. De layout, antes de pintar: la
  // pantalla que ya tiene todo aparece en el primer cuadro, sin uno oculto.
  useLayoutEffect(() => {
    if (revelada) return;
    const falta = !listo || [...pendientes.current.values()].some((ok) => !ok);
    if (!falta) setRevelada(true);
    else setEspero(true);
  }, [listo, cambio, revelada]);
  useEffect(() => {
    const t = setTimeout(() => setRevelada(true), ESPERA_MAXIMA_MS);
    return () => clearTimeout(t);
  }, []);


  // LA ENTRADA ESCALONADA, UNA SOLA VEZ POR APERTURA.
  //
  // Cada ruta es su propio componente: cambiar de pestaña desmonta y remonta, y
  // la entrada se repetía entera cada vez. Con `ya-entro` puesto en el `body`
  // —que sobrevive a la navegación del cliente y se pierde al recargar— la
  // segunda pantalla en adelante aparece sin animarse.
  //
  // SE ESPERA A QUE LA PRIMERA TERMINE. Poniendo la clase al montar se cortaría
  // la animación que está corriendo en ese mismo instante, que es el parpadeo
  // que esto viene a sacar. 0,29 s del último escalón + 0,55 s de la animación,
  // más un respiro.
  //
  // Cuenta desde que la pantalla APARECE, no desde que se monta: si esperó
  // sus datos, la entrada recién arranca ahí.
  useEffect(() => {
    if (typeof document === 'undefined' || !revelada) return;
    if (document.body.classList.contains('ya-entro')) return;
    const t = setTimeout(() => document.body.classList.add('ya-entro'), 900);
    return () => clearTimeout(t);
  }, [revelada]);

  // LA FOTO DE ESTA PESTAÑA, al irse: es lo que va a asomar desde la de al
  // lado. En el `cleanup` de un layout effect el DOM todavía está.
  //
  // Con la pestaña de CUANDO SE MONTÓ, no la de ahora: la que se va se entera
  // de la ruta nueva antes de desmontarse, y guardaría su foto con el nombre
  // de la otra.
  const indiceAlMontar = useRef(indice);
  useLayoutEffect(() => {
    const el = ref.current;
    const indice = indiceAlMontar.current;
    if (!el || indice < 0) return;
    return () => {
      const p = el.querySelector(':scope > .pantalla');
      if (!p) return;
      const copia = p.cloneNode(true) as HTMLElement;
      copia.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
      instantaneas.set(PESTANAS[indice], copia);
    };
  }, []);

  // Las de al lado, pedidas de antemano: al soltar, la navegación no espera
  // a que llegue el código de la pestaña nueva.
  useEffect(() => {
    if (indice < 0) return;
    if (indice > 0) router.prefetch(PESTANAS[indice - 1]);
    if (indice < PESTANAS.length - 1) router.prefetch(PESTANAS[indice + 1]);
  }, [indice, router]);

  useEffect(() => {
    const el = ref.current;
    if (el === null || indice < 0) return;

    let x0 = 0;
    let y0 = 0;
    let t0 = 0;
    let arrastrando = false;
    let decidido = false;
    // De qué lado asoma la vecina: 1 = la siguiente (entra por la derecha),
    // -1 = la anterior. 0 = ninguna.
    let lado = 0;

    const ancho = () => el.clientWidth || window.innerWidth;

    function alEmpezar(e: TouchEvent) {
      if (e.touches.length !== 1) return;
      x0 = e.touches[0].clientX;
      y0 = e.touches[0].clientY;
      t0 = performance.now();
      arrastrando = true;
      decidido = false;
      lado = 0;
      el!.style.transition = 'none';
      // `will-change` SOLO durante el gesto: puesto siempre, este div es el
      // bloque contenedor de sus hijos `position: fixed` y la acción anclada
      // deja de estar anclada a la pantalla. Ver el comentario en globals.
      el!.style.willChange = 'transform';
    }

    function alMover(e: TouchEvent) {
      if (!arrastrando) return;
      const dx = e.touches[0].clientX - x0;
      const dy = e.touches[0].clientY - y0;

      // Hasta no saber si el gesto es horizontal o vertical no se toca nada:
      // si no, se rompe el scroll de la pantalla.
      if (!decidido) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        if (Math.abs(dy) > Math.abs(dx)) {
          arrastrando = false; // es scroll, no es nuestro
          return;
        }
        decidido = true;
      }

      const quiere = dx > 0 ? -1 : 1;
      const destino = indice + quiere;
      const sinDestino = destino < 0 || destino >= PESTANAS.length;
      // en los extremos el arrastre ofrece resistencia, para que se note
      // que no hay nada más de ese lado
      const d = sinDestino ? dx * 0.25 : dx;
      el!.style.transform = `translate3d(${d}px, 0, 0)`;

      if (sinDestino) {
        if (lado !== 0) quitarAsomo();
        lado = 0;
      } else {
        if (lado !== quiere || !asomoVivo) {
          const a = armarAsomo(PESTANAS[destino]);
          a.style.transition = 'none';
          lado = quiere;
        }
        asomoVivo!.style.transform = `translate3d(${d + lado * ancho()}px, 0, 0)`;
      }
      e.preventDefault();
    }

    function alSoltar(e: TouchEvent) {
      if (!arrastrando) return;
      arrastrando = false;
      if (!decidido) return;

      const dx = (e.changedTouches[0]?.clientX ?? x0) - x0;
      const dt = Math.max(1, performance.now() - t0);
      const cambia = cambiaDePestana(dx, ancho(), dx / dt);
      const haciaAtras = dx > 0;
      const destino = haciaAtras ? indice - 1 : indice + 1;
      const asomo = asomoVivo;

      const viaje = `transform ${VIAJE_MS / 1000}s ${CURVA}`;
      el!.style.transition = viaje;
      if (asomo) asomo.style.transition = viaje;

      if (cambia && destino >= 0 && destino < PESTANAS.length && asomo) {
        // Las dos terminan el viaje juntas; recién ahí se navega. La copia se
        // queda cubriendo hasta que la pestaña de verdad se monta (ver abajo).
        setSaliendo(haciaAtras ? 'der' : 'izq');
        el!.style.transform = `translate3d(${haciaAtras ? ancho() : -ancho()}px, 0, 0)`;
        asomo.style.transform = 'translate3d(0, 0, 0)';
        setTimeout(() => router.push(PESTANAS[destino]), VIAJE_MS);
      } else {
        el!.style.transform = 'translate3d(0,0,0)';
        if (asomo) {
          asomo.style.transform = `translate3d(${lado * ancho()}px, 0, 0)`;
          setTimeout(() => {
            if (asomoVivo === asomo) quitarAsomo();
          }, VIAJE_MS);
        }
        // Y al terminar el viaje de vuelta se limpia TODO: un `transform`
        // puesto —aunque sea la identidad— también crea bloque contenedor, así
        // que dejar `translate3d(0,0,0)` sería cambiar un problema por el
        // mismo problema con otro nombre.
        const limpiar = () => {
          el!.style.transform = '';
          el!.style.willChange = '';
          el!.removeEventListener('transitionend', limpiar);
        };
        el!.addEventListener('transitionend', limpiar);
      }
    }

    el.addEventListener('touchstart', alEmpezar, { passive: true });
    el.addEventListener('touchmove', alMover, { passive: false });
    el.addEventListener('touchend', alSoltar, { passive: true });
    el.addEventListener('touchcancel', alSoltar, { passive: true });
    return () => {
      el.removeEventListener('touchstart', alEmpezar);
      el.removeEventListener('touchmove', alMover);
      el.removeEventListener('touchend', alSoltar);
      el.removeEventListener('touchcancel', alSoltar);
    };
  }, [indice, router]);

  // al montar una pestaña nueva, se limpia cualquier resto del gesto anterior
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.transition = 'none';
    // Vacío y no `translate3d(0,0,0)`: la identidad también crea bloque
    // contenedor para los `position: fixed` de adentro.
    el.style.transform = '';
    el.style.opacity = '';
    el.style.willChange = '';
    setSaliendo(null);
  }, [ruta]);

  // La copia que cubría el viaje se va cuando ESTA pestaña ya APARECIÓ (con
  // sus datos, ver la espera abajo) y está pintada: dos cuadros, para no dejar
  // uno sin nada entre las dos. Por esta pestaña y no por el cambio de ruta:
  // la que se va también se entera del cambio de ruta antes de desmontarse,
  // y la sacaría antes de tiempo.
  useEffect(() => {
    if (!revelada) return;
    let segundo = 0;
    const primero = requestAnimationFrame(() => {
      segundo = requestAnimationFrame(quitarAsomo);
    });
    return () => {
      cancelAnimationFrame(primero);
      cancelAnimationFrame(segundo);
    };
  }, [revelada]);

  // Renderiza la propia .pantalla para que las pantallas solo tengan que
  // cambiar su contenedor por este componente.
  const clases = ['pantalla', clase, !revelada ? 'esperando' : espero ? 'aparece' : ''].filter(Boolean).join(' ');
  return (
    <Espera.Provider value={avisar}>
      <div ref={ref} className={`deslizable ${saliendo ? 'saliendo' : ''}`}>
        <div className={clases} onClick={onClick} aria-busy={!revelada || undefined}>
          {children}
        </div>
      </div>
    </Espera.Provider>
  );
}
