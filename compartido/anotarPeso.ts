import { plataforma } from '@plataforma';

/**
 * Si se muestra el campo de peso al entrenar. Es de ESTE aparato, como el
 * fondo: el que no quiere anotar nada lo apaga una vez y no lo vuelve a ver.
 *
 * Prendido por omisión, porque el campo vacío no pide nada: no se escribe, no
 * pasa nada, y la app funciona igual (regla 4 de `nucleo/bloques.ts`).
 */
const CLAVE = 'ascent:anotar-peso';

export async function leerAnotarPeso(): Promise<boolean> {
  return (await plataforma.almacenamiento.leer(CLAVE)) !== 'no';
}

export function guardarAnotarPeso(si: boolean) {
  return plataforma.almacenamiento.guardar(CLAVE, si ? 'si' : 'no');
}
