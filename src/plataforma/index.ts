import type { Plataforma } from './tipos';
import { almacenamientoWeb, efimeroWeb } from './web/almacenamiento';
import { audioWeb } from './web/audio';
import { ubicacionWeb } from './web/ubicacion';

// El único lugar que decide qué implementación corre. Al pasar a Expo se
// agrega `nativo/` y se cambia acá; ni un componente se entera.
export const plataforma: Plataforma = {
  almacenamiento: almacenamientoWeb,
  efimero: efimeroWeb,
  ubicacion: ubicacionWeb,
  audio: audioWeb,
};

export type { Almacenamiento, Audio, Plataforma, PuntoMedido, Ubicacion } from './tipos';
