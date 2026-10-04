// El almacenamiento del aparato, en memoria, para las pruebas. Asíncrono como
// el de verdad (AsyncStorage en el teléfono, localStorage envuelto en la web).
// `memoria` se exporta para que la prueba pueda dejarla como la deja cada app.
export const memoria = new Map();

export const plataforma = {
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
