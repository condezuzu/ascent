import Pestanas from '../src/Pestanas';
import { useSesionDeLaApp } from '../src/sesionDeLaApp';

/**
 * LA PANTALLA DE LAS PESTAÑAS, que es la app entera menos lo que se apila
 * encima.
 *
 * ES UN ARCHIVO DE CUATRO LÍNEAS A PROPÓSITO. Las cinco pestañas, el gesto de
 * deslizar y el motor siguen viviendo adentro de `Pestanas`, sin enterarse de
 * que ahora hay un router. La alternativa —una ruta por pestaña, con el layout
 * de tabs de Expo Router— obligaría a montar y tumbar el motor en cada cambio
 * de pestaña y a reescribir el asomo del gesto con otra biblioteca, para
 * conseguir lo mismo que ya funciona.
 *
 * El router sirve para lo que las pestañas no podían: apilar el perfil encima,
 * volver con el gesto del sistema, y algún día abrirse en un perfil desde un
 * enlace.
 */
export default function Pantalla() {
  const { salir, sinNombre } = useSesionDeLaApp();
  return <Pestanas alSalir={salir} alFaltarNombre={sinNombre} />;
}
