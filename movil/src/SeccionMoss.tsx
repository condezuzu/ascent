import { useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { T } from '@nucleo/textos';
import { conComa, pesoCorto } from '@nucleo/peso';
import { dentroDeLaSemana, proximaSesion, FRANJA, PUNTAJE_TOPE, type EstadoDelPuntaje } from '@nucleo/puntajeMuscular';
import { COLORES_DEL_ANIO, POCAS_PESADAS, PROTEINA_POR_KG, SUENO_POCO, UMBRAL_DE_ASCENT, type Razon } from '@nucleo/progresoCompartido';
import { sesionesDelEjercicio } from '@nucleo/semanaMuscular';
import CuerpoDeMoss from './CuerpoDeMoss';
import { MOSS } from './coloresDeMoss';
import { LETRAS_DE_MOSS } from './fuentes';
import { Text, TextInput } from './Texto';
import Tocable from './Tocable';
import { supabase } from './supabase';
import type { SeccionMoss as Datos, Estancado } from './useSeccionMoss';

const S = () => T.moss.sec;
const COLOR: Record<EstadoDelPuntaje, string> = { sinEntrenar: MOSS.musculoSin, poco: MOSS.musculoPoco, enSuPunto: MOSS.oro, mucho: MOSS.terracota };
const nombre = (m: string) => S().musculos[m] ?? m;

function Bloque({ titulo, children, base, testID }: { titulo: string; children: React.ReactNode; base?: readonly string[]; testID?: string }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <View style={e.bloque} testID={testID}>
      <Text style={e.etiqueta}>{titulo}</Text>
      {children}
      {base && (
        <>
          <Text style={e.enlace} onPress={() => setAbierto((a) => !a)} accessibilityRole="button">
            {S().enQueSeBasa}
          </Text>
          {abierto && base.map((t) => <Text key={t.slice(0, 24)} style={e.base}>{t}</Text>)}
        </>
      )}
    </View>
  );
}

/** La barra del puntaje: de 0 a 200, con la franja «en su punto» (70–130) marcada y lo hecho lleno. */
function Barra({ puntaje, estado }: { puntaje: number; estado: EstadoDelPuntaje }) {
  const pct = (n: number) => `${(Math.min(n, PUNTAJE_TOPE) / PUNTAJE_TOPE) * 100}%` as const;
  return (
    <View style={e.barra}>
      <View style={[e.franja, { left: pct(FRANJA.desde), width: pct(FRANJA.hasta - FRANJA.desde) }]} />
      <View style={[e.lleno, { width: pct(puntaje), backgroundColor: COLOR[estado] }]} />
    </View>
  );
}

function cuandoVuelve(dias: number, hoy: string): string {
  if (dias <= 1) return S().fatigados.vuelve(S().fatigados.manana);
  if (dias === 2) return S().fatigados.vuelve(S().fatigados.pasado);
  const d = new Date(`${hoy}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return S().fatigados.vuelveEl(T.fechas.diasLargos[d.getUTCDay()].toLowerCase());
}

/** El detalle de un músculo tocado: sus partes, sus ejercicios de la semana con la reserva, y la próxima. */
function Detalle({ m, datos }: { m: string; datos: Datos }) {
  const del = datos.musculos.get(m);
  const semana = datos.recientes.filter((x) => (x.principal.includes(m) || x.ayuda.includes(m)) && dentroDeLaSemana(x.fecha, datos.hoy));
  const ids = [...new Set(semana.map((x) => x.id))];
  const partes = del ? Object.entries(del.partes) : [];
  return (
    <View testID="moss-detalle" style={e.detalle}>
      <Text style={e.grande}>{nombre(m)}</Text>
      <Text style={e.chico}>{S().tus.series(Math.round((del?.series ?? 0) * 10) / 10)}</Text>
      {partes.length > 0 && (
        <View style={e.lista}>
          <Text style={e.sub}>{S().tus.partesTitulo}</Text>
          {partes.map(([p, n]) => (
            <Text key={p} style={e.linea}>{`${S().tus.partes[p] ?? p}: ${Math.round(n * 10) / 10}`}</Text>
          ))}
        </View>
      )}
      <Text style={e.sub}>{S().tus.ejercicios}</Text>
      {ids.length === 0 && <Text style={e.linea}>{S().tus.sinEjercicios}</Text>}
      {ids.map((id) => {
        const series = semana.filter((x) => x.id === id).flatMap((x) => x.series);
        const rirs = series.map((x) => x.rir).filter((r): r is number => r != null);
        const alFallo = rirs.filter((r) => r === 0).length;
        const esAyuda = !semana.find((x) => x.id === id)?.principal.includes(m);
        const p = proximaSesion({ sesiones: sesionesDelEjercicio(datos.recientes, id), tope: datos.objetivos[id] ?? null, nocheCortaHoy: datos.nocheCortaHoy });
        const proxima = p.decision === 'subir' ? S().tus.proxima.subir : p.decision === 'noSeSabe' ? S().tus.proxima.pocasSesiones : p.razon === 'faltaElTope' ? S().tus.proxima.faltaElTope(datos.objetivos[id] ?? 0) : p.razon === 'sueno' ? S().tus.proxima.sueno : S().tus.proxima.sinObjetivo;
        return (
          <View key={id} style={e.ejercicio}>
            <Text style={e.linea}>{datos.nombres[id] ?? id}</Text>
            <Text style={e.chico}>
              {[S().tus.duras(series.length), alFallo ? S().tus.alFallo(alFallo) : null, rirs.length ? S().tus.rir(Math.min(...rirs), Math.max(...rirs)) : null, esAyuda ? S().tus.ayuda : null].filter(Boolean).join(' · ')}
            </Text>
            {!esAyuda && <Text testID={`moss-proxima-${id}`} style={e.proxima}>{proxima}</Text>}
          </View>
        );
      })}
    </View>
  );
}

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
        return (
          <View key={m.id} style={e.meta}>
            <Text style={e.linea}>{`${m.nombre} · ${S().metas.objetivo(pesoCorto(m.kilos, 'kg'), m.reps)}`}</Text>
            {m.nivel !== null && <Text style={e.chico}>{S().metas.nivel(Math.min(100, Math.round((m.nivel / meta) * 100)))}</Text>}
            <Text style={e.chico}>
              {p.estado === 'lograda' ? S().metas.lograda : p.estado === 'noSeSabe' ? S().metas.noSeSabe : p.estado === 'noSube' ? S().metas.noSube : p.semanas[1] === null ? S().metas.enCaminoAbierto(p.semanas[0]) : S().metas.enCamino(p.semanas[0], p.semanas[1])}
            </Text>
            {p.estado === 'enCamino' && !p.realista && <Text style={e.chico}>{S().metas.lejana}</Text>}
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
    <View style={e.barra}>
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
      <View style={e.leyenda}>
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
      {!est.length ? (
        <Text style={e.linea}>{P.ninguno}</Text>
      ) : (
        <>
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
        </>
      )}
    </Bloque>
  );
}

/**
 * LA SECCIÓN DE MOSS EN ASCENT (19/11, spec/musculos-compartido.md): igual que la de Ascent en Moss —la misma
 * información, el mismo orden, los mismos textos— con la cara de Moss. Se llega abajo de todo, a «Tus músculos», y
 * se sube: fatigados, tu año, estancados, por qué y metas.
 */
export default function SeccionMoss({ datos, alDesvincular, alCambiar, alAbrirTutorial }: { datos: Datos; alDesvincular: () => void; alCambiar: () => void; alAbrirTutorial: () => void }) {
  const lista = useRef<ScrollView>(null);
  const [elegido, setElegido] = useState<string | null>(null);
  const musculos = [...datos.musculos].filter(([, x]) => x.series > 0).sort((a, b) => a[1].puntaje - b[1].puntaje);
  const fatigados = [...datos.musculos].filter(([, x]) => x.vuelveEn > 0).sort((a, b) => b[1].vuelveEn - a[1].vuelveEn);
  const anio = datos.hoy.slice(0, 4);
  return (
    <ScrollView ref={lista} testID="moss-vinculada" style={StyleSheet.absoluteFill} contentContainerStyle={e.contenido} onContentSizeChange={() => lista.current?.scrollToEnd({ animated: false })}>
      <View style={e.arriba}>
        <Text style={e.titulo}>{T.moss.vinculada}</Text>
        <Tocable onPress={alAbrirTutorial} style={e.ayuda} accessibilityRole="button" accessibilityLabel={S().tutorial.abrir} testID="moss-tutorial-abrir">
          <Text style={e.ayudaTexto}>!</Text>
        </Tocable>
      </View>
      <Text testID="moss-desvincular" style={e.desvincular} onPress={alDesvincular} accessibilityRole="button">{T.moss.desvincular}</Text>

      <Metas datos={datos} alCambiar={alCambiar} />

      <PorQue est={datos.estancados} />

      <Bloque titulo={S().estancados.titulo} base={S().baseDe.estancados} testID="moss-estancados">
        <Text style={e.chico}>{S().estancados.texto(UMBRAL_DE_ASCENT)}</Text>
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
            <View key={g} style={e.leyenda}>
              <View style={[e.dia, { backgroundColor: COLORES_DEL_ANIO[g] }]} />
              <Text style={e.chico}>{S().anio.grupos[g]}</Text>
            </View>
          ))}
          <View style={e.leyenda}>
            <View style={[e.dia, { backgroundColor: MOSS.musculoSin }]} />
            <Text style={e.chico}>{S().anio.descanso}</Text>
          </View>
        </View>
      </Bloque>

      <Bloque titulo={S().fatigados.titulo} base={S().baseDe.fatigados} testID="moss-fatigados">
        {fatigados.length === 0 ? (
          <Text style={e.linea}>{S().fatigados.ninguno}</Text>
        ) : (
          <>
            <Text style={e.chico}>{S().fatigados.texto}</Text>
            {fatigados.map(([m, x]) => (
              <View key={m} style={e.fila}>
                <Text style={e.linea}>{nombre(m)}</Text>
                <Text style={e.chico}>{cuandoVuelve(x.vuelveEn, datos.hoy)}</Text>
              </View>
            ))}
          </>
        )}
      </Bloque>

      <Bloque titulo={S().tus.titulo} base={S().baseDe.musculos} testID="moss-tus-musculos">
        <View style={e.cuerpo}>
          <CuerpoDeMoss musculos={datos.musculos} elegido={elegido} alTocar={(m) => setElegido((x) => (x === m ? null : m))} />
        </View>
        {elegido ? (
          <>
            <Detalle m={elegido} datos={datos} />
            <Text style={e.enlace} onPress={() => setElegido(null)} accessibilityRole="button">{S().tus.lista}</Text>
          </>
        ) : musculos.length === 0 ? (
          <Text style={e.linea}>{S().tus.sinDatos}</Text>
        ) : (
          <>
            <Text style={e.chico}>{S().tus.toca}</Text>
            {musculos.map(([m, x]) => (
              <Tocable key={m} onPress={() => setElegido(m)} style={e.musculo} accessibilityRole="button" accessibilityLabel={`${nombre(m)}: ${x.puntaje} de 200, ${S().tus.estados[x.estado]}`} testID={`moss-barra-${m}`}>
                <Text style={e.musculoNombre}>{nombre(m)}</Text>
                <Barra puntaje={x.puntaje} estado={x.estado} />
                <Text style={e.musculoNum}>{x.puntaje}</Text>
              </Tocable>
            ))}
            <Text style={e.chico}>{S().tus.franja}</Text>
          </>
        )}
        <View style={e.lista}>
          <Text style={e.sub}>{S().tus.rutinaTitulo}</Text>
          {datos.nota ? (
            <>
              <Text testID="moss-nota" style={e.grande}>{S().tus.nota[datos.nota.nota]}</Text>
              {datos.nota.mejoras.map((x) => (
                <Text key={`${x.musculo}-${x.que}`} style={e.linea}>
                  {x.que === 'frecuencia' ? S().tus.frecuencia(nombre(x.musculo).toLowerCase()) : x.que === 'pocasSeries' ? S().tus.pocasSeries(nombre(x.musculo).toLowerCase(), Math.round(datos.musculos.get(x.musculo)?.series ?? 0)) : S().tus.muchasSeries(nombre(x.musculo), Math.round(datos.musculos.get(x.musculo)?.series ?? 0))}
                </Text>
              ))}
            </>
          ) : (
            <Text style={e.linea}>{S().tus.sinRutina}</Text>
          )}
        </View>
        <Text style={e.chico}>{S().tus.anotas}</Text>
      </Bloque>
    </ScrollView>
  );
}

const e = StyleSheet.create({
  contenido: { flexGrow: 1, justifyContent: 'flex-end', paddingHorizontal: 24, paddingTop: 70, paddingBottom: 120 },
  arriba: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  titulo: { color: MOSS.pergamino, fontFamily: LETRAS_DE_MOSS.titulo, fontSize: 30, textAlign: 'center' },
  ayuda: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: MOSS.oroBorde, alignItems: 'center', justifyContent: 'center' },
  ayudaTexto: { color: MOSS.oro, fontFamily: LETRAS_DE_MOSS.texto, fontSize: 15 },
  desvincular: { color: MOSS.pergaminoTenue, fontFamily: LETRAS_DE_MOSS.texto, fontSize: 13, textAlign: 'center', paddingVertical: 10, marginBottom: 6 },
  bloque: { gap: 10, paddingVertical: 22, borderTopWidth: 1, borderTopColor: MOSS.linea },
  etiqueta: { color: MOSS.oro, fontFamily: LETRAS_DE_MOSS.texto, fontSize: 12, letterSpacing: 2.6, textTransform: 'uppercase' },
  grande: { color: MOSS.pergamino, fontFamily: LETRAS_DE_MOSS.texto, fontSize: 24, lineHeight: 30 },
  sub: { color: MOSS.oroClaro, fontFamily: LETRAS_DE_MOSS.texto, fontSize: 13, marginTop: 4 },
  linea: { color: MOSS.pergamino, fontFamily: LETRAS_DE_MOSS.texto, fontSize: 15, lineHeight: 21 },
  chico: { color: MOSS.pergaminoTenue, fontFamily: LETRAS_DE_MOSS.texto, fontSize: 13, lineHeight: 18 },
  base: { color: MOSS.pergaminoTenue, fontFamily: LETRAS_DE_MOSS.texto, fontSize: 13, lineHeight: 19 },
  enlace: { color: MOSS.oro, fontFamily: LETRAS_DE_MOSS.texto, fontSize: 14, textDecorationLine: 'underline', alignSelf: 'flex-start', paddingVertical: 4 },
  proxima: { color: MOSS.oroClaro, fontFamily: LETRAS_DE_MOSS.texto, fontSize: 14, lineHeight: 20 },
  cuerpo: { alignItems: 'center', paddingVertical: 6 },
  musculo: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 36 },
  musculoNombre: { width: 96, color: MOSS.pergamino, fontFamily: LETRAS_DE_MOSS.texto, fontSize: 14 },
  musculoNum: { width: 34, textAlign: 'right', color: MOSS.pergaminoTenue, fontFamily: LETRAS_DE_MOSS.texto, fontSize: 13 },
  barra: { flex: 1, height: 10, borderRadius: 999, backgroundColor: MOSS.linea, overflow: 'hidden' },
  franja: { position: 'absolute', top: 0, bottom: 0, borderLeftWidth: 1, borderRightWidth: 1, borderColor: MOSS.pergaminoTenue },
  lleno: { height: '100%', borderRadius: 999 },
  detalle: { gap: 8 },
  ejercicio: { gap: 2, paddingVertical: 6, borderTopWidth: 1, borderTopColor: MOSS.linea },
  lista: { gap: 6, marginTop: 6 },
  fila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  anio: { gap: 3 },
  mes: { flexDirection: 'row', gap: 2 },
  dia: { width: 8, height: 8, borderRadius: 2 },
  leyenda: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pildoras: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pildora: { borderWidth: 1, borderColor: MOSS.oroBorde, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  pildoraElegida: { backgroundColor: MOSS.oro, borderColor: MOSS.oro },
  pildoraTexto: { color: MOSS.pergamino, fontFamily: LETRAS_DE_MOSS.texto, fontSize: 13 },
  pildoraTextoElegida: { color: MOSS.noche0 },
  meta: { gap: 2, paddingVertical: 6, borderTopWidth: 1, borderTopColor: MOSS.linea },
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
  cuadro: { width: 10, height: 10 },
});
