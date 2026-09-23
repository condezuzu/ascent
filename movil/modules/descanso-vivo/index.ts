import { requireOptionalNativeModule } from 'expo';

/**
 * EL MÓDULO NATIVO DE LA LIVE ACTIVITY, visto desde JavaScript.
 *
 * `requireOptionalNativeModule` Y NO `requireNativeModule`: la diferencia es
 * si la app se abre. Este módulo NO existe en la vista web —donde corren las
 * pruebas— ni en ninguna build anterior a la que lo trajo, y la versión que
 * tira haría que la app muriera al arrancar en las tres. Devolver `null` es
 * exactamente lo que el puerto sabe manejar: es el mismo "acá esto no existe"
 * que contesta la web.
 */
type Nativo = {
  disponible(): boolean;
  /**
   * `ejercicio` viaja como cadena vacía y no como `null`: los opcionales de
   * Swift cruzan el puente de Expo con más filo del que esto necesita, y "sin
   * ejercicio" se dibuja igual de bien preguntando si la cadena está vacía.
   */
  mostrar(finEnMs: number, duracion: number, ejercicio: string, serie: number, meta: number): Promise<void>;
  esconder(): Promise<void>;
};

export const descansoVivoNativo = requireOptionalNativeModule<Nativo>('DescansoVivo');
