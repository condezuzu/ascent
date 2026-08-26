'use client';

import { useState } from 'react';
import { crearCliente } from '@/lib/supabase/client';
import { plataforma } from '@/plataforma';
import type { Perfil } from '@/lib/tipos';
import { T } from '@/textos';

/**
 * El punto del gimnasio, para que el día se registre solo (§13).
 *
 * En web el alcance es: si abrís la app estando ahí, el día entra sin apretar
 * nada. El registro automático de verdad —que el teléfono despierte a la app
 * al llegar— es geofencing del sistema y llega con la versión nativa.
 *
 * Dos reglas de §13 que se ven en el diseño de esta pantalla:
 *  - **Solo se marca ESTANDO en el gimnasio.** Un punto puesto desde el sillón
 *    de casa es peor que no tener punto: registra días que no ocurrieron. Por
 *    eso el botón dice dónde hay que estar y no hay forma de escribir
 *    coordenadas a mano.
 *  - **El registro a mano nunca desaparece.** Esto es un atajo, no el camino.
 */
export default function Gimnasio({
  perfil,
  alCambiar,
}: {
  perfil: Perfil;
  alCambiar: (parcial: Partial<Perfil>) => void;
}) {
  const [supabase] = useState(() => crearCliente());
  const [estado, setEstado] = useState<'' | 'buscando' | 'listo' | 'error'>('');
  const [detalle, setDetalle] = useState('');

  const puesto = perfil.gimnasio_lat !== null && perfil.gimnasio_lat !== undefined;

  async function marcar() {
    setEstado('buscando');
    setDetalle('');

    if (!plataforma.ubicacion.disponible()) {
      setEstado('error');
      return setDetalle(T.ajustes.gimnasioSinGps);
    }

    const punto = await plataforma.ubicacion.puntoActual();
    if (!punto) {
      setEstado('error');
      // No se distingue "denegó" de "no hay señal" a propósito: el navegador
      // tampoco lo dice, e inventar el motivo manda a la persona a resolver el
      // problema equivocado.
      return setDetalle(T.ajustes.gimnasioSinPermiso);
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        gimnasio_lat: Number(punto.lat.toFixed(6)),
        gimnasio_lon: Number(punto.lon.toFixed(6)),
      })
      .eq('id', perfil.id);

    if (error) {
      setEstado('error');
      return setDetalle(T.general.noSePudo);
    }
    alCambiar({ gimnasio_lat: punto.lat, gimnasio_lon: punto.lon });
    setEstado('listo');
    // La precisión se muestra porque cambia lo que se puede esperar: con 200
    // metros de error el atajo va a fallar, y es mejor saberlo ahora.
    setDetalle(T.ajustes.gimnasioListo(Math.round(punto.precision)));
  }

  async function borrar() {
    const { error } = await supabase
      .from('profiles')
      .update({ gimnasio_lat: null, gimnasio_lon: null })
      .eq('id', perfil.id);
    if (error) return;
    alCambiar({ gimnasio_lat: null, gimnasio_lon: null });
    setEstado('');
    setDetalle('');
  }

  return (
    <div className="seccion">
      <h3>{T.ajustes.gimnasio}</h3>

      <button className="boton-fantasma" onClick={marcar} disabled={estado === 'buscando'}>
        {estado === 'buscando'
          ? T.ajustes.gimnasioBuscando
          : puesto
            ? T.ajustes.gimnasioRemarcar
            : T.ajustes.gimnasioMarcar}
      </button>

      <p className="nota-privada">
        <strong>{T.ajustes.gimnasioComo}</strong> {T.ajustes.gimnasioParaQue}
      </p>

      {detalle && <p className="nota-privada">{detalle}</p>}

      {puesto && (
        <>
          <p className="nota-privada">{T.ajustes.gimnasioPuesto}</p>
          <button className="boton-fantasma" onClick={borrar}>
            {T.ajustes.gimnasioBorrar}
          </button>
        </>
      )}
    </div>
  );
}
