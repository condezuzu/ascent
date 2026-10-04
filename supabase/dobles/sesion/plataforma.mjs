// El almacenamiento del TELÉFONO: asíncrono y en fila, como AsyncStorage. Las
// operaciones se atienden en el orden en que se pidieron y cada una tarda una
// vuelta del bucle de eventos. Es lo que deja que un toque caiga EN EL MEDIO de
// un refresco: en la web (`cfg.comoLaWeb`) todo resuelve en el mismo tick y ese
// hueco no existe.
export const cfg = { comoLaWeb: false };
export const datos = new Map();
// Cuántas operaciones se atendieron, para que un escenario pueda soltar un toque
// "N operaciones después de tal cosa" y dé siempre lo mismo.
export const servidas = { n: 0, alServir: null };

let fila = Promise.resolve();
function operacion(fn) {
  if (cfg.comoLaWeb) return Promise.resolve(fn());
  const r = fila.then(
    () =>
      new Promise((listo) =>
        setImmediate(() => {
          servidas.n++;
          servidas.alServir?.(servidas.n);
          listo(fn());
        })
      )
  );
  fila = r.catch(() => {});
  return r;
}

const almacenamiento = {
  leer: (clave) => operacion(() => (datos.has(clave) ? datos.get(clave) : null)),
  guardar: (clave, valor) => operacion(() => void datos.set(clave, valor)),
  borrar: (clave) => operacion(() => void datos.delete(clave)),
};

const memoria = new Map();
const efimero = {
  leer: async (clave) => (memoria.has(clave) ? memoria.get(clave) : null),
  guardar: async (clave, valor) => void memoria.set(clave, valor),
  borrar: async (clave) => void memoria.delete(clave),
};

let visible = true;
const oyentes = new Set();
/** Bloquear (false) y desbloquear (true) el teléfono. */
export function cambiarVisible(v) {
  visible = v;
  for (const fn of [...oyentes]) fn(v);
}

export const plataforma = {
  almacenamiento,
  efimero,
  ciclo: {
    visible: () => visible,
    alCambiar: (fn) => {
      oyentes.add(fn);
      return () => oyentes.delete(fn);
    },
  },
  salud: { pasosEntre: async () => null },
  avisos: { conPantallaBloqueada: () => false, cancelar: async () => {}, programar: async () => {} },
  enVivo: { disponible: () => false, esconder: async () => {}, mostrarDescanso: async () => {} },
  haptica: { pulso: () => false, disponible: () => false },
};
