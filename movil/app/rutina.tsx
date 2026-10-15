import PantallaRutina from '../src/PantallaRutina';
import DesenfoqueDeVuelta from '../src/DesenfoqueDeVuelta';

/** `/rutina` — tu rutina, apilada encima de las pestañas. Se entra desde Inicio. */
export default function Pantalla() {
  return (
    <DesenfoqueDeVuelta>
      <PantallaRutina />
    </DesenfoqueDeVuelta>
  );
}
