import type { Plataforma } from './tipos';
import { almacenamientoWeb, efimeroWeb } from './web/almacenamiento';
import { audioWeb } from './web/audio';
import { avisosWeb } from './web/avisos';
import { hapticaWeb } from './web/haptica';
import { pantallaWeb } from './web/pantalla';
import { saludWeb } from './web/salud';
import { ubicacionWeb } from './web/ubicacion';

// El único lugar que decide qué implementación corre. Al pasar a Expo se
// agrega `nativo/` y se cambia acá; ni un componente se entera.
export const plataforma: Plataforma = {
  almacenamiento: almacenamientoWeb,
  efimero: efimeroWeb,
  ubicacion: ubicacionWeb,
  audio: audioWeb,
  salud: saludWeb,
  avisos: avisosWeb,
  haptica: hapticaWeb,
  pantalla: pantallaWeb,
};

export type {
  Almacenamiento,
  Audio,
  Avisos,
  Haptica,
  Pantalla,
  Plataforma,
  PuntoMedido,
  Salud,
  Ubicacion,
} from './tipos';
