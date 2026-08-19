'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { crearCliente } from '@/lib/supabase/client';
import { planetaDeDia } from '@/lib/rangos';
import { esUnidad, type Unidad } from '@/lib/peso';
import { fechaDeMarca, origenDeMarca, pesoLindo } from '@/lib/fuerza';
import type { Ejercicio, MiFuerza, PR, Perfil } from '@/lib/tipos';
import FondoEspacial from '@/components/FondoEspacial';
import Nav from '@/components/Nav';
import CargarMarca from '@/components/CargarMarca';
import AnotarPeso from '@/components/AnotarPeso';

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

  const cargar = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
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
        <div className="pantalla" />
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
                ? 'Es la única que cargaste.'
                : `Cargaste ${previas.length}. Vale la mejor.`}
            </p>
            {previas.map((h) => (
              <div key={h.id} className="marca-previa">
                <span>{pesoLindo(h.peso, unidad)}</span>
                <span className="apagado">{origenDeMarca(h)}</span>
                <span className="apagado">{fechaDeMarca(h.fecha)}</span>
                <button
                  className="boton-texto peligro"
                  style={{ width: 'auto', padding: 4, fontSize: 12 }}
                  onClick={() => borrar(h.id)}
                  disabled={cargando === h.id}
                >
                  Borrar
                </button>
              </div>
            ))}
            <button
              className="boton-texto"
              onClick={() => setHoja({ abierta: true, ejercicio: m.ejercicio })}
            >
              Cargar otra de {m.nombre.toLowerCase()}
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
          ← Volver
        </button>

        <div className="titulo-pantalla">Mis marcas</div>

        <button className="boton-solido" onClick={() => setHoja({ abierta: true })}>
          Cargar una marca
        </button>

        {marcas.length === 0 ? (
          <div className="vacio-cosmico" style={{ marginTop: 30 }}>
            Todavía no cargaste ninguna.
            <br />
            Sentadilla, banca y peso muerto son las tres que arman tu número.
          </div>
        ) : (
          <>
            <div className="seccion" style={{ marginTop: 26 }}>
              <h3>Las tres que cuentan</h3>
              {delDots.length > 0 ? (
                <div className="tarjeta" style={{ padding: 4 }}>{delDots.map(filaMarca)}</div>
              ) : (
                <p className="nota-privada" style={{ marginTop: 0 }}>
                  Sentadilla, press de banca y peso muerto. Ninguna cargada todavía.
                </p>
              )}
              {/* El DOTS necesita las TRES: con dos no hay un total parcial que
                  valga, porque no sería comparable con el de nadie. */}
              {fuerza?.falta === 'marcas' && delDots.length > 0 && (
                <p className="nota-privada">
                  Con {delDots.length} de 3 todavía no hay número: la fórmula compara totales, y un
                  total incompleto no se compara con nada.
                </p>
              )}
              {fuerza?.falta === 'sexo' && (
                <p className="nota-privada">
                  Ya están las tres. Para el número falta cargar el sexo en{' '}
                  <Link href="/ajustes" className="enlace">
                    Ajustes
                  </Link>
                  : la fórmula usa dos juegos de coeficientes y no se asume ninguno.
                </p>
              )}
              {fuerza?.falta === 'peso' && (
                <>
                  <p className="nota-privada">
                    Ya están las tres. Falta tu peso corporal: la fórmula compara levantamientos
                    entre personas de distinto tamaño y sin él no hay número.
                  </p>
                  <AnotarPeso unidad={unidad} alGuardar={cargar} />
                </>
              )}
            </div>

            {otras.length > 0 && (
              <div className="seccion">
                <h3>Lo demás</h3>
                <p className="nota-privada" style={{ marginTop: 0, marginBottom: 10 }}>
                  Anotalas todas las que quieras. Estas no entran al número: la fórmula está
                  calibrada sobre las otras tres y sumarle ejercicios la invalida.
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
