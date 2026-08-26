import type { Plataforma } from './tipos';
import { almacenamientoWeb, efimeroWeb } from './web/almacenamiento';
import { ubicacionWeb } from './web/ubicacion';

// El único lugar que decide qué implementación corre. Al pasar a Expo se
// agrega `nativo/` y se cambia acá; ni un componente se entera.
export const plataforma: Plataforma = {
  almacenamiento: almacenamientoWeb,
  efimero: efimeroWeb,
  ubicacion: ubicacionWeb,
};

export type { Almacenamiento, Plataforma, PuntoMedido, Ubicacion } from './tipos';
