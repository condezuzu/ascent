'use client';

import { useCallback, useEffect, useState } from 'react';
import { crearCliente } from '@/lib/supabase/client';
import { miUsuario } from '@/lib/supabase/quienSoy';
import { aISO, deISO, hoyISO, restarDias, fechaLinda } from '@nucleo/fechas';
import { RANGOS, planetaDeDia, rangoDeRacha } from '@nucleo/rangos';
import { conComa, deKilos, esUnidad, type Unidad } from '@nucleo/peso';
import type { Log, Peso } from '@nucleo/tipos';
import FondoEspacial from '@/components/FondoEspacial';
import Insignia from '@/components/Insignia';
import Nav from '@/components/Nav';
import Estancamiento from '@/components/Estancamiento';
import Impulsos from '@/components/Impulsos';
import PantallaDeslizable, { Esperar } from '@/components/PantallaDeslizable';
import SeccionFuerza from '@/components/SeccionFuerza';
import SeccionSesiones from '@/components/SeccionSesiones';
import GraficoPeso from '@/components/GraficoPeso';
import AnotarPeso from '@/components/AnotarPeso';
import CalendarioDias from '@/components/CalendarioDias';
import SeccionVolumen from '@/components/SeccionVolumen';
import { T } from '@nucleo/textos';

export default function Estadisticas() {
  const [supabase] = useState(() => crearCliente());
  const [logs, setLogs] = useState<Log[]>([]);
  const [impulsos, setImpulsos] = useState<{
    quedan: number;
    total: number;
    vuelve: string | null;
    falta: number | null;
  } | null>(null);
  const [pesos, setPesos] = useState<Peso[]>([]);
  const [racha, setRacha] = useState(0);
  const [mejor, setMejor] = useState(0);
  const [unidad, setUnidad] = useState<Unidad>('kg');
  const [sexo, setSexo] = useState<string | null>(null);
  const [cargado, setCargado] = useState(false);
  // EL RANGO Y EL PLANETA DEL PERFIL, para el fondo.
  //
  // EL BUG: esta pantalla calculaba el rango con `rangoDeRacha(racha)` y NO
  // pasaba el planeta. Sin planeta, `paletaDe(4, undefined)` cae en la paleta
  // generica del rango 4 en vez de la de Marte: estando en Marte, que es
  // naranja, Stats se veia azul. Es la unica pantalla que se lo olvidaba.
  //
  // Y sale del PERFIL y no de la racha: `rango_actual` es la autoridad —tiene
  // en cuenta la racha base y las perdidas— y es lo que usan Inicio, el Album
  // y el Ranking. Calcularlo aparte era una segunda verdad.
  // `undefined` = todavía no se sabe: el fondo usa el último propio, no el
  // gris del rango 1 (19/9).
  const [miRango, setMiRango] = useState<number | undefined>(undefined);
  const [miPlaneta, setMiPlaneta] = useState<string | null>(null);
  // LAS PESTAÑAS. "General" es lo que Stats ya era, intacto: quién sos en la
  // app. "Entrenamiento" es qué venís haciendo. Mezcladas en una sola lista,
  // la racha —que es el corazón— quedaría enterrada entre números.
  //
  // Arranca siempre en General y no se recuerda: leer la preferencia tarda, y
  // una pantalla que aparece en una pestaña y salta a la otra es peor que un
  // toque de más.
  const [pestana, setPestana] = useState<'general' | 'entrenamiento'>('general');
  // Lo que comparten el volumen y el calendario: qué días hay por revisar, y
  // un contador que avisa que algo se tocó para volver a pedir.
  const [porRevisar, setPorRevisar] = useState<Set<string>>(new Set());
  const [recarga, setRecarga] = useState(0);

  // Con nombre y no en un efecto anónimo: anotar el peso tiene que poder
  // volver a pedir los datos para que la tendencia se dibuje al toque.
  const cargar = useCallback(async () => {
    {
      const user = await miUsuario(supabase);
      if (!user) return setCargado(true);
      const [{ data: p }, { data: ls }, { data: ws }] = await Promise.all([
        // select('*') y no la lista de columnas: si el código llega antes que
        // la migración, pedir una columna que todavía no existe rompe la
        // pantalla entera en vez de solo mostrar el peso en kilos.
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('logs').select('*').eq('user_id', user.id).order('fecha'),
        supabase.from('weights').select('id, fecha, valor').eq('user_id', user.id).order('fecha'),
      ]);
      if (p) {
        setRacha(p.racha_actual);
        setMejor(p.mejor_racha);
        setMiRango(p.rango_actual);
        setMiPlaneta(planetaDeDia(p.racha_actual));
        setSexo(p.sexo ?? null);
        if (esUnidad(p.unidad_peso)) setUnidad(p.unidad_peso);
      }
      setLogs(ls ?? []);
      // Los impulsos que quedan, para poder decidir ANTES de gastarlos. Si la
      // migración todavía no corrió el RPC no existe y no se muestra nada:
      // `catch` en vez de romper la pantalla por un dato de contexto.
      //
      // Se ESPERA (19/9): era un `.then` suelto, y la sección de las vidas
      // entraba después que todo lo demás. La pantalla no aparece sin esto.
      const { data, error } = await supabase.rpc('mis_impulsos');
      if (!error && data)
        setImpulsos({
          quedan: Number(data.quedan),
          total: Number(data.total),
          vuelve: (data.vuelve as string | null) ?? null,
          falta: data.falta_para_ganar === null ? null : Number(data.falta_para_ganar),
        });
      // en la base el peso siempre está en kilos; acá se pasa a la unidad
      // que el usuario eligió, y recién entonces se suaviza y se dibuja
      setPesos((ws ?? []).map((w) => ({ ...w, valor: Number(w.valor) })));
      setCargado(true);
    }
  }, [supabase]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const hoy = hoyISO();
  const entrenados = logs.filter((l) => !l.es_descanso);

  // constancia últimos 30 días
  const hace30 = restarDias(hoy, 29);
  const en30 = entrenados.filter((l) => l.fecha >= hace30).length;

  // este mes
  const d = deISO(hoy);
  const inicioMes = aISO(new Date(d.getFullYear(), d.getMonth(), 1));
  const esteMes = entrenados.filter((l) => l.fecha >= inicioMes).length;

  // Mapa de calor: 26 semanas completas alineadas al calendario.
  // La grilla corre por columnas con 7 filas (domingo arriba): la primera
  // celda TIENE que ser un domingo o todo queda corrido un día.
  const setEntrenados = new Set(entrenados.map((l) => l.fecha));
  const setDescansos = new Set(logs.filter((l) => l.es_descanso).map((l) => l.fecha));
  const celdas: { fecha: string; clase: string }[] = [];
  const finSemana = restarDias(hoy, deISO(hoy).getDay() - 6); // sábado de esta semana
  for (let i = 26 * 7 - 1; i >= 0; i--) {
    const f = restarDias(finSemana, i);
    let clase = '';
    if (f > hoy) clase = 'futuro';
    else if (setEntrenados.has(f)) clase = 'si';
    else if (setDescansos.has(f)) clase = 'descanso';
    celdas.push({ fecha: f, clase });
  }

  // El suavizado y el dibujo se mudaron a `GraficoPeso`: eran veinte líneas
  // de cuentas de SVG en el medio de una pantalla que ya arma un mapa de
  // calor, una escalera y tres secciones más.

  const rangoActual = rangoDeRacha(racha);

  return (
    <>
      <FondoEspacial rango={miRango} planeta={miPlaneta} propio esquina="arriba-derecha" velo={0.72} />
      <PantallaDeslizable listo={cargado}>
        <div className="titulo-pantalla">{T.stats.titulo}</div>


        <div className="selector-vista pestanas-stats" role="tablist">
          <button
            role="tab"
            aria-selected={pestana === 'general'}
            className={pestana === 'general' ? 'activo' : ''}
            onClick={() => setPestana('general')}
          >
            {T.stats.pestanaGeneral}
          </button>
          <button
            role="tab"
            aria-selected={pestana === 'entrenamiento'}
            className={pestana === 'entrenamiento' ? 'activo' : ''}
            onClick={() => setPestana('entrenamiento')}
          >
            {T.stats.pestanaEntrenamiento}
          </button>
        </div>

        {/* Cada pestaña espera a sus secciones antes de mostrarse (19/9): al
            cambiar de pestaña se montan de nuevo, y sin esto "Tus días"
            aparecía arriba y saltaba abajo cuando llegaba el volumen. */}
        {pestana === 'entrenamiento' && (
          <Esperar>
            {/* El volumen arriba y el calendario abajo: primero qué venís
                haciendo, después cada día. */}
            <SeccionVolumen
              recarga={recarga}
              alSaberPorRevisar={setPorRevisar}
              alRevisar={() => setRecarga((n) => n + 1)}
            />
            <CalendarioDias
              alCambiar={() => {
                cargar();
                setRecarga((n) => n + 1);
              }}
              porRevisar={porRevisar}
              alRevisar={() => setRecarga((n) => n + 1)}
            />
          </Esperar>
        )}

        {pestana === 'general' && (
          <Esperar>

        {/* EL AVISO DE ESTANCAMIENTO, si hay uno. Arriba de los números y
            no al final: escondido abajo sería un aviso que se muestra donde
            no molesta, o sea uno que no quiere ser leído. Se puede descartar
            y no vuelve por seis semanas. */}
        <Estancamiento registradoHoy={entrenados.some((l) => l.fecha === hoy)} />

        {/* LOS IMPULSOS, en voz baja y debajo de los números. Un contador
            grande los convertiría en un recurso que se administra —"me quedan
            dos, puedo faltar dos"—, que es lo contrario de para qué están.
            Pero tienen que verse ANTES de gastarlos: enterarse recién cuando
            ya se usó uno no sirve para decidir.

            CUÁNDO VUELVE EL QUE FALTA es la otra mitad del dato: "te queda 1"
            sin decir cuándo vuelve el otro deja pensando que se perdió. */}
        {impulsos && (
          <div className="impulsos-linea">
            <span className="et">{T.impulso.titulo}</span>
            <Impulsos quedan={impulsos.quedan} total={impulsos.total} />
            <span className="nota-privada">
              {T.impulso.nota}
              {impulsos.vuelve ? ' ' + T.impulso.vuelve(fechaLinda(impulsos.vuelve)) : ''}
              {impulsos.falta !== null && impulsos.falta > 0
                ? ' ' + T.impulso.seGanaEn(impulsos.falta)
                : ''}
            </span>
          </div>
        )}

        <div className="stat-grilla">
          <div className="stat-celda">
            <div className="valor">{racha}</div>
            <div className="etiqueta">{T.stats.rachaActual}</div>
          </div>
          <div className="stat-celda">
            <div className="valor">{mejor}</div>
            <div className="etiqueta">{T.stats.mejorRacha}</div>
          </div>
          <div className="stat-celda">
            <div className="valor">{en30}<span style={{ fontSize: 15, color: 'var(--sub)' }}>/30</span></div>
            <div className="etiqueta">{T.stats.ultimos30}</div>
          </div>
          <div className="stat-celda">
            <div className="valor">{esteMes}</div>
            <div className="etiqueta">{T.stats.esteMes}</div>
          </div>
        </div>

        <div className="seccion">
          <h3>{T.stats.elAno}</h3>
          {/* LAS 26 SEMANAS ENTRAN EN EL ANCHO, sin scroll de costado. Tenía
              `minWidth: 420` con `overflowX: auto`, y en un teléfono de 390 el
              scroll arrancaba a la izquierda —las semanas VIEJAS— y escondía las
              recientes: la cuenta de prueba tenía 12 días y se veían 3 (18/9).
              Un dato escondido no es un detalle visual. Igual que la nativa. */}
          <div className="tarjeta">
            <div className="mapa-calor">
              {celdas.map((c) => (
                <i key={c.fecha} className={c.clase} title={c.fecha} />
              ))}
            </div>
          </div>
        </div>

        {/* Las duraciones van acá, después del año y antes del peso (§17.7) */}
        <SeccionSesiones />

        {pesos.length >= 2 ? (
          <div className="seccion">
            <h3>{T.stats.pesoTendencia}</h3>
            <GraficoPeso pesos={pesos} unidad={unidad} />
            {/* El peso se anota ACÁ, que es donde vive. Antes solo se podía
                desde la hoja de registrar el día, y eso lo ataba a haber
                entrenado: pesarse un domingo contaba como día de gimnasio. */}
            <AnotarPeso unidad={unidad} alGuardar={cargar} />
          </div>
        ) : pesos.length === 1 ? (
          // Con un solo dato no hay tendencia que dibujar, pero decirle
          // "anotá tu peso" a alguien que acaba de anotarlo parece un error.
          <div className="seccion">
            <h3>{T.stats.peso}</h3>
            {/* Un solo dato no es una tendencia, pero decirle "anotá tu peso"
                a alguien que acaba de anotarlo parece un error de la app. Se
                muestra el número con la misma tipografía que el gráfico. */}
            <div className="peso-solo">
              <span className="hoy">
                {conComa(deKilos(pesos[0].valor, unidad).toFixed(1))}
                <em>{unidad}</em>
              </span>
            </div>
            <p className="nota-privada">{T.stats.pesoUnoMas}</p>
            <AnotarPeso unidad={unidad} alGuardar={cargar} />
          </div>
        ) : (
          <div className="seccion">
            <h3>{T.stats.peso}</h3>
            <p className="nota-privada">{T.stats.pesoVacio}</p>
            <AnotarPeso unidad={unidad} alGuardar={cargar} />
          </div>
        )}

        {/* La fuerza convive con la racha, no la reemplaza (§16.1): va después
            del peso y antes de la escalera, que es el cierre de la pantalla. */}
        {/* El peso corporal va en KILOS, que es como está la tabla de
            estándares; `unidad` es solo presentación. `pesos` ya viene
            ordenado por fecha, así que el último es el más reciente. */}
        <SeccionFuerza
          unidad={unidad}
          sexo={sexo}
          pesoCorporal={pesos.length > 0 ? pesos[pesos.length - 1].valor : null}
        />

        {/* Único lugar de la app donde los ocho rangos se muestran con nombre */}
        <div className="seccion">
          <h3>{T.stats.laEscalera}</h3>
          <div className="tarjeta escalera-rangos">
            {RANGOS.map((r) => {
              const pasado = rangoActual.n > r.n;
              const esActual = rangoActual.n === r.n;
              return (
                <div
                  key={r.n}
                  className={`fila-rango ${pasado ? 'pasado' : esActual ? '' : 'futuro'}`}
                >
                  <Insignia rango={r.n} />
                  <span>{r.nombre}</span>
                  {esActual ? (
                    <span className="actual-tag">{T.stats.acaEstas}</span>
                  ) : (
                    <span className="dias">{T.stats.diaN(r.desde === 0 ? 1 : r.desde)}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
          </Esperar>
        )}
      </PantallaDeslizable>
      <Nav />
    </>
  );
}
