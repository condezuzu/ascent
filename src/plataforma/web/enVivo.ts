import type { EnVivo } from '@nucleo/plataforma';

// LA PANTALLA DE BLOQUEO NO EXISTE PARA EL NAVEGADOR, y no es que la API sea
// peor: no hay ninguna. Con la pantalla apagada, los temporizadores de una
// pestaña escondida se estrangulan a uno por minuto y después se congelan, así
// que ni siquiera se podría contar el tiempo, mucho menos dibujarlo afuera.
//
// El descanso de la web ya avisa como puede —la pantalla del descanso vibra y
// suena con la app adelante— y esto queda vacío hasta la app del teléfono
// (§13d).
export const enVivoWeb: EnVivo = {
  disponible() {
    return false;
  },
  async mostrarDescanso() {},
  async esconder() {},
};
