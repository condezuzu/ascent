'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { crearCliente } from '@/lib/supabase/client';
import { miUsuario } from '@/lib/supabase/quienSoy';
import { fechaDeMarca, pesoLindo, redondear } from '@nucleo/fuerza';
import type { Unidad } from '@nucleo/peso';
import type { FilaFuerza, MiFuerza } from '@nucleo/tipos';
import Avatar from '@/components/Avatar';
import {
  esEjercicioEstandar,
  esSexoEstandar,
  FUENTE,
  muestraFina,
  ubicar,
  type SexoEstandar,
} from '@nucleo/estandares';
import { T } from '@nucleo/textos';

/**
 * La fuerza dentro de Stats (§16.6): acá se mira y se compara, en `/fuerza` se
 * carga. Es el lugar donde ya vive todo lo analítico y donde el usuario entra
 * a buscar datos, en vez de encontrárselos.
 */
export default function SeccionFuerza({
  unidad,
  sexo,
  pesoCorporal,
}: {
  unidad: Unidad;
  sexo: string | null;
  // El peso corporal más reciente, en KILOS: la tabla está en kilos y la
  // unidad es solo de presentación.
  pesoCorporal: number | null;
}) {
  const [supabase] = useState(() => crearCliente());
  const [mia, setMia] = useState<MiFuerza | null>(null);
  const [ranking, setRanking] = useState<FilaFuerza[]>([]);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [yo, setYo] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const user = await miUsuario(supabase);
      if (!user) return;
      setYo(user.id);
      const [{ data: f }, { data: r }] = await Promise.all([
        supabase.rpc('mi_fuerza'),
        supabase.rpc('ranking_fuerza'),
      ]);
      setMia((f ?? null) as MiFuerza | null);
      setRanking((r ?? []) as FilaFuerza[]);
    })();
  }, [supabase]);

  // Mientras la base no tenga la migración, mi_fuerza no existe y esto queda
  // en nada. Preferible a una sección rota en medio de Stats.
  if (!mia) return null;

  const sinNada = mia.marcas.length === 0;

  return (
    <div className="seccion">
      <h3>{T.fuerza.titulo}</h3>

      {sinNada ? (
        <div className="tarjeta">
          <p style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--sub)' }}>
            {T.fuerza.sinNada}
          </p>
          <Link href="/fuerza" className="boton-fantasma" style={{ marginTop: 12 }}>
            {T.fuerza.anotarMarca}
          </Link>
        </div>
      ) : (
        <>
          <div className="contenida dots-tarjeta">
            {mia.dots !== null ? (
              <>
                <div className="dots-numero">{redondear(mia.dots)}</div>
                <div className="dots-pie">
                  DOTS · {mia.total !== null && pesoLindo(mia.total, unidad)} de total
                </div>
                {/* Desde la migración 28 el número exacto lo ven los amigos.
                    Se dice acá y no solo al activarlo: quien ya lo tenía
                    activado con la regla vieja tiene que enterarse. */}
                <p className="nota-privada">{T.fuerza.loVenTusAmigos}</p>
              </>
            ) : (
              <p style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--sub)' }}>
                {mia.falta === 'marcas' && T.fuerza.faltanMarcasCorto}
                {mia.falta === 'sexo' && (
                  <>
                    {T.fuerza.faltaSexo}{' '}
                    <Link href="/ajustes" className="enlace">
                      {T.general.ajustes}
                    </Link>
                    {T.fuerza.faltaSexoFin}
                  </>
                )}
                {mia.falta === 'peso' && (
                  <>
                    {T.fuerza.faltaPesoEnMarcas}{' '}
                    <Link href="/fuerza" className="enlace">
                      {T.fuerza.misMarcas}
                    </Link>
                    {T.fuerza.faltaPesoEnMarcasFin}
                  </>
                )}
              </p>
            )}
          </div>

          {esSexoEstandar(sexo) && pesoCorporal !== null && (
            <DondeEstoy
              sexo={sexo}
              pesoCorporal={pesoCorporal}
              marcas={mia.marcas}
              unidad={unidad}
            />
          )}

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
                          {f.id === yo ? T.social.vos : f.username}
                        </span>
                        <span className="rank-banda dato">
                          {/* El mismo número para todos: ya no hay una versión
                              para el dueño y otra para el resto (§16.7b). */}
                          {redondear(f.dots)}
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
            {T.fuerza.misMarcas}
          </Link>
        </>
      )}
    </div>
  );
}

/**
 * Dónde caigo entre la gente de mi sexo y mi peso corporal (§16.8).
 *
 * Contra una tabla que viene en el repo y no contra los usuarios de Ascent:
 * así el número sirve desde el primer día y no depende de que la app crezca.
 * Quién es esa gente y de cuándo son los datos está en Ajustes, porque contra
 * quién se compara cambia el resultado entero.
 *
 * SOLO POR EJERCICIO. El total no lleva categoría: sumar los umbrales de los
 * tres no da el umbral del total, y en las colas se rompe (ver `estandares.ts`
 * y spec/trampas.md). Para el total ya está el DOTS, ahí arriba. Y por
 * ejercicio es además lo accionable: "top 25% en peso muerto" dice qué
 * entrenar, un agregado no.
 *
 * La CATEGORÍA va primero y más grande que el porcentaje: es el dato que
 * publica la fuente, mientras que el porcentaje lo interpolamos nosotros.
 */
function DondeEstoy({
  sexo,
  pesoCorporal,
  marcas,
  unidad,
}: {
  sexo: SexoEstandar;
  pesoCorporal: number;
  marcas: MiFuerza['marcas'];
  unidad: Unidad;
}) {
  const filas = marcas
    .filter((m) => esEjercicioEstandar(m.ejercicio))
    .map((m) => ({
      ejercicio: m.ejercicio,
      nombre: m.nombre,
      u: ubicar(m.ejercicio as Parameters<typeof ubicar>[0], sexo, pesoCorporal, m.kg),
    }));

  if (filas.length === 0) return null;

  return (
    <div className="donde-estoy">
      <div className="donde-titulo">{T.fuerza.dondeEstoy}</div>

      <div className="donde-lista">
        {filas.map((f) => (
          <div key={f.ejercicio} className="donde-fila">
            <div className="donde-fila-datos">
              <span className="nombre">{f.nombre}</span>
              <span className="cat">{f.u.categoria}</span>
              <span className="dato pct">
                {f.u.faltaParaPrincipiante === null ? `${f.u.supera}%` : ''}
              </span>
            </div>
            {/* La escala crece hacia la derecha y la marca cae donde cae. */}
            <div className="donde-escala" aria-hidden>
              <i style={{ left: `${f.u.supera}%` }} />
            </div>
            {f.u.faltaParaPrincipiante !== null && (
              // Sin esto, el que recién empieza ve "Arrancando" y nada más, y
              // ahí no hay ninguna razón para volver. La distancia motiva sin
              // inventar una categoría que la fuente no nombra.
              <div className="donde-falta">
                {f.u.faltaParaPrincipiante === 1
                  ? T.fuerza.faltaParaUno(pesoLindo(f.u.faltaParaPrincipiante, unidad))
                  : T.fuerza.faltaPara(pesoLindo(f.u.faltaParaPrincipiante, unidad))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* El aviso no es decorativo: con una muestra diez veces más chica, el
          mismo número no está igual de firme, y presentarlos igual sería
          darle a uno una precisión que no tiene. */}
      {muestraFina(sexo) && (
        <p className="nota-privada">{T.fuerza.muestraFina}</p>
      )}
      {filas.some((f) => f.u.fueraDeTabla) && (
        <p className="nota-privada">{T.fuerza.fueraDeTabla}</p>
      )}
      {/* Antes decía "Strength Level 2026 · gente que anota en apps, no
          competidores": exacto y sin significado para quien lo lee. Nombraba
          una fuente que nadie conoce y definía la población por lo que NO es.
          El detalle de contra quién se compara vive en Ajustes. */}
      <p className="nota-privada">
        {T.fuerza.contraQuien}{' '}
        <Link href="/ajustes" className="enlace">
          {T.fuerza.verEnAjustes}
        </Link>
      </p>
    </div>
  );
}
