// Un React mínimo: estado, refs, callbacks y efectos. Lo que importa para estas
// pruebas es lo mismo que importa en el teléfono: el estado nuevo NO se ve hasta
// el render siguiente, y los refs del hook se reasignan recién ahí.
let instancia = null;
const iguales = (a, b) => !!a && !!b && a.length === b.length && a.every((x, i) => Object.is(x, b[i]));

/** Monta un hook y devuelve su instancia: `r` es lo último que devolvió. */
export function montar(hook) {
  const i = { ganchos: [], idx: 0, r: null, efectos: [], programado: false, sucio: false };
  i.render = () => {
    // Un estado cambiado DURANTE el render descarta ese resultado y se dibuja
    // de nuevo antes de mostrar nada, como hace React.
    do {
      instancia = i;
      i.idx = 0;
      i.efectos = [];
      i.sucio = false;
      try {
        i.r = hook();
      } finally {
        instancia = null;
      }
    } while (i.sucio);
    const efectos = i.efectos;
    i.efectos = [];
    for (const e of efectos) e();
  };
  i.render();
  return i;
}

function programar(i) {
  if (i.programado) return;
  i.programado = true;
  queueMicrotask(() => {
    i.programado = false;
    i.render();
  });
}

export function useState(inicial) {
  const i = instancia;
  const k = i.idx++;
  if (!i.ganchos[k]) {
    const g = { v: typeof inicial === 'function' ? inicial() : inicial };
    g.set = (nuevo) => {
      const v = typeof nuevo === 'function' ? nuevo(g.v) : nuevo;
      if (Object.is(v, g.v)) return;
      g.v = v;
      if (instancia === i) i.sucio = true;
      else programar(i);
    };
    i.ganchos[k] = g;
  }
  return [i.ganchos[k].v, i.ganchos[k].set];
}

/** Lo justo para mirar qué se pidió dibujar: el tipo, la llave y las props. */
export function createElement(tipo, config) {
  const { key = null, ...props } = config ?? {};
  return { type: tipo, key, props };
}

export function useRef(inicial) {
  const i = instancia;
  const k = i.idx++;
  if (!i.ganchos[k]) i.ganchos[k] = { current: inicial };
  return i.ganchos[k];
}

export function useCallback(fn, deps) {
  const i = instancia;
  const k = i.idx++;
  const g = i.ganchos[k];
  if (g && iguales(g.deps, deps)) return g.fn;
  i.ganchos[k] = { fn, deps };
  return fn;
}

export function useEffect(fn, deps) {
  const i = instancia;
  const k = i.idx++;
  const g = i.ganchos[k];
  if (g && deps && iguales(g.deps, deps)) return;
  const lugar = { deps, limpiar: g?.limpiar };
  i.ganchos[k] = lugar;
  i.efectos.push(() => {
    lugar.limpiar?.();
    const l = fn();
    lugar.limpiar = typeof l === 'function' ? l : undefined;
  });
}
