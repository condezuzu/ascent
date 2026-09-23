import type { Volumen } from '@nucleo/plataforma';

// El navegador NO VE LAS TECLAS FÍSICAS del aparato, y a diferencia del hueco
// de Health este no espera ninguna API: subir el volumen del teléfono no es un
// evento de la página y no lo va a ser. Es de lo poco que solo se gana al ser
// una app de verdad (§13f).
//
// `disponible()` en `false` es lo que hace que la pantalla de la sesión no
// prometa un atajo que en web no existe.
export const volumenWeb: Volumen = {
  disponible() {
    return false;
  },
  escucharTeclas(_alApretar) {
    return () => {};
  },
};
