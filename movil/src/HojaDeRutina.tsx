import { useState } from 'react';
import Hoja from './Hoja';
import MiRutina from './MiRutina';
import { nuevaEnCadaApertura } from './hojaNueva';

/**
 * LA RUTINA EN MEDIO DEL ENTRENAMIENTO (21/11, a pedido): el editor de Stats, abierto en el día de hoy, en una hoja
 * encima de la sesión. Cada cambio se guarda al tocarlo y la sesión lo toma (ver `releerLaRutina` en useSesion).
 */
function HojaDeRutina({ visible, alCerrar }: { visible: boolean; alCerrar: () => void }) {
  // Mientras se arrastra un ejercicio para ordenarlo, la hoja no se desplaza.
  const [arrastrando, setArrastrando] = useState(false);
  return (
    <Hoja visible={visible} alCerrar={alCerrar} desplazable={!arrastrando}>
      <MiRutina visible={visible} abrirHoy alArrastrar={setArrastrando} />
    </Hoja>
  );
}

export default nuevaEnCadaApertura(HojaDeRutina, (p) => p.visible);
