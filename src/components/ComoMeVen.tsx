'use client';

import { useState } from 'react';
import { fechaLinda, enDias } from '@nucleo/fechas';
import type { Log, UsuarioPublico } from '@nucleo/tipos';
import TiraSemanal from '@/components/TiraSemanal';
import Insignia from '@/components/Insignia';
import Avatar from '@/components/Avatar';
import { T } from '@nucleo/textos';
import { useEsperar } from '@/components/PantallaDeslizable';

/** `miniatura`: la misma foto achicada para la grilla (ver `compartido/album.ts`). */
export type FotoVisible = { id: string; url: string; miniatura?: string; fecha: string | null };

// Cuántas cosas ve un amigo. Los mismos números que usa el perfil ajeno, en un
// solo lugar: si el modo "ver como lo ven los demás" mostrara más días o más
// fotos que la pantalla real, estaría mintiendo justo donde tiene que ser
// exacto.
export const DIAS_VISIBLES = 7;
export const FOTOS_VISIBLES = 9;

/**
 * Todo —y solo— lo que un amigo ve de alguien: quién es, su última semana y
 * las fotos que decidió compartir. Nunca el peso, nunca los días de descanso
 * (son configuración privada), nunca las fotos marcadas "solo vos".
 *
 * Lo usan las DOS pantallas que muestran esto: el perfil de un amigo y el
 * modo "ver como lo ven los demás" del perfil propio. Compartir el componente
 * es el punto: si se separaran, la vista previa iría quedando vieja y le
 * estaría diciendo al usuario que comparte algo distinto de lo que comparte.
 *
 * `children` cae entre la semana y las fotos, que es donde el perfil de un
 * amigo mete el reto.
 */
export default function ComoMeVen({
  usuario,
  logs,
  fotos,
  children,
}: {
  usuario: UsuarioPublico;
  logs: Log[];
  fotos: FotoVisible[];
  children?: React.ReactNode;
}) {
  return (
    <>
      <div className="cabecera" style={{ marginBottom: 22 }}>
        <Avatar url={usuario.avatar_url} nombre={usuario.username} tam={52} />
        <div>
          <div className="nombre" style={{ fontSize: 18 }}>
            {usuario.username}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
            <Insignia rango={usuario.rango_actual} tam={16} />
            <span style={{ fontSize: 13, color: 'var(--sub)' }}>
              {T.stats.rachaDe(enDias(usuario.racha_actual))}
            </span>
          </div>
        </div>
      </div>

      {/* de un amigo no se ven sus descansos: son configuración privada */}
      <TiraSemanal logs={logs} descansos={[]} />

      {children}

      <FotosQueVen fotos={fotos} />
    </>
  );
}

/**
 * LAS FOTOS COMO LAS VE UN AMIGO, y nada más: sin tocar, sin administrar.
 * Aparte desde el 19/9 porque el perfil PROPIO muestra exactamente esto —"igual
 * que las ven ellos"— y compartir el componente es lo que lo garantiza.
 *
 * La pantalla no aparece hasta que cargaron todas (son nueve como mucho, en
 * miniatura): antes se veían los cuadrados vacíos y las fotos caían de a una.
 * Una que no carga cuenta como lista: no puede frenar a las demás.
 */
export function FotosQueVen({ fotos }: { fotos: FotoVisible[] }) {
  const [listas, setListas] = useState<Set<string>>(() => new Set());
  useEsperar(fotos.every((f) => !f.url || listas.has(f.id)));
  const lista = (id: string) => setListas((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  if (fotos.length === 0) return null;
  return (
    <div className="seccion">
      <h3>{T.general.fotos}</h3>
      <div className="album-grilla">
        {fotos.map((f) => (
          <div className="album-pieza" key={f.id}>
            <div className="album-celda">
              {f.url && (
                // <img> y no next/image: son URLs firmadas de Supabase que vencen en una hora, y el optimizador las cachearia vencidas.
                <img src={f.miniatura || f.url} alt="" onLoad={() => lista(f.id)} onError={() => lista(f.id)} />
              )}
            </div>
            {f.fecha && (
              <div className="album-pie">
                <span>{fechaLinda(f.fecha)}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
