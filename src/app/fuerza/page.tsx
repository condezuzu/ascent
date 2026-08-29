'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { crearCliente } from '@/lib/supabase/client';
import { miUsuario } from '@/lib/supabase/quienSoy';
import { planetaDeDia } from '@/lib/rangos';
import { esUnidad, type Unidad } from '@/lib/peso';
import { fechaDeMarca, origenDeMarca, pesoLindo } from '@/lib/fuerza';
import type { Ejercicio, MiFuerza, PR, Perfil } from '@/lib/tipos';
import FondoEspacial from '@/components/FondoEspacial';
import Nav from '@/components/Nav';
import CargarMarca from '@/components/CargarMarca';
import AnotarPeso from '@/components/AnotarPeso';
import NoCargo from '@/components/NoCargo';
import { T } from '@/textos';

/**
 * Mis marcas: donde se cargan, se miran y se corrigen (§16).
 *
 * El DOTS, la banda y el ranking NO viven acá sino en Stats: acá se escribe,
 * allá se compara. Lo único que aparece de eso es la línea que dice qué falta
 * para tener DOTS, porque el que está mirando sus marcas es justo el que
 * puede resolverlo.
 */
export default function Fuerza() {
  const router = useRouter();
  const [supabase] = useState(() => crearCliente());
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [ejercicios, setEjercicios] = useState<Ejercicio[]>([]);
  const [fuerza, setFuerza] = useState<MiFuerza | null>(null);
  const [historial, setHistorial] = useState<PR[]>([]);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [cargando, setCargando] = useState<string | null>(null);
  const [hoja, setHoja] = useState<{ abierta: boolean; ejercicio?: string } | null>(null);
  const [noCargo, setNoCargo] = useState(false);

  const cargar = useCallback(async () => {
    const user = await miUsuario(supabase);
    if (!user) return router.push('/login');
    const [{ data: p }, { data: ejs }, { data: f }, { data: prs }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('ejercicios').select('*').order('orden'),
      supabase.rpc('mi_fuerza'),
      supabase
        .from('prs')
        .select('id, ejercicio, peso, reps, es_real, fecha')
        .eq('user_id', user.id)
        .order('fecha', { ascending: false }),
    ]);
    // Sin perfil no se dibuja nada: hay que decirlo y dar por dónde salir, o
    // la pantalla se queda en el armazón para siempre.
    setNoCargo(!p);
    setPerfil(p ?? null);
    setEjercicios((ejs ?? []) as Ejercicio[]);
    setFuerza((f ?? null) as MiFuerza | null);
    setHistorial((prs ?? []) as PR[]);
  }, [supabase, router]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function borrar(id: string) {
    setCargando(id);
    await supabase.from('prs').delete().eq('id', id);
    setCargando(null);
    cargar();
  }

  if (!perfil) {
    return (
      <>
        <FondoEspacial rango={1} vacio esquina="centro" velo={0.7} />
        <div className="pantalla">{noCargo && <NoCargo reintentar={cargar} />}</div>
        <Nav />
      </>
    );
  }

  const unidad: Unidad = esUnidad(perfil.unidad_peso) ? perfil.unidad_peso : 'kg';
  const marcas = fuerza?.marcas ?? [];
  const delDots = marcas.filter((m) => m.cuenta_dots);
  const otras = marcas.filter((m) => !m.cuenta_dots);

  // Una marca cargada NO se pisa con la siguiente: cada carga queda, y la
  // mejor es la que manda. Por eso el historial se puede desplegar (§16.5).
  function filaMarca(m: (typeof marcas)[number]) {
    const previas = historial.filter((h) => h.ejercicio === m.ejercicio);
    const desplegado = abierto === m.ejercicio;
    return (
      <div key={m.ejercicio} className="marca">
        <button
          className="marca-fila"
          onClick={() => setAbierto(desplegado ? null : m.ejercicio)}
          aria-expanded={desplegado}
        >
          <span className="marca-nombre">{m.nombre}</span>
          <span className="marca-kg">{pesoLindo(m.kg, unidad)}</span>
          {/* la fecha va AL LADO del número, no escondida: un PR de hace dos
              años sigue valiendo, pero quien lo mira tiene derecho a saberlo */}
          <span className="marca-fecha">{fechaDeMarca(m.fecha)}</span>
        </button>
        {desplegado && (
          <div className="marca-historial">
            <p className="nota-privada" style={{ marginTop: 0 }}>
              {previas.length === 1
                ? T.fuerza.esLaUnica
                : T.fuerza.cuantasAnotaste(previas.length)}
            </p>
            {previas.map((h) => (
              <div key={h.id} className="marca-previa">
                {/* Primero lo que LEVANTÓ —100 kg × 8—, que es lo que la
                    persona hizo. El máximo calculado va al lado y en chico:
                    es un derivado, no el dato. */}
                <span>
                  {pesoLindo(h.peso, unidad)}
                  {h.reps > 1 && <span className="apagado"> × {h.reps}</span>}
                </span>
                <span className="apagado">{origenDeMarca(h)}</span>
                <span className="apagado">{fechaDeMarca(h.fecha)}</span>
                <button
                  className="boton-texto peligro"
                  style={{ width: 'auto', padding: 4, fontSize: 12 }}
                  onClick={() => borrar(h.id)}
                  disabled={cargando === h.id}
                >
                  {T.general.borrar}
                </button>
              </div>
            ))}
            <button
              className="boton-texto"
              onClick={() => setHoja({ abierta: true, ejercicio: m.ejercicio })}
            >
              {T.fuerza.otraDe(m.nombre.toLowerCase())}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <FondoEspacial
        rango={perfil.rango_actual}
        planeta={planetaDeDia(perfil.racha_actual)}
        esquina="arriba-derecha"
        velo={0.74}
      />
      <div className="pantalla">
        <button
          className="boton-texto"
          style={{ textAlign: 'left', padding: '0 0 10px', width: 'auto' }}
          onClick={() => router.back()}
        >
          {T.general.volver}
        </button>

        <div className="titulo-pantalla">{T.fuerza.misMarcas}</div>

        <button className="boton-solido" onClick={() => setHoja({ abierta: true })}>
          {T.fuerza.anotarMarca}
        </button>

        {marcas.length === 0 ? (
          <div className="vacio-cosmico" style={{ marginTop: 30 }}>
            {T.fuerza.vacioTitulo}
            <br />
            {T.fuerza.vacioPie}
          </div>
        ) : (
          <>
            <div className="seccion" style={{ marginTop: 26 }}>
              <h3>{T.fuerza.lasTresQueCuentan}</h3>
              {delDots.length > 0 ? (
                <div className="tarjeta" style={{ padding: 4 }}>{delDots.map(filaMarca)}</div>
              ) : (
                <p className="nota-privada" style={{ marginTop: 0 }}>
                  {T.fuerza.ningunaCargada}
                </p>
              )}
              {/* El DOTS necesita las TRES. El porqué NO se explica acá: es un
                  párrafo, y un párrafo en la pantalla donde se anotan marcas no lo
                  lee nadie. Vive entero en Ajustes, con un link desde acá. */}
              {fuerza?.falta === 'marcas' && delDots.length > 0 && (
                <p className="nota-privada">
                  {T.fuerza.faltanMarcas(delDots.length)}{' '}
                  <Link href="/ajustes" className="enlace">
                    {T.fuerza.verEnAjustes}
                  </Link>
                </p>
              )}
              {fuerza?.falta === 'sexo' && (
                <p className="nota-privada">
                  {T.fuerza.yaEstanLasTres} {T.fuerza.faltaSexo}{' '}
                  <Link href="/ajustes" className="enlace">
                    {T.general.ajustes}
                  </Link>
                  {T.fuerza.faltaSexoFin}
                </p>
              )}
              {fuerza?.falta === 'peso' && (
                <>
                  <p className="nota-privada">
                    {T.fuerza.yaEstanLasTres} {T.fuerza.faltaPeso}
                  </p>
                  <AnotarPeso unidad={unidad} alGuardar={cargar} />
                </>
              )}
            </div>

            {otras.length > 0 && (
              <div className="seccion">
                <h3>{T.fuerza.loDemas}</h3>
                <p className="nota-privada" style={{ marginTop: 0, marginBottom: 10 }}>
                  {T.fuerza.loDemasNota}{' '}
                  <Link href="/ajustes" className="enlace">
                    {T.fuerza.verEnAjustes}
                  </Link>
                </p>
                <div className="tarjeta" style={{ padding: 4 }}>{otras.map(filaMarca)}</div>
              </div>
            )}
          </>
        )}
      </div>

      {hoja?.abierta && (
        <CargarMarca
          ejercicios={ejercicios}
          unidad={unidad}
          inicial={hoja.ejercicio}
          alCerrar={() => setHoja(null)}
          alGuardar={() => {
            setHoja(null);
            cargar();
          }}
        />
      )}

      <Nav />
    </>
  );
}
