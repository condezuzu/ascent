import { leerPerfilCache } from '@compartido/cache';
import { crearSesionCompartida } from '@nucleo/vinculoConMoss';
import { llavero } from './plataforma/llavero';

/**
 * LA SESIÓN QUE ASCENT LE DEJA A MOSS (D27): la regla está en `nucleo/vinculoConMoss.ts`; acá se
 * conecta con el llavero y con el nombre guardado en el teléfono.
 *
 * NO IMPORTA EL CLIENTE DE SUPABASE, a propósito: `alAviso` corre adentro del aviso de auth de la
 * raíz, con el candado del cliente tomado, y cualquier pregunta a Supabase desde ahí es el
 * interbloqueo del gimnasio (ver `app/_layout.tsx`). La sesión ya viene en el aviso.
 *
 * El nombre sale de la copia del perfil, que guarda Inicio. Recién entrado no hay copia (se borra
 * al salir), así que la primera vez se escribe sin nombre y se completa cuando Inicio trae el
 * perfil (`anotarNombre`).
 */
export const sesionCompartida = crearSesionCompartida({
  guardar: (clave, valor) => llavero.guardar(clave, valor),
  borrar: (clave) => llavero.borrar(clave),
  nombreGuardado: async (uid) => (await leerPerfilCache(uid))?.username,
  ahoraSeg: () => Math.floor(Date.now() / 1000),
});
