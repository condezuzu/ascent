// El almacenamiento del aparato, en memoria, para las pruebas. Asíncrono como
// el de verdad (AsyncStorage en el teléfono, localStorage envuelto en la web).
// `memoria` se exporta para que la prueba pueda dejarla como la deja cada app.
export const memoria = new Map();

// Lo que se muere al cerrar la app (la duración del descanso de esta sesión).
const efimera = new Map();

export const plataforma = {
  // Los puertos que no importan para lo que se prueba acá, sin hacer nada.
  ciclo: { visible: () => true, alCambiar: () => () => {} },
  salud: { pasosEntre: async () => null },
  avisos: { conPantallaBloqueada: () => false, cancelar: async () => {}, programar: async () => {} },
  enVivo: { disponible: () => false, esconder: async () => {}, mostrarDescanso: async () => {} },
  haptica: { pulso: () => false, disponible: () => false },
  efimero: {
    leer: async (clave) => (efimera.has(clave) ? efimera.get(clave) : null),
    guardar: async (clave, valor) => {
      efimera.set(clave, valor);
    },
    borrar: async (clave) => {
      efimera.delete(clave);
    },
  },
  almacenamiento: {
    leer: async (clave) => (memoria.has(clave) ? memoria.get(clave) : null),
    guardar: async (clave, valor) => {
      memoria.set(clave, valor);
    },
    borrar: async (clave) => {
      memoria.delete(clave);
    },
  },
};
