import type { Plataforma } from '@nucleo/plataforma';
import { almacenamientoNativo, efimeroNativo } from './almacenamiento';
import { audioNativo } from './audio';
import { avisosNativos } from './avisos';
import { cicloNativo } from './ciclo';
import { hapticaNativa } from './haptica';
import { pantallaNativa } from './pantalla';
import { saludNativa } from './salud';
import { ubicacionNativa } from './ubicacion';

/**
 * LOS NUEVE PUERTOS, del lado nativo.
 *
 * El espejo de `src/plataforma/index.ts`: la misma forma, las mismas nueve
 * llaves, otra implementación. El contrato vive en `nucleo/plataforma.ts`, que
 * es de las dos apps y de ninguna, así que TypeScript no deja que una de las
 * dos se olvide de un puerto o le cambie la firma.
 *
 * QUÉ CAMBIA DE VERDAD al pasar de un archivo al otro, en una línea cada uno:
 *
 * - `avisos`: de un `setTimeout` con la app adelante a una notificación que
 *   llega con la pantalla bloqueada. Es la mitad de la razón de migrar.
 * - `haptica`: de "en iPhone no existe" a un golpe corto. La otra mitad.
 * - `ubicacion`: de "abrí la app en el gimnasio" a que el teléfono despierte
 *   a la app al llegar.
 * - `audio`: de rogarle a la Audio Session API del navegador a declarar la
 *   categoría de verdad y sonar con el switch de silencio puesto.
 * - `almacenamiento`: de `localStorage` a AsyncStorage — el único que ya era
 *   asíncrono en web, justamente para que este día no cambiara ninguna firma.
 * - `salud`: sigue vacío, y ahora por otro motivo (ver `salud.ts`).
 * - `ciclo`, `pantalla`, `efimero`: lo mismo con otras palabras.
 */
export const plataformaNativa: Plataforma = {
  almacenamiento: almacenamientoNativo,
  ciclo: cicloNativo,
  efimero: efimeroNativo,
  ubicacion: ubicacionNativa,
  audio: audioNativo,
  salud: saludNativa,
  avisos: avisosNativos,
  haptica: hapticaNativa,
  pantalla: pantallaNativa,
};
