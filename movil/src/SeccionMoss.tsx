import { useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { T } from '@nucleo/textos';
import type { Lado } from '@nucleo/cuerpo';
import { restarDias } from '@nucleo/fechas';
import { conComa, pesoCorto } from '@nucleo/peso';
import { dentroDeLaSemana, pesoSiguiente, proximaSesion, RANGO, type EstadoDelPuntaje } from '@nucleo/puntajeMuscular';
import { COLORES_DEL_ANIO, POCAS_PESADAS, PROTEINA_POR_KG, SUENO_POCO, type Razon } from '@nucleo/progresoCompartido';
import { sesionesDelEjercicio } from '@nucleo/semanaMuscular';
import type { Sugerencia } from '@nucleo/sugerenciasDeHoy';
import CuerpoDeMoss, { ParteDeCerca, RELLENO, Reloj } from './CuerpoDeMoss';
import { MOSS } from './coloresDeMoss';
import { LETRAS_DE_MOSS } from './fuentes';
import { Text, TextInput } from './Texto';
import Tocable from './Tocable';
import { supabase } from './supabase';
import type { SeccionMoss as Datos, DelMusculoEnLaSeccion, Estancado } from './useSeccionMoss';

const S = () => T.moss.sec;
const nombre = (m: string) => S().musculos[m] ?? m;
const conMayuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** «a, b y c». */
const enLista = (xs: readonly string[]) => (xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} ${S().sugerencias.y} ${xs[xs.length - 1]}`);
/** Las series se dicen redondeadas: «6,5» (media serie del músculo que ayuda) se leía raro. */
const redondo = (n: number) => Math.round(n);
const SIN: DelMusculoEnLaSeccion = { series: 0, partes: {}, puntaje: 0, estado: 'sinEntrenar', fatiga: 'descansado', vuelveEn: 0, total: 0 };

function EnQueSeBasa({ base }: { base: readonly string[] }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <Text style={e.enlace} onPress={() => setAbierto((a) => !a)} accessibilityRole="button">
        {S().enQueSeBasa}
      </Text>
      {abierto && base.map((t) => <Text key={t.slice(0, 24)} style={e.base}>{t}</Text>)}
    </>
  );
}

function Bloque({ titulo, derecha, children, base, testID }: { titulo: string; derecha?: React.ReactNode; children: React.ReactNode; base?: readonly string[]; testID?: string }) {
  return (
    <View style={e.bloque} testID={testID}>
      <View style={e.fila}>
        <Text style={e.etiqueta}>{titulo}</Text>
        {derecha}
      </View>
      {children}
      {base && <EnQueSeBasa base={base} />}
    </View>
  );
}

/** «falta 1 día» o «faltan 3 días»: lo que le falta para recuperarse (23/11, como en Moss). */
const cuandoVuelve = (dias: number) => S().fatigados.faltan(Math.max(1, Math.ceil(dias)));

/** Qué hacer la próxima vez con un ejercicio, con los kilos (como en Moss); `null` sin sesiones suficientes si `soloSiSeSabe`. */
function proximaDe(datos: Datos, id: string, soloSiSeSabe = false): { sube: boolean; texto: string } | null {
  const principal = datos.recientes.find((x) => x.id === id)?.principal ?? [];
  const hoy = datos.deHoy.includes(id);
  const p = proximaSesion({
    sesiones: sesionesDelEjercicio(datos.paraProgresar ?? datos.recientes, id),
    tope: datos.objetivos[id] ?? null,
    nocheCortaHoy: datos.nocheCortaHoy && hoy,
    fatigadoHoy: hoy && principal.some((m) => (datos.musculos.get(m)?.vuelveEn ?? 0) > 0),
  });
  const kg = datos.pesos[id] ?? 0;
  const siguiente = pesoSiguiente(kg);
  const peso = kg > 0 ? `${pesoCorto(kg, 'kg')} kg` : S().tus.mismoPeso;
  const P = S().tus.proxima;
  if (p.decision === 'subir') return { sube: true, texto: siguiente === null ? P.subirSinPeso : P.subirA(pesoCorto(siguiente, 'kg')) };
  if (p.decision === 'noSeSabe') return soloSiSeSabe ? null : { sube: false, texto: P.pocasSesiones(peso) };
  const texto = p.razon === 'faltaElTope' ? P.faltaElTope(peso, datos.objetivos[id] ?? 0) : p.razon === 'sueno' ? P.sueno(peso) : p.razon === 'fatiga' ? P.fatiga(peso) : P.sinObjetivo(peso);
  return { sube: false, texto };
}

// ------------------------------------------------------------ metas (arriba de todo: lo que menos importa)
function Metas({ datos, alCambiar }: { datos: Datos; alCambiar: () => void }) {
  const [nueva, setNueva] = useState(false);
  const [ejercicio, setEjercicio] = useState<string | null>(null);
  const [kilos, setKilos] = useState('');
  const [reps, setReps] = useState('1');
  const [error, setError] = useState('');
  const candidatos = useMemo(() => [...new Set([...Object.keys(datos.objetivos), ...datos.recientes.filter((x) => Date.parse(`${datos.hoy}T12:00:00Z`) - Date.parse(`${x.fecha}T12:00:00Z`) < 28 * 86400000).map((x) => x.id)])], [datos]);
  const guardar = async () => {
    const k = Number(kilos.replace(',', '.'));
    const r = Math.round(Number(reps));
    if (!ejercicio || !(k >= 1 && k <= 1000) || !(r >= 1 && r <= 10)) return;
    const { error: e1 } = await supabase.schema('moss').rpc('guardar_meta_de_fuerza', { p_id: null, p_ejercicio: ejercicio, p_kilos: k, p_reps: r });
    if (e1) return setError(S().metas.error);
    setNueva(false);
    setKilos('');
    alCambiar();
  };
  const borrar = async (id: string) => {
    await supabase.schema('moss').rpc('borrar_meta_de_fuerza', { p_id: id });
    alCambiar();
  };
  return (
    <Bloque titulo={S().metas.titulo} base={S().baseDe.metas} testID="moss-metas">
      {datos.metas?.length === 0 && !nueva && <Text style={e.linea}>{S().metas.ninguna}</Text>}
      {datos.metas?.map((m) => {
        const p = m.proyeccion;
        const meta = Math.max(1, m.kilos * (m.reps === 1 ? 1 : 1 + m.reps / 30));
        const kg = pesoCorto(m.kilos, 'kg');
        const queHacer = p.estado === 'lograda' ? null : proximaDe(datos, m.ejercicio, true);
        return (
          <View key={m.id} style={e.meta}>
            <View style={e.fila}>
              <Text style={[e.linea, e.crece]}>{m.nombre}</Text>
              <Text style={e.chico}>{m.reps === 1 ? S().metas.objetivoUna(kg) : S().metas.objetivoVarias(kg, m.reps)}</Text>
            </View>
            {m.nivel !== null && (
              <>
                <View style={e.pista}>
                  <View style={[e.lleno, { width: `${Math.min(1, m.nivel / meta) * 100}%`, backgroundColor: MOSS.oro }]} />
                </View>
                {/* Lo que levantarías hoy con esas repeticiones, de a 2,5 kg (como en Moss). */}
                <Text style={e.chico}>{S().metas.nivelKg(conComa(Math.round((m.reps === 1 ? m.nivel : m.nivel / (1 + m.reps / 30)) / 2.5) * 2.5))}</Text>
              </>
            )}
            <Text style={e.chico}>
              {p.estado === 'lograda' ? S().metas.lograda : p.estado === 'noSeSabe' ? S().metas.noSeSabe : p.estado === 'noSube' ? S().metas.noSube : p.semanas[1] === null ? S().metas.enCaminoAbierto(p.semanas[0]) : S().metas.enCamino(p.semanas[0], p.semanas[1])}
            </Text>
            {p.estado === 'enCamino' && !p.realista && <Text style={e.chico}>{S().metas.lejana}</Text>}
            {queHacer && <Text style={e.proxima}>{queHacer.texto}</Text>}
            <Text style={e.enlace} onPress={() => void borrar(m.id)} accessibilityRole="button">{S().metas.borrar}</Text>
          </View>
        );
      })}
      {nueva ? (
        <View style={e.lista}>
          <Text style={e.sub}>{S().metas.elegir}</Text>
          <View style={e.pildoras}>
            {candidatos.map((id) => (
              <Tocable key={id} onPress={() => setEjercicio(id)} style={[e.pildora, ejercicio === id && e.pildoraElegida]} accessibilityRole="button">
                <Text style={[e.pildoraTexto, ejercicio === id && e.pildoraTextoElegida]}>{datos.nombres[id] ?? id}</Text>
              </Tocable>
            ))}
          </View>
          <View style={e.fila}>
            <TextInput style={e.campo} value={kilos} onChangeText={setKilos} keyboardType="decimal-pad" placeholder={S().metas.kilos} placeholderTextColor={MOSS.pergaminoTenue} />
            <TextInput style={e.campo} value={reps} onChangeText={setReps} keyboardType="number-pad" placeholder={S().metas.reps} placeholderTextColor={MOSS.pergaminoTenue} />
          </View>
          <View style={e.fila}>
            <Tocable onPress={() => void guardar()} style={e.boton} accessibilityRole="button">
              <Text style={e.botonTexto}>{S().metas.guardar}</Text>
            </Tocable>
            <Text style={e.enlace} onPress={() => setNueva(false)} accessibilityRole="button">{S().metas.cancelar}</Text>
          </View>
          {!!error && <Text style={e.chico}>{error}</Text>}
        </View>
      ) : (
        datos.metas !== null && (
          <Text style={e.enlace} onPress={() => setNueva(true)} accessibilityRole="button" testID="moss-nueva-meta">{S().metas.nueva}</Text>
        )
      )}
    </Bloque>
  );
}

// ------------------------------------------------------------ por qué (solo con algo estancado)
const v1 = (n: number) => conComa(Math.round(n * 10) / 10);
const horas = (min: number) => {
  const m = Math.round(min / 5) * 5;
  return S().porQue.horas(Math.floor(m / 60), m % 60);
};
// Los topes de las escalas, los de Moss: 10 h de sueño y 2,6 g de proteína por kilo.
const SUENO_TOPE = 10 * 60;
const PROTEINA_TOPE = 2.6;

/** Una escala de 0 al tope con lo de ahora lleno y una raya en lo que pide la evidencia. */
function Escala({ valor, tope, raya }: { valor: number; tope: number; raya: number }) {
  const pct = (n: number) => `${Math.min(1, Math.max(0, n / tope)) * 100}%` as const;
  return (
    <View style={e.pista}>
      <View style={[e.lleno, { width: pct(valor), backgroundColor: MOSS.terracota }]} />
      <View style={[e.raya, { left: pct(raya) }]} />
    </View>
  );
}

/** Las series duras de cada semana: cuando subía, llenas; ahora, en línea. */
function Semanas({ est }: { est: Estancado }) {
  const tope = Math.max(1, ...est.antes.map((x) => x.series), ...est.ahora.map((x) => x.series));
  const barra = (n: number, ahora: boolean, k: string) => <View key={k} style={[e.semana, ahora ? e.semanaAhora : e.semanaAntes, { height: `${Math.max(4, (n / tope) * 100)}%` }]} />;
  return (
    <>
      <View style={e.semanas}>
        {est.antes.map((x) => barra(x.series, false, `a${x.lunes}`))}
        <View style={e.divisor} />
        {est.ahora.map((x) => barra(x.series, true, `h${x.lunes}`))}
      </View>
      <View style={e.leyendaFila}>
        <View style={[e.cuadro, e.semanaAntes]} />
        <Text style={e.chico}>{S().porQue.antes}</Text>
        <View style={[e.cuadro, e.semanaAhora]} />
        <Text style={e.chico}>{S().porQue.ahora}</Text>
      </View>
    </>
  );
}

function RazonVista({ x, est }: { x: Razon; est: Estancado }) {
  const P = S().porQue;
  const cab = (titulo: string, valor?: string) => (
    <View style={e.fila}>
      <Text style={e.linea}>{titulo}</Text>
      {!!valor && <Text style={e.chico}>{valor}</Text>}
    </View>
  );
  const p = (texto: string) => <Text style={e.chico}>{texto}</Text>;
  if (x.que === 'series') return <View style={e.razon} testID="moss-razon-series">{cab(P.series(nombre(est.musculo).toLowerCase()), `${v1(x.antes)} → ${v1(x.ahora)}`)}<Semanas est={est} />{p(P.seriesTexto)}</View>;
  if (x.que === 'frecuencia') return <View style={e.razon}>{cab(P.frecuencia, `${v1(x.antes)} → ${v1(x.ahora)}`)}{p(P.frecuenciaTexto(v1(x.antes), v1(x.ahora)))}</View>;
  if (x.que === 'pesadas') return <View style={e.razon}>{cab(P.pesadas, `${x.pesadas} / ${x.de}`)}<Escala valor={x.pesadas / x.de} tope={1} raya={POCAS_PESADAS} />{p(P.pesadasTexto(x.pesadas, x.de))}{p(P.pesadasConsejo)}</View>;
  if (x.que === 'bajando') return <View style={e.razon}>{cab(P.bajando, P.bajandoValor(v1(x.porSemana)))}{p(P.bajandoTexto)}</View>;
  if (x.que === 'definicion') return <View style={e.razon}>{cab(P.definicion)}{p(P.definicionTexto)}</View>;
  if (x.que === 'proteina') return <View style={e.razon}>{cab(P.proteina, P.proteinaValor(v1(x.gPorKg)))}<Escala valor={x.gPorKg} tope={PROTEINA_TOPE} raya={PROTEINA_POR_KG} />{p(P.proteinaTexto(v1(x.gPorKg)))}</View>;
  return (
    <View style={e.razon}>
      {cab(P.sueno, horas(x.ahora))}
      <Escala valor={x.ahora} tope={SUENO_TOPE} raya={SUENO_POCO} />
      {p(x.antes !== null ? P.suenoTexto(horas(x.ahora), horas(x.antes)) : P.suenoSinAntes(horas(x.ahora)))}
      {p(P.suenoNota)}
    </View>
  );
}

/** Lo que es de la persona y no del ejercicio: si les toca a todos, va una vez, arriba (como en Moss). */
const DE_LA_PERSONA: readonly Razon['que'][] = ['bajando', 'definicion', 'proteina', 'sueno'];

function PorQue({ est }: { est: Estancado[] }) {
  const P = S().porQue;
  const comunes = est.length > 1 ? DE_LA_PERSONA.filter((q) => est.every((x) => x.r.razones.some((r) => r.que === q))) : [];
  return (
    <Bloque titulo={P.titulo} base={S().baseDe.porQue} testID="moss-por-que">
      <Text style={e.chico}>{P.texto}</Text>
      {comunes.length > 0 && (
        <View style={e.ejercicio}>
          <Text style={e.sub}>{P.comunes}</Text>
          {est[0].r.razones.filter((r) => comunes.includes(r.que)).map((r) => <RazonVista key={r.que} x={r} est={est[0]} />)}
        </View>
      )}
      {est.map((x) => {
        const propias = x.r.razones.filter((r) => !comunes.includes(r.que));
        return (
          <View key={x.id} style={e.ejercicio}>
            <Text style={e.sub}>{x.nombre}</Text>
            {propias.length ? propias.map((r) => <RazonVista key={r.que} x={r} est={x} />) : <Text style={e.chico}>{comunes.length ? P.soloComunes : P.sinCausa}</Text>}
            {(x.r.faltan.includes('comida') || x.r.faltan.includes('sueno')) && <Text style={e.chico}>{P.faltan}</Text>}
          </View>
        );
      })}
      {est.some((x) => x.r.anios !== null) && <Text style={e.chico}>{P.anios}</Text>}
    </Bloque>
  );
}

// ------------------------------------------------------------ tu rutina y los fatigados
function Rutina({ datos }: { datos: Datos }) {
  const nota = datos.nota;
  return (
    <Bloque
      titulo={S().tus.rutinaTitulo}
      testID="moss-rutina"
      derecha={nota ? <Text testID="moss-nota" style={[e.notaDeRutina, nota.nota === 'mejorable' && e.deMas]}>{S().tus.nota[nota.nota]}</Text> : undefined}
    >
      {!nota ? (
        <Text style={e.linea}>{S().tus.sinRutina}</Text>
      ) : !nota.mejoras.length ? (
        <Text style={e.linea}>{S().tus.bien}</Text>
      ) : (
        nota.mejoras.map((x) => {
          const n = redondo(datos.musculos.get(x.musculo)?.series ?? 0);
          const m = nombre(x.musculo).toLowerCase();
          return <Text key={`${x.musculo}-${x.que}`} style={e.linea}>{conMayuscula(x.que === 'frecuencia' ? S().tus.frecuencia(m) : x.que === 'pocasSeries' ? S().tus.pocasSeries(m, n) : S().tus.muchasSeries(m, n))}</Text>;
        })
      )}
    </Bloque>
  );
}

function Fatigados({ datos }: { datos: Datos }) {
  const fatigados = [...datos.musculos].filter(([, x]) => x.vuelveEn > 0).sort((a, b) => b[1].vuelveEn - a[1].vuelveEn);
  return (
    <Bloque titulo={S().fatigados.titulo} base={S().baseDe.fatigados} testID="moss-fatigados">
      <Text style={e.chico}>{S().fatigados.texto}</Text>
      {fatigados.length === 0 ? (
        <Text style={e.linea}>{S().fatigados.ninguno}</Text>
      ) : (
        <>
          {fatigados.map(([m, x]) => (
            <View key={m} style={e.fila}>
              <Reloj tam={24} hecho={1 - x.vuelveEn / Math.max(1, x.total)} />
              <Text style={[e.linea, e.crece]}>{nombre(m)}</Text>
              <Text style={e.chico}>{cuandoVuelve(x.vuelveEn)}</Text>
            </View>
          ))}
          <Text style={e.chico}>{S().fatigados.comoSeCalcula.join(' ')}</Text>
        </>
      )}
    </Bloque>
  );
}

// ------------------------------------------------------------ tus músculos (lo principal, donde se llega)
/** Los músculos que se ven de frente y los de espalda: la lista de cada lado va al lado del dibujo. */
const DEL_FRENTE = ['pecho', 'hombros', 'biceps', 'antebrazos', 'abdomen', 'cuadriceps', 'aductores'];
const DE_ESPALDA = ['trapecio', 'dorsales', 'triceps', 'espaldaBaja', 'gluteos', 'isquios', 'pantorrillas'];
/** La barra de cada músculo va de 0 a 30 series, con la franja de 10 a 20 marcada. */
const TOPE_DE_SERIES = 30;
const enLaBarra = (n: number) => `${(Math.min(TOPE_DE_SERIES, Math.max(0, n)) / TOPE_DE_SERIES) * 100}%` as const;

function BarraDeSeries({ n, estado, alta = 6 }: { n: number; estado: EstadoDelPuntaje; alta?: number }) {
  return (
    <View style={[e.pista, { height: alta }]}>
      <View style={[e.franja, { left: enLaBarra(RANGO.desde), width: `${((RANGO.hasta - RANGO.desde) / TOPE_DE_SERIES) * 100}%` }]} />
      <View style={[e.lleno, { width: enLaBarra(n), backgroundColor: RELLENO[estado] }]} />
    </View>
  );
}

function FilaDelMusculo({ m, x, elegido, alTocar }: { m: string; x: DelMusculoEnLaSeccion; elegido: boolean; alTocar: () => void }) {
  const estado = S().tus.estados[x.estado];
  return (
    <Tocable
      onPress={alTocar}
      style={[e.musculo, elegido && e.musculoElegido]}
      accessibilityRole="button"
      accessibilityState={{ selected: elegido }}
      accessibilityLabel={S().tus.barra(nombre(m), redondo(x.series), estado.toLowerCase())}
      testID={`moss-barra-${m}`}
    >
      <View style={e.fila}>
        <Text style={[e.musculoNombre, e.crece]} numberOfLines={1}>{nombre(m)}</Text>
        {x.vuelveEn > 0 && <View style={[e.cuadro, e.punteado]} />}
        <Text style={[e.musculoEstado, x.estado === 'mucho' && e.deMas]} numberOfLines={1}>{estado}</Text>
        <Text style={[e.musculoNum, x.estado === 'mucho' && e.deMas]}>{redondo(x.series)}</Text>
      </View>
      <BarraDeSeries n={x.series} estado={x.estado} />
    </Tocable>
  );
}

/** Qué hacer según cómo está cada músculo esta semana, con su color; y el borde de lo que todavía se recupera. */
function Leyenda() {
  const U = S().tus;
  return (
    <View style={e.lista}>
      {(['poco', 'enSuPunto', 'mucho'] as const).map((x) => (
        <View key={x} style={e.leyendaFila}>
          <View style={[e.cuadro, { backgroundColor: RELLENO[x] }]} />
          <Text style={[e.chico, e.crece]}><Text style={e.chicoFuerte}>{`${U.estados[x]}: `}</Text>{U.acciones[x]}</Text>
        </View>
      ))}
      <View style={e.leyendaFila}>
        <View style={[e.cuadro, e.punteado]} />
        <Text style={[e.chico, e.crece]}><Text style={e.chicoFuerte}>{`${U.estados.fatigado}: `}</Text>{U.acciones.fatigado}</Text>
      </View>
      <Text style={e.chico}>{U.toca}</Text>
    </View>
  );
}

/** Un músculo: sus series contra lo ideal, qué hacer, cuándo está listo, sus partes de cerca (si tiene) y sus ejercicios. */
function Detalle({ m, datos, alCerrar }: { m: string; datos: Datos; alCerrar: () => void }) {
  const x = datos.musculos.get(m) ?? SIN;
  const semana = datos.recientes.filter((r) => (r.principal.includes(m) || r.ayuda.includes(m)) && dentroDeLaSemana(r.fecha, datos.hoy));
  const fuerte = (id: string) => semana.some((r) => r.id === id && r.principal.includes(m));
  const ids = [...new Set(semana.map((r) => r.id))].sort((a, b) => Number(fuerte(b)) - Number(fuerte(a)));
  const parte = m === 'pecho' ? 'pechoAlto' : m === 'triceps' ? 'tricepsLarga' : null;
  const enParte = parte ? (x.partes[parte] ?? 0) : 0;
  return (
    <View testID="moss-detalle" style={e.detalle}>
      <View style={e.fila}>
        <Text style={e.grande}>{nombre(m)}</Text>
        <Text style={e.enlace} onPress={alCerrar} accessibilityRole="button">{S().tus.cerrar}</Text>
      </View>
      <Text style={e.linea}>{S().tus.seriesCorto(redondo(x.series))}</Text>
      <BarraDeSeries n={x.series} estado={x.estado} alta={8} />
      <Text style={[e.linea, x.estado === 'mucho' && e.deMas]}>{x.estado === 'sinEntrenar' ? S().tus.acciones.sinEntrenar : `${S().tus.estados[x.estado]}: ${S().tus.acciones[x.estado]}`}</Text>
      {x.vuelveEn > 0 && (
        <View style={e.fila}>
          <Reloj tam={22} hecho={1 - x.vuelveEn / Math.max(1, x.total)} />
          <Text style={[e.fatiga, e.crece]}>
            {`${S().tus.estados.fatigado} · ${cuandoVuelve(x.vuelveEn)}`}
            <Text style={e.chico}>{` · ${S().fatigados.estimado}`}</Text>
          </Text>
        </View>
      )}
      {parte && (
        <View style={e.partes}>
          <ParteDeCerca musculo={m as 'pecho' | 'triceps'} ancho={120} alto={96} parte={enParte > 0 ? 'enSuPunto' : 'sinEntrenar'} resto={x.series - enParte > 0 ? 'poco' : 'sinEntrenar'} />
          <View style={[e.lista, e.crece]}>
            {([[parte, enParte, MOSS.oro], [`${m}Resto`, Math.max(0, x.series - enParte), MOSS.musculoPoco]] as const).map(([k, n, color]) => (
              <View key={k} style={e.leyendaFila}>
                <View style={[e.cuadro, { backgroundColor: color }]} />
                <Text style={[e.linea, e.crece]}>{S().tus.parteLinea(S().tus.partes[k] ?? k, redondo(n))}</Text>
              </View>
            ))}
            <Text style={e.chico}>{S().tus.partesComo[m]}</Text>
          </View>
        </View>
      )}
      <Text style={e.sub}>{S().tus.ejercicios}</Text>
      {ids.length === 0 && <Text style={e.linea}>{S().tus.sinEjercicios}</Text>}
      {ids.map((id) => {
        const duras = semana.filter((r) => r.id === id).reduce((t, r) => t + r.series.length, 0);
        const p = fuerte(id) ? proximaDe(datos, id) : null;
        return (
          <View key={id} style={e.ejercicio}>
            <View style={e.fila}>
              <Text style={[e.linea, e.crece]}>{datos.nombres[id] ?? id}</Text>
              <Text style={e.chico}>{S().tus.duras(duras)}</Text>
            </View>
            {p ? (
              <View style={e.leyendaFila}>
                <Text style={[e.flecha, p.sube && e.flechaSube]}>{p.sube ? '↑' : '='}</Text>
                <Text testID={`moss-proxima-${id}`} style={[e.proxima, e.crece]}>{p.texto}</Text>
              </View>
            ) : (
              <Text style={e.chico}>{S().tus.ayuda(nombre(m).toLowerCase())}</Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

/** Las tres sugerencias de hoy (sugerenciasDeHoy.ts, igual en Moss): entrenamiento, comida y sueño. */
function ParaHoy({ datos, alIrASueno }: { datos: Datos; alIrASueno: () => void }) {
  const P = S().sugerencias;
  const s = datos.sugerencias;
  const lista = (ms: readonly string[] | undefined) => enLista((ms ?? []).map((m) => nombre(m).toLowerCase()));
  const entreno = (x: Sugerencia): string[] => {
    const toca = x.musculos?.length ? [P.toca(lista(x.musculos))] : [];
    if (x.clave === 'entrenar' && x.reps && x.reserva) return [...toca, P.entreno.entrenar(x.reps[0], x.reps[1], x.reserva[0], x.reserva[1])];
    if (x.clave === 'nocheCorta') return [...toca, P.entreno.nocheCorta];
    if (x.clave === 'conFatiga') return [...toca, ((x.fatigados?.length ?? 0) > 1 ? P.entreno.conFatigaVarios : P.entreno.conFatiga)(conMayuscula(lista(x.fatigados)))];
    return [P.entreno.descanso];
  };
  const comida = P.comida[s.comida.clave] ?? P.comida.cuidado;
  const macros = enLista((s.comida.macros ?? []).map((m) => P.macros[m]));
  const horas = s.sueno.minutos === undefined ? '' : S().porQue.horas(Math.floor(s.sueno.minutos / 60), s.sueno.minutos % 60);
  // Si ya entrenaste hoy, el entrenamiento no va: quedan la comida y el sueño.
  const filas: [keyof typeof P.tipos, string[]][] = [
    ...(s.entreno ? [['entreno', entreno(s.entreno)] as [keyof typeof P.tipos, string[]]] : []),
    ['comida', [typeof comida === 'function' ? comida(macros) : comida]],
    ['sueno', [(P.sueno[s.sueno.clave] ?? P.sueno.sinDatos)(horas)]],
  ];
  return (
    <View style={e.paraHoy} testID="moss-para-hoy">
      <Text style={e.etiqueta}>{P.titulo}</Text>
      {filas.map(([tipo, lineas]) => (
        <View key={tipo} style={e.leyendaFila}>
          <View style={e.punto} />
          <View style={[e.crece, e.sugerencia]}>
            <Text style={e.tipo}>{P.tipos[tipo]}</Text>
            {lineas.map((l) => <Text key={l} style={e.linea}>{l}</Text>)}
            {tipo === 'sueno' && <Text style={e.enlace} onPress={alIrASueno} accessibilityRole="link" testID="moss-mas-en-sueno">{P.masEnSueno}</Text>}
          </View>
        </View>
      ))}
    </View>
  );
}

function TusMusculos({ datos, alIrASueno }: { datos: Datos; alIrASueno: () => void }) {
  const { width } = useWindowDimensions();
  const [lado, setLado] = useState<Lado>('frente');
  const [elegido, setElegido] = useState<string | null>(null);
  const elegir = (m: string) => setElegido((x) => (x === m ? null : m));
  const conDatos = datos.recientes.some((x) => x.fecha >= restarDias(datos.hoy, 27));
  const anchoDelCuerpo = Math.min(160, Math.round((width - 48) * 0.42));
  return (
    <View style={e.tus} testID="moss-tus-musculos">
      <Text style={e.linea}>{S().tus.paraQue}</Text>
      <ParaHoy datos={datos} alIrASueno={alIrASueno} />
      {!conDatos ? (
        <Text style={e.linea}>{S().tus.sinDatos}</Text>
      ) : (
        <>
          <Text style={[e.etiqueta, e.arribaDe]}>{S().tus.semana}</Text>
          <Text style={e.chico}>{S().tus.semanaTexto}</Text>
          <View style={e.pildoras}>
            {(['frente', 'espalda'] as const).map((x) => (
              <Tocable key={x} onPress={() => { setLado(x); setElegido(null); }} style={[e.pildora, lado === x && e.pildoraElegida]} accessibilityRole="button" accessibilityState={{ selected: lado === x }} testID={`moss-lado-${x}`}>
                <Text style={[e.pildoraTexto, lado === x && e.pildoraTextoElegida]}>{S().tus[x]}</Text>
              </Tocable>
            ))}
          </View>
          <View style={e.cuerpoYLista}>
            <CuerpoDeMoss musculos={datos.musculos} lado={lado} ancho={anchoDelCuerpo} elegido={elegido} alTocar={elegir} />
            <View style={e.crece}>
              {(lado === 'frente' ? DEL_FRENTE : DE_ESPALDA).map((m) => <FilaDelMusculo key={m} m={m} x={datos.musculos.get(m) ?? SIN} elegido={m === elegido} alTocar={() => elegir(m)} />)}
            </View>
          </View>
          {elegido ? <Detalle m={elegido} datos={datos} alCerrar={() => setElegido(null)} /> : <Leyenda />}
        </>
      )}
      <Text style={e.chico}>{S().tus.anotas}</Text>
      <EnQueSeBasa base={S().baseDe.musculos} />
    </View>
  );
}

/**
 * LA SECCIÓN DE MOSS EN ASCENT (19/11, rehecha el mismo día después de verla en el iPhone; spec/musculos-compartido.md):
 * igual que la de Ascent en Moss —la misma información, el mismo orden, los mismos textos— con la cara de Moss. Se llega
 * abajo de todo, a «Tus músculos» con «Sugerencias para hoy» arriba de «Esta semana» (23/11), y se sube: los fatigados, tu rutina, tu año, los estancados, por qué
 * (solo con alguno) y las metas.
 */
export default function SeccionMoss({ datos, alDesvincular, alCambiar, alAbrirTutorial, alIrASueno }: { datos: Datos; alDesvincular: () => void; alCambiar: () => void; alAbrirTutorial: () => void; alIrASueno: () => void }) {
  const lista = useRef<ScrollView>(null);
  // Como en Moss: se llega abajo y, si algo crece o se achica (un detalle, una meta), lo de abajo queda donde estaba
  // en vez de saltar al final. Hasta el primer scroll, pegado al final.
  const desdeAbajo = useRef(-1);
  const alto = useRef(0);
  const anio = datos.hoy.slice(0, 4);
  return (
    <ScrollView
      ref={lista}
      testID="moss-vinculada"
      style={StyleSheet.absoluteFill}
      contentContainerStyle={e.contenido}
      scrollEventThrottle={16}
      onLayout={(ev) => (alto.current = ev.nativeEvent.layout.height)}
      onScroll={(ev) => (desdeAbajo.current = ev.nativeEvent.contentSize.height - ev.nativeEvent.contentOffset.y)}
      onContentSizeChange={(_, nuevo) => lista.current?.scrollTo({ y: Math.max(0, nuevo - (desdeAbajo.current < 0 ? alto.current : desdeAbajo.current)), animated: false })}
    >
      <Metas datos={datos} alCambiar={alCambiar} />

      {datos.estancados.length > 0 && <PorQue est={datos.estancados} />}

      <Bloque titulo={S().estancados.titulo} base={S().baseDe.estancados} testID="moss-estancados">
        <Text style={e.chico}>{S().estancados.texto}</Text>
        {datos.estancados.length === 0 ? <Text style={e.linea}>{S().estancados.ninguno}</Text> : datos.estancados.map((x) => <Text key={x.id} style={e.linea}>{x.nombre}</Text>)}
      </Bloque>

      <Bloque titulo={S().anio.titulo} testID="moss-anio">
        <Text style={e.chico}>{`${S().anio.hastaHoy(anio)} · ${S().anio.texto}`}</Text>
        <View style={e.anio}>
          {Array.from({ length: 12 }, (_, mes) => (
            <View key={mes} style={e.mes}>
              {Array.from({ length: new Date(Date.UTC(Number(anio), mes + 1, 0)).getUTCDate() }, (_, d) => {
                const f = `${anio}-${String(mes + 1).padStart(2, '0')}-${String(d + 1).padStart(2, '0')}`;
                const g = datos.anio.get(f);
                return <View key={d} testID={g ? `moss-dia-${f}` : undefined} style={[e.dia, { backgroundColor: g ? COLORES_DEL_ANIO[g] : f <= datos.hoy ? MOSS.musculoSin : 'transparent' }]} />;
              })}
            </View>
          ))}
        </View>
        <View style={e.pildoras}>
          {(Object.keys(COLORES_DEL_ANIO) as (keyof typeof COLORES_DEL_ANIO)[]).map((g) => (
            <View key={g} style={e.leyendaFila}>
              <View style={[e.dia, { backgroundColor: COLORES_DEL_ANIO[g] }]} />
              <Text style={e.chico}>{S().anio.grupos[g]}</Text>
            </View>
          ))}
          <View style={e.leyendaFila}>
            <View style={[e.dia, { backgroundColor: MOSS.musculoSin }]} />
            <Text style={e.chico}>{S().anio.descanso}</Text>
          </View>
        </View>
      </Bloque>

      <Rutina datos={datos} />

      <Fatigados datos={datos} />

      <View style={e.arriba}>
        <Text style={e.titulo}>{T.moss.vinculada}</Text>
        {/* «Cómo se lee» al lado del «!»: solo, no se entendía que era un botón. */}
        <Tocable onPress={alAbrirTutorial} style={e.ayuda} accessibilityRole="button" accessibilityLabel={S().tutorial.abrir} testID="moss-tutorial-abrir">
          <View style={e.ayudaCirculo}>
            <Text style={e.ayudaTexto}>!</Text>
          </View>
          <Text style={e.chico}>{S().tutorial.abrir}</Text>
        </Tocable>
      </View>

      <TusMusculos datos={datos} alIrASueno={alIrASueno} />

      <Text testID="moss-desvincular" style={e.desvincular} onPress={alDesvincular} accessibilityRole="button">{T.moss.desvincular}</Text>
    </ScrollView>
  );
}

const e = StyleSheet.create({
  contenido: { flexGrow: 1, justifyContent: 'flex-end', paddingHorizontal: 24, paddingTop: 70, paddingBottom: 120 },
  arriba: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14, paddingTop: 26, paddingBottom: 14, borderTopWidth: 1, borderTopColor: MOSS.linea },
  titulo: { color: MOSS.pergamino, fontFamily: LETRAS_DE_MOSS.titulo, fontSize: 30, textAlign: 'center' },
  ayuda: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4, paddingLeft: 4, paddingRight: 12, borderRadius: 999, borderWidth: 1, borderColor: MOSS.oroBorde },
  ayudaCirculo: { width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: MOSS.oro, alignItems: 'center', justifyContent: 'center' },
  ayudaTexto: { color: MOSS.oro, fontFamily: LETRAS_DE_MOSS.texto, fontSize: 12 },
  desvincular: { color: MOSS.pergaminoTenue, fontFamily: LETRAS_DE_MOSS.texto, fontSize: 13, textAlign: 'center', paddingVertical: 14, marginTop: 18 },
  bloque: { gap: 10, paddingVertical: 22, borderTopWidth: 1, borderTopColor: MOSS.linea },
  tus: { gap: 10, paddingBottom: 8 },
  etiqueta: { flexShrink: 1, color: MOSS.oro, fontFamily: LETRAS_DE_MOSS.texto, fontSize: 12, letterSpacing: 2.6, textTransform: 'uppercase' },
  arribaDe: { marginTop: 10 },
  grande: { color: MOSS.pergamino, fontFamily: LETRAS_DE_MOSS.texto, fontSize: 24, lineHeight: 30 },
  sub: { color: MOSS.oroClaro, fontFamily: LETRAS_DE_MOSS.texto, fontSize: 13, marginTop: 4 },
  linea: { color: MOSS.pergamino, fontFamily: LETRAS_DE_MOSS.texto, fontSize: 15, lineHeight: 21 },
  chico: { color: MOSS.pergaminoTenue, fontFamily: LETRAS_DE_MOSS.texto, fontSize: 13, lineHeight: 18 },
  chicoFuerte: { color: MOSS.pergamino },
  base: { color: MOSS.pergaminoTenue, fontFamily: LETRAS_DE_MOSS.texto, fontSize: 13, lineHeight: 19 },
  enlace: { color: MOSS.oro, fontFamily: LETRAS_DE_MOSS.texto, fontSize: 14, textDecorationLine: 'underline', alignSelf: 'flex-start', paddingVertical: 4 },
  proxima: { color: MOSS.oroClaro, fontFamily: LETRAS_DE_MOSS.texto, fontSize: 14, lineHeight: 20 },
  deMas: { color: MOSS.terracota },
  crece: { flex: 1, minWidth: 0 },
  cuerpoYLista: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  musculo: { gap: 5, paddingVertical: 6, paddingHorizontal: 6, marginHorizontal: -6, borderRadius: 2 },
  musculoElegido: { backgroundColor: MOSS.nocheVidrio },
  musculoNombre: { color: MOSS.pergamino, fontFamily: LETRAS_DE_MOSS.texto, fontSize: 13.5 },
  musculoEstado: { color: MOSS.pergaminoTenue, fontFamily: LETRAS_DE_MOSS.texto, fontSize: 11 },
  musculoNum: { minWidth: 20, textAlign: 'right', color: MOSS.pergaminoTenue, fontFamily: LETRAS_DE_MOSS.texto, fontSize: 13 },
  pista: { height: 10, borderRadius: 999, backgroundColor: MOSS.linea, overflow: 'hidden' },
  franja: { position: 'absolute', top: 0, bottom: 0, borderLeftWidth: 1, borderRightWidth: 1, borderColor: MOSS.pergaminoTenue },
  lleno: { height: '100%', borderRadius: 999 },
  cuadro: { width: 10, height: 10, borderRadius: 2 },
  // El borde punteado de lo que todavía se recupera, el mismo del cuerpo.
  punteado: { borderWidth: 1.2, borderStyle: 'dashed', borderColor: MOSS.pergamino },
  leyendaFila: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detalle: { gap: 8, paddingTop: 6 },
  fatiga: { color: MOSS.terracota, fontFamily: LETRAS_DE_MOSS.texto, fontSize: 13.5, lineHeight: 18 },
  partes: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 8 },
  flecha: { width: 12, color: MOSS.pergaminoTenue, fontFamily: LETRAS_DE_MOSS.texto, fontSize: 14 },
  flechaSube: { color: MOSS.oro },
  paraHoy: { gap: 14, marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: MOSS.linea },
  punto: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: MOSS.oro, alignSelf: 'flex-start', marginTop: 6 },
  sugerencia: { gap: 3 },
  tipo: { color: MOSS.pergaminoTenue, fontFamily: LETRAS_DE_MOSS.texto, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' },
  notaDeRutina: { color: MOSS.oro, fontFamily: LETRAS_DE_MOSS.texto, fontSize: 15 },
  ejercicio: { gap: 2, paddingVertical: 6, borderTopWidth: 1, borderTopColor: MOSS.linea },
  lista: { gap: 6, marginTop: 6 },
  fila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  anio: { gap: 3 },
  mes: { flexDirection: 'row', gap: 2 },
  dia: { width: 8, height: 8, borderRadius: 2 },
  pildoras: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pildora: { borderWidth: 1, borderColor: MOSS.oroBorde, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  pildoraElegida: { backgroundColor: MOSS.oro, borderColor: MOSS.oro },
  pildoraTexto: { color: MOSS.pergamino, fontFamily: LETRAS_DE_MOSS.texto, fontSize: 13 },
  pildoraTextoElegida: { color: MOSS.noche0 },
  meta: { gap: 4, paddingVertical: 6, borderTopWidth: 1, borderTopColor: MOSS.linea },
  campo: { flex: 1, minHeight: 44, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1, borderColor: MOSS.oroBorde, color: MOSS.pergamino, fontFamily: LETRAS_DE_MOSS.texto, fontSize: 15 },
  boton: { minHeight: 44, paddingHorizontal: 20, borderRadius: 999, backgroundColor: MOSS.oro, alignItems: 'center', justifyContent: 'center' },
  botonTexto: { color: MOSS.noche0, fontFamily: LETRAS_DE_MOSS.texto, fontSize: 15 },
  razon: { gap: 6, paddingTop: 8 },
  raya: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: MOSS.pergamino },
  semanas: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 44 },
  semana: { flex: 1, maxWidth: 14 },
  semanaAntes: { backgroundColor: MOSS.oroClaro },
  semanaAhora: { borderWidth: 1, borderColor: MOSS.oro },
  divisor: { width: 1, alignSelf: 'stretch', marginHorizontal: 4, backgroundColor: MOSS.linea },
});
