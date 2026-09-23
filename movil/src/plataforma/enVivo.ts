import type { EnVivo } from '@nucleo/plataforma';
import { descansoVivoNativo } from '../../modules/descanso-vivo';

/**
 * LA CUENTA DEL DESCANSO EN LA PANTALLA BLOQUEADA (§13d) — el lado nativo.
 *
 * Casi no hay nada acá, y está bien: lo que hace el trabajo es
 * `modules/descanso-vivo` (ActivityKit) y el widget de `targets/descanso`
 * (SwiftUI). Esto es solo la ventanilla por la que el resto de la app pide las
 * cosas sin enterarse de ninguna de las dos.
 *
 * EL MÓDULO PUEDE NO ESTAR, y hay que contar con eso: en la vista web —donde
 * corren las pruebas— no existe, y en cualquier build anterior a la que lo
 * trajo tampoco. Por eso llega como `null` en vez de tirar, y acá se lee como
 * "no se puede", que es exactamente la misma respuesta que da la web.
 *
 * Y NADA TIRA. El descanso tiene que andar idéntico sin esto: si el usuario
 * apagó las Live Activities en Ajustes, si el sistema no deja encender una más
 * o si el teléfono es viejo, lo único que pasa es que no se ve afuera.
 */
export const enVivoNativo: EnVivo = {
  disponible() {
    try {
      return descansoVivoNativo?.disponible() ?? false;
    } catch {
      return false;
    }
  },

  async mostrarDescanso(fin, duracion, ctx) {
    try {
      await descansoVivoNativo?.mostrar(
        fin,
        duracion,
        ctx?.ejercicio ?? '',
        ctx?.serie ?? 0,
        ctx?.meta ?? 0
      );
    } catch {
      // Y SI EL MÓDULO ES EL VIEJO, SE LLAMA COMO ANTES (25/9).
      //
      // El ejercicio y la serie llegaron en la misma tanda que la build de la
      // tienda, así que hay un rato en el que este JavaScript —que viaja por el
      // aire— convive con el módulo nativo de la build anterior, que recibe dos
      // argumentos y no cinco. Expo valida la cantidad y tira.
      //
      // Sin esto, ese rato se quedaba sin cuenta en la pantalla bloqueada: la
      // función que la enciende fallaba en silencio, que es lo que este `catch`
      // hace a propósito para todo lo demás. Un reintento con la firma vieja
      // cuesta nada y lo evita.
      try {
        await (descansoVivoNativo as unknown as {
          mostrar(fin: number, duracion: number): Promise<void>;
        } | null)?.mostrar(fin, duracion);
      } catch {
        /* que no se vea afuera no puede romper el descanso */
      }
    }
  },

  async esconder() {
    try {
      await descansoVivoNativo?.esconder();
    } catch {
      /* ídem */
    }
  },
};
