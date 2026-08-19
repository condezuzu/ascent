'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { crearCliente } from '@/lib/supabase/client';
import { fechaDeMarca, pesoLindo, redondear } from '@/lib/fuerza';
import type { Unidad } from '@/lib/peso';
import type { FilaFuerza, MiFuerza } from '@/lib/tipos';
import Avatar from '@/components/Avatar';

type Percentil = { percentil: number | null; gente: number };

/**
 * La fuerza dentro de Stats (§16.6): acá se mira y se compara, en `/fuerza` se
 * carga. Es el lugar donde ya vive todo lo analítico y donde el usuario entra
 * a buscar datos, en vez de encontrárselos.
 */
export default function SeccionFuerza({ unidad }: { unidad: Unidad }) {
  const [supabase] = useState(() => crearCliente());
  const [mia, setMia] = useState<MiFuerza | null>(null);
  const [ranking, setRanking] = useState<FilaFuerza[]>([]);
  const [percentil, setPercentil] = useState<Percentil | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [yo, setYo] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setYo(user.id);
      const [{ data: f }, { data: r }, { data: p }] = await Promise.all([
        supabase.rpc('mi_fuerza'),
        supabase.rpc('ranking_fuerza'),
        supabase.rpc('percentil_fuerza'),
      ]);
      setMia((f ?? null) as MiFuerza | null);
      setRanking((r ?? []) as FilaFuerza[]);
      setPercentil((p ?? null) as Percentil | null);
    })();
  }, [supabase]);

  // Mientras la base no tenga la migración, mi_fuerza no existe y esto queda
  // en nada. Preferible a una sección rota en medio de Stats.
  if (!mia) return null;

  const sinNada = mia.marcas.length === 0;

  return (
    <div className="seccion">
      <h3>Fuerza</h3>

      {sinNada ? (
        <div className="tarjeta">
          <p style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--sub)' }}>
            Sentadilla, press de banca y peso muerto arman un número comparable con el de tus
            amigos, pese lo que pese cada uno.
          </p>
          <Link href="/fuerza" className="boton-fantasma" style={{ marginTop: 12 }}>
            Cargar mis marcas
          </Link>
        </div>
      ) : (
        <>
          <div className="tarjeta dots-tarjeta">
            {mia.dots !== null ? (
              <>
                <div className="dots-numero">{redondear(mia.dots)}</div>
                <div className="dots-pie">
                  DOTS · {mia.total !== null && pesoLindo(mia.total, unidad)} de total
                </div>
                {/* El exacto es SOLO del dueño (§16.7b). Decirlo acá es lo que
                    hace que la banda de los demás no parezca un error. */}
                <p className="nota-privada">
                  Este número lo ves solo vos. Tus amigos ven la banda: {mia.banda}.
                </p>
                {percentil?.percentil != null && (
                  <p className="nota-privada">
                    Estás en el {percentil.percentil}% más fuerte de Ascent.
                  </p>
                )}
              </>
            ) : (
              <p style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--sub)' }}>
                {mia.falta === 'marcas' &&
                  'Faltan marcas: el número sale de las tres —sentadilla, banca y peso muerto—, y con dos no se compara con nada.'}
                {mia.falta === 'sexo' && (
                  <>
                    Para el número falta cargar el sexo en{' '}
                    <Link href="/ajustes" className="enlace">
                      Ajustes
                    </Link>
                    . La fórmula usa dos juegos de coeficientes y no se asume ninguno.
                  </>
                )}
                {mia.falta === 'peso' && (
                  <>
                    Falta tu peso corporal, que se anota en{' '}
                    <Link href="/fuerza" className="enlace">
                      Mis marcas
                    </Link>
                    . Solo lo ves vos y nunca se muestra.
                  </>
                )}
              </p>
            )}
          </div>

          <div className="marcas-tira">
            {mia.marcas
              .filter((m) => m.cuenta_dots)
              .map((m) => (
                <div key={m.ejercicio} className="marcas-tira-item">
                  <span className="dato">{pesoLindo(m.kg, unidad)}</span>
                  <span>{m.nombre}</span>
                  {/* la fecha va siempre pegada al número (§16.5) */}
                  <span className="apagado">{fechaDeMarca(m.fecha)}</span>
                </div>
              ))}
          </div>

          {ranking.length > 1 && (
            <>
              <h3 style={{ marginTop: 22 }}>Entre amigos</h3>
              <div className="tarjeta" style={{ padding: 4 }}>
                {ranking.map((f, i) => {
                  const desplegado = abierto === f.id;
                  return (
                    <div key={f.id} className="rank-fila">
                      <button
                        className="rank-cabecera"
                        onClick={() => setAbierto(desplegado ? null : f.id)}
                        aria-expanded={desplegado}
                      >
                        <span className="dato rank-pos">{i + 1}</span>
                        <Avatar url={f.avatar_url} nombre={f.username} tam={30} />
                        <span className="rank-nombre">
                          {f.id === yo ? 'Vos' : f.username}
                        </span>
                        <span className="rank-banda dato">
                          {/* al dueño se le muestra su número; del resto, la banda */}
                          {f.dots_propio != null ? redondear(f.dots_propio) : f.banda}
                        </span>
                      </button>
                      {desplegado && (
                        <div className="rank-detalle">
                          {f.marcas.map((m) => (
                            <div key={m.ejercicio}>
                              <span>{m.nombre}</span>
                              <span className="dato">{pesoLindo(m.kg, unidad)}</span>
                              <span className="apagado">{fechaDeMarca(m.fecha)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          <Link href="/fuerza" className="boton-fantasma" style={{ marginTop: 12 }}>
            Mis marcas
          </Link>
        </>
      )}
    </div>
  );
}
