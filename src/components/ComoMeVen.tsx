'use client';

import { fechaLinda, enDias } from '@/lib/fechas';
import type { Log, UsuarioPublico } from '@/lib/tipos';
import TiraSemanal from '@/components/TiraSemanal';
import Insignia from '@/components/Insignia';
import Avatar from '@/components/Avatar';
import { T } from '@/textos';

export type FotoVisible = { id: string; url: string; fecha: string | null };

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

      {fotos.length > 0 && (
        <div className="seccion">
          <h3>{T.general.fotos}</h3>
          <div className="album-grilla">
            {fotos.map((f) => (
              <div className="album-pieza" key={f.id}>
                <div className="album-celda">
                  {f.url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={f.url} alt="" loading="lazy" />
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
      )}
    </>
  );
}
