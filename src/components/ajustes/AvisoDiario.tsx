'use client';

import { useEffect, useState } from 'react';
import { crearCliente } from '@/lib/supabase/client';
import { plataforma } from '@/plataforma';
import type { EstadoAvisoRemoto } from '@nucleo/plataforma';
import { T } from '@nucleo/textos';
import { useVersionDelEsquema } from '@compartido/esquema';
import { disponible } from '@nucleo/esquema';

/**
 * EL AVISO DE LAS 20:30: prenderlo y apagarlo en ESTE teléfono.
 *
 * ES DEL APARATO Y NO DE LA CUENTA, como el fondo: el aviso le llega a un
 * teléfono en particular, y el mismo usuario puede quererlo en el teléfono y
 * no en la computadora.
 *
 * EL PERMISO SE PIDE AL TOCAR "AVISARME", nunca antes. iOS no muestra el pedido
 * si no viene de un toque, y un permiso que se pide al abrir Ajustes gasta la
 * única vez que la persona va a decir que sí en un momento en que no sabe para
 * qué es.
 *
 * APARECE CUANDO SE SABE QUE LA BASE LO SOPORTA, y eso va contra otra regla de
 * `spec/trampas.md` —dibujar desde el primer cuadro para no empujar lo de
 * abajo—. Ganó esta: un botón que prende algo que la base no puede guardar
 * miente, y un bloque que aparece medio segundo tarde solo molesta. Sin señal
 * se usa la última versión que se supo, así que no desaparece en el gimnasio.
 */
export default function AvisoDiario() {
  const [supabase] = useState(() => crearCliente());
  const [estado, setEstado] = useState<EstadoAvisoRemoto | null>(null);
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState('');
  const version = useVersionDelEsquema();

  useEffect(() => {
    plataforma.avisos.remotos.estado().then(setEstado).catch(() => setEstado('no-disponible'));
  }, []);

  async function prender() {
    // También acá y no solo al dibujar: un toque que llegue antes de saber la
    // versión no puede guardar en una tabla que quizás no existe.
    if (!disponible('avisoDiario', version)) return;
    const clave = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    setError('');
    if (!clave) {
      // Sin la clave el servidor no va a poder mandar nada: se dice en vez de
      // prender algo que nunca va a sonar.
      setError(T.avisoDiario.noSePudo);
      return;
    }
    setTrabajando(true);
    try {
      const sub = await plataforma.avisos.remotos.activar(clave);
      if (!sub) {
        // `null` casi siempre es un permiso negado: el estado nuevo lo dice
        // mejor que un mensaje de error.
        setEstado(await plataforma.avisos.remotos.estado());
        return;
      }
      const { error: e } = await supabase.rpc('guardar_suscripcion_push', {
        p_endpoint: sub.endpoint,
        p_p256dh: sub.p256dh,
        p_auth: sub.auth,
      });
      if (e) {
        // La base no la guardó: se da de baja también en el aparato, o quedaría
        // "prendido" algo a lo que el servidor nunca le va a mandar nada.
        await plataforma.avisos.remotos.desactivar();
        setError(T.avisoDiario.noSePudo);
        setEstado('apagado');
        return;
      }
      setEstado('activo');
    } catch {
      setError(T.avisoDiario.noSePudo);
    } finally {
      setTrabajando(false);
    }
  }

  async function apagar() {
    if (!disponible('avisoDiario', version)) return;
    setTrabajando(true);
    setError('');
    try {
      const endpoint = await plataforma.avisos.remotos.desactivar();
      if (endpoint) await supabase.rpc('borrar_suscripcion_push', { p_endpoint: endpoint });
      setEstado('apagado');
    } finally {
      setTrabajando(false);
    }
  }

  // Sin la migración 35 no hay dónde guardar la suscripción: el botón
  // prendería algo que el servidor nunca va a ver.
  if (!disponible('avisoDiario', version)) return null;

  return (
    <div className="seccion">
      <h3>{T.avisoDiario.rotulo}</h3>
      <p className="nota-privada" style={{ marginTop: 0 }}>
        {T.avisoDiario.nota}
      </p>

      {(estado === 'apagado' || estado === 'activo') && (
        <div className="selector-vista">
          <button
            className={estado === 'activo' ? 'activo' : ''}
            onClick={estado === 'activo' ? undefined : prender}
            disabled={trabajando}
          >
            {T.avisoDiario.prender}
          </button>
          <button
            className={estado === 'apagado' ? 'activo' : ''}
            onClick={estado === 'apagado' ? undefined : apagar}
            disabled={trabajando}
          >
            {T.avisoDiario.apagar}
          </button>
        </div>
      )}

      {estado === 'activo' && <p className="nota-privada">{T.avisoDiario.prendido}</p>}
      {estado === 'hay-que-instalar' && <p className="nota-privada">{T.avisoDiario.hayQueInstalar}</p>}
      {estado === 'bloqueado' && <p className="nota-privada">{T.avisoDiario.bloqueado}</p>}
      {estado === 'no-disponible' && <p className="nota-privada">{T.avisoDiario.noDisponible}</p>}
      {error && <p className="error-msg">{error}</p>}
    </div>
  );
}
