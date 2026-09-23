import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import Svg, { Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';
import { puntoMasCercano, trazarSerie } from '@nucleo/tendencia';
import { faltanPasos } from '@nucleo/pasos';
import { DIAS_SEMANA, aISO, deISO, fechaLinda } from '@nucleo/fechas';
import { T } from '@nucleo/textos';
import Hoja from './Hoja';
import MetaDePasos from './ajustes/MetaDePasos';
import { C, conAlfa } from './colores';

/**
 * LOS PASOS, COMO TENDENCIA. El mismo gráfico que el del peso —la misma media
 * móvil de siete días, las mismas tres ventanas, el mismo arrastrar el dedo
 * para leer un día— con la cuenta compartida de `nucleo/tendencia.ts`.
 *
 * TODOS LOS DÍAS, NO SOLO LOS DE ENTRENAMIENTO. Era el pedido, y además es lo
 * único que tiene sentido: los pasos no son una métrica de gimnasio, son
 * cuánto te moviste. Un domingo de 14.000 pasos es información; esconderlo
 * porque no fue día de fuerza sería mirar para otro lado.
 *
 * Y NO CUENTAN COMO ENTRENAMIENTO, que es la otra mitad de lo mismo y está
 * dicho en pantalla. Un día de gimnasio de fuerza puede tener 2.000 pasos.
 * `plataforma/salud.ts` tiene el porqué largo: los entrenamientos de Health
 * son la señal honesta de "fuiste", los pasos se muestran y no deciden nada.
 *
 * LOS HUECOS NO SON CEROS. Un día sin el teléfono encima no llega en la serie,
 * y la línea lo cruza en vez de bajar a cero: bajar a cero sería afirmar que
 * no caminaste. Es la misma regla que el peso, donde los días sin anotar
 * tampoco existen.
 */

const ALTO = 84;
const VENTANA = 7;

/**
 * LAS TRES VENTANAS, Y LA SEMANA NO ES UNA LÍNEA (25/9).
 *
 * *"Cambiá la vista por ventana: en SEMANA, siete barras, una por día. En MES
 * y AÑO dejá el gráfico de línea como está ahora."* Y la razón está adentro
 * del pedido: en siete días la media móvil de siete días es UN punto. La línea
 * suavizada no puede decir nada de una semana, porque lo que hace es borrar
 * exactamente esa escala. Siete barras contestan la pregunta que se hace
 * mirando una semana —*"¿qué días caminé?"*— y la línea contesta la otra —*"¿voy
 * para arriba o para abajo?"*—, que solo existe con meses.
 *
 * Eran las tres del peso (mes, tres meses, todo) por parecido de pantalla, y
 * el parecido era lo único que las sostenía.
 */
const RANGOS: { dias: number; etiqueta: () => string }[] = [
  { dias: 7, etiqueta: () => T.stats.pasosSemana },
  { dias: 30, etiqueta: () => T.stats.pasosMes },
  { dias: 365, etiqueta: () => T.stats.pasosAno },
];

/** Con punto cada tres cifras: 12.480 se lee de un vistazo y 12480 no. */
const conMiles = (n: number) => Math.round(n).toLocaleString('es-UY');

export default function GraficoPasos({
  pasos,
  claro,
  meta,
  alCambiarMeta,
}: {
  pasos: { fecha: string; valor: number }[];
  /** El `--pal-claro` de la web: la paleta del rango. */
  claro: string;
  /** La meta diaria, para la línea y para el "te faltan". */
  meta: number;
  /** Se avisa al cambiarla desde acá: la línea punteada se mueve en el acto. */
  alCambiarMeta?: (meta: number) => void;
}) {
  // ARRANCA EN LA SEMANA: es la ventana en la que la meta del día significa
  // algo. En un año, "te faltan 2.588" habla de un punto perdido en 365.
  const [rango, setRango] = useState<number>(7);
  const [tocado, setTocado] = useState<number | null>(null);
  const [ancho, setAncho] = useState(0);
  const [cambiandoMeta, setCambiandoMeta] = useState(false);

  // LOS SIETE DÍAS, uno por barra, con los huecos en su lugar. Se arma desde la
  // fecha y no tomando los últimos siete de la serie: un día sin dato NO viene
  // en `pasos`, así que "los últimos siete" podría abarcar tres semanas.
  const semana = (() => {
    const porFecha = new Map(pasos.map((p) => [p.fecha, p.valor]));
    const hoy = pasos.length ? deISO(pasos[pasos.length - 1].fecha) : new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(hoy);
      d.setDate(d.getDate() - (6 - i));
      const fecha = aISO(d);
      // `undefined` y no 0: un día sin el teléfono encima no es un día sin
      // caminar, y una barra en cero afirmaría lo segundo.
      return { fecha, valor: porFecha.get(fecha), letra: DIAS_SEMANA[d.getDay()] };
    });
  })();

  // LA LUZ MÍNIMA ES 1 Y NO 0,4: acá la unidad es un paso, y cuatro décimas de
  // paso no existen. Solo hace falta que una serie perfectamente plana no
  // divida por cero.
  const trazo = ancho > 0 ? trazarSerie(pasos, rango, ancho, ALTO, VENTANA, 1) : null;
  const serie = trazo?.serie ?? [];
  const alMover = (e: GestureResponderEvent) => {
    if (ancho > 0 && serie.length > 1) setTocado(puntoMasCercano(e.nativeEvent.locationX / ancho, serie.length));
  };
  // DÓNDE CAE LA META EN EL DIBUJO. `trazarSerie` no devuelve la escala —los
  // bordes son de dibujo y mostrarlos como datos fue un error viejo— así que se
  // deduce de dos puntos que sí devuelve: con dos valores suavizados y sus dos
  // alturas, la recta que los une da cualquier otro.
  const yMeta = (() => {
    if (!trazo || trazo.serie.length < 2) return null;
    const a = trazo.serie[0].suave;
    const b = trazo.serie[trazo.serie.length - 1].suave;
    if (Math.abs(a - b) < 1e-6) return null;
    const ya = trazo.puntos[0].y;
    const yb = trazo.puntos[trazo.puntos.length - 1].y;
    const y = ya + ((meta - a) * (yb - ya)) / (b - a);
    return y >= 2 && y <= ALTO - 2 ? y : null;
  })();

  /** El último día con dato: es "hoy" para la meta. */
  const ultimoDia = pasos.length ? pasos[pasos.length - 1].valor : 0;
  const falta = faltanPasos(ultimoDia, meta);

  const elegido = tocado === null || !trazo ? null : serie[tocado];
  const posElegido = tocado === null || !trazo ? null : trazo.puntos[tocado];
  const ultimo = trazo?.puntos[trazo.puntos.length - 1];

  // ---- LA SEMANA: SIETE BARRAS ----
  if (rango === 7) {
    // La escala la manda el día más alto O la meta, lo que sea mayor: si la
    // meta quedara fuera del dibujo, la línea no tendría dónde caer y la barra
    // más alta parecería haber llegado.
    const tope = Math.max(meta, ...semana.map((d) => d.valor ?? 0), 1);
    const yMetaBarras = ALTO - (meta / tope) * ALTO;
    return (
      <View style={estilos.grafico}>
        <View style={[estilos.lienzo, estilos.barras]}>
          {/* LA META CRUZA LAS SIETE, como en el trazo: es la referencia, no
              una barra más. */}
          <View
            style={[estilos.metaBarras, { top: yMetaBarras, backgroundColor: claro }]}
            pointerEvents="none"
          />
          {semana.map((d) => {
            const alto = d.valor === undefined ? 0 : Math.max(2, (d.valor / tope) * ALTO);
            const llego = (d.valor ?? 0) >= meta;
            return (
              <View key={d.fecha} style={estilos.columna}>
                <View
                  style={[
                    estilos.barra,
                    { height: alto, backgroundColor: llego ? claro : conAlfa(claro, 0.3) },
                    // SIN DATO NO ES CERO: no se dibuja nada, ni siquiera el
                    // hilo mínimo. Un día sin el teléfono encima no es un día
                    // sin caminar.
                    d.valor === undefined && estilos.sinDato,
                  ]}
                />
              </View>
            );
          })}
        </View>
        <View style={estilos.letras}>
          {semana.map((d) => (
            <Text key={d.fecha} style={estilos.letra}>
              {d.letra}
            </Text>
          ))}
        </View>
        <View style={estilos.pie}>
          <Text style={estilos.hoy}>{T.stats.pasosDia(conMiles(ultimoDia))}</Text>
          <Text style={estilos.cambio}>
            {falta === null ? T.stats.pasosLlegaste : T.stats.pasosFaltan(conMiles(falta))}
          </Text>
        </View>
        <Ventanas rango={rango} claro={claro} alElegir={(d) => { setRango(d); setTocado(null); }} />
        <PieDeMeta
          meta={meta}
          claro={claro}
          promedio={promedioDe(semana.map((d) => d.valor).filter((v): v is number => v !== undefined))}
          alTocar={() => setCambiandoMeta(true)}
        />
        <HojaDeMeta
          visible={cambiandoMeta}
          alCerrar={() => setCambiandoMeta(false)}
          alCambiar={alCambiarMeta}
        />
      </View>
    );
  }

  return (
    <View style={estilos.grafico}>
      <View
        style={estilos.lienzo}
        onLayout={(e) => setAncho(e.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderTerminationRequest={() => false}
        onResponderGrant={alMover}
        onResponderMove={alMover}
        onResponderRelease={() => setTocado(null)}
        onResponderTerminate={() => setTocado(null)}
      >
        {/* Nada de lo dibujado recibe el toque: `locationX` se mide contra la
            vista que toca el dedo, y si fuera un punto daría otra x. */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {trazo && (
            <Svg width={ancho} height={ALTO}>
              <Defs>
                {/* El `id` es otro que el del peso A PROPÓSITO: los dos gráficos
                    viven en la misma pantalla, y un `id` repetido lo resuelve
                    el motor de SVG callado y mal —el segundo degradado se
                    dibuja con la definición del primero—. Es la misma trampa
                    que documenta `compartido/insignias.ts`. */}
                <LinearGradient id="pasos-relleno" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={claro} stopOpacity={0.18} />
                  <Stop offset="1" stopColor={claro} stopOpacity={0} />
                </LinearGradient>
              </Defs>
              {/* LA META, como línea punteada. Va DETRÁS del trazo: es la
                  referencia contra la que se mira la línea, no un dato más.
                  Solo se dibuja si cae adentro del gráfico — con una meta muy
                  arriba de lo que caminás, una línea pegada al borde no dice
                  nada y encima achicaría la escala de todo lo demás. */}
              {yMeta !== null && (
                <Line
                  x1={0}
                  y1={yMeta}
                  x2={ancho}
                  y2={yMeta}
                  stroke={claro}
                  strokeWidth={0.8}
                  strokeDasharray="3 4"
                  opacity={0.35}
                />
              )}
              <Path d={trazo.area} fill="url(#pasos-relleno)" />
              <Path
                d={trazo.linea}
                fill="none"
                stroke={claro}
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {posElegido && (
                <Line
                  x1={posElegido.x}
                  y1={0}
                  x2={posElegido.x}
                  y2={ALTO}
                  stroke={claro}
                  strokeWidth={1}
                  opacity={0.45}
                />
              )}
            </Svg>
          )}
          {ultimo && <Punto x={ultimo.x} y={ultimo.y} color={claro} aro={conAlfa(C.fondo, 0.65)} />}
          {posElegido && <Punto x={posElegido.x} y={posElegido.y} color={claro} aro={conAlfa(claro, 0.22)} />}
        </View>
      </View>

      {trazo &&
        (elegido ? (
          <View style={estilos.pie}>
            <Text style={estilos.cuando}>{fechaLinda(elegido.fecha)}</Text>
            {/* EL CRUDO DE ESE DÍA, no el suavizado: la pregunta que hace el
                dedo es "cuántos pasos di ese día". */}
            <Text style={estilos.hoy}>{T.stats.pasosDia(conMiles(elegido.valor))}</Text>
          </View>
        ) : (
          <View style={estilos.pie}>
            <Text style={estilos.hoy}>{T.stats.pasosDia(conMiles(ultimoDia))}</Text>
            {/* En el peso acá va el CAMBIO con signo; en los pasos va el
                promedio. Un "+300 pasos" contra el primer día de la ventana no
                dice nada —los pasos no tienen una dirección buena—, y en cambio
                cuánto caminás por día es exactamente lo que se viene a mirar. */}
            {/* LO QUE FALTA, que es lo que se vino a mirar. El promedio de la
                ventana pasó al rótulo de abajo: sigue siendo cierto y deja de
                competir con la pregunta del día. */}
            <Text style={estilos.cambio}>
              {falta === null ? T.stats.pasosLlegaste : T.stats.pasosFaltan(conMiles(falta))}
            </Text>
          </View>
        ))}

      <Ventanas rango={rango} claro={claro} alElegir={(d) => { setRango(d); setTocado(null); }} />

      <Text style={estilos.nota}>
        {T.stats.pasosPromedio(
          trazo?.dias ?? 0,
          conMiles(trazo ? trazo.serie.reduce((a, p) => a + p.valor, 0) / trazo.serie.length : 0)
        )}
      </Text>
      <PieDeMeta meta={meta} claro={claro} alTocar={() => setCambiandoMeta(true)} />
      <HojaDeMeta
        visible={cambiandoMeta}
        alCerrar={() => setCambiandoMeta(false)}
        alCambiar={alCambiarMeta}
      />
      <Text style={estilos.nota}>{T.stats.pasosNota}</Text>
    </View>
  );
}

/** El promedio de los días QUE TIENEN dato. Sin ninguno, cero. */
function promedioDe(valores: number[]): number {
  return valores.length ? valores.reduce((a, v) => a + v, 0) / valores.length : 0;
}

/** Las tres ventanas, iguales en los dos dibujos. */
function Ventanas({
  rango,
  claro,
  alElegir,
}: {
  rango: number;
  claro: string;
  alElegir: (dias: number) => void;
}) {
  return (
    <View style={estilos.rangos}>
      {RANGOS.map((r) => {
        const activo = r.dias === rango;
        return (
          <Pressable key={r.dias} hitSlop={8} onPress={() => alElegir(r.dias)}>
            <Text
              style={[
                estilos.rango,
                activo && { color: claro, borderBottomWidth: 1, borderColor: conAlfa(claro, 0.45) },
              ]}
            >
              {r.etiqueta()}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * LA META, QUE ES UN BOTÓN.
 *
 * *"Falta poder elegir MI meta de pasos diarios. No la encuentro."* Estaba —en
 * Ajustes, debajo de Salud— y ese es el problema: a dos pantallas y cuatro
 * toques de la única pantalla donde el número significa algo. Una preferencia
 * se busca donde se ve su efecto, no en la lista de preferencias.
 *
 * SE QUEDA TAMBIÉN EN AJUSTES: es la misma pieza, montada en dos lados. Quien
 * la busque donde van las preferencias también la va a encontrar.
 */
function PieDeMeta({
  meta,
  claro,
  promedio,
  alTocar,
}: {
  meta: number;
  claro: string;
  promedio?: number;
  alTocar: () => void;
}) {
  return (
    <>
      {promedio !== undefined && (
        <Text style={estilos.nota}>{T.stats.pasosPorDiaSemana(conMiles(promedio))}</Text>
      )}
      <Pressable onPress={alTocar} hitSlop={8} accessibilityRole="button">
        <Text style={[estilos.nota, estilos.notaBoton, { color: claro }]}>
          {T.stats.pasosMeta(conMiles(meta))}
        </Text>
      </Pressable>
    </>
  );
}

function HojaDeMeta({
  visible,
  alCerrar,
  alCambiar,
}: {
  visible: boolean;
  alCerrar: () => void;
  alCambiar?: (meta: number) => void;
}) {
  return (
    <Hoja visible={visible} alCerrar={alCerrar}>
      <MetaDePasos
        alCambiar={(n) => {
          alCambiar?.(n);
          alCerrar();
        }}
      />
    </Hoja>
  );
}

/**
 * Un punto de 7 px con un aro de 3 px alrededor. En la web el aro es una
 * sombra, que va por FUERA; acá un borde translúcido se mezclaría con el
 * relleno del punto, así que el aro es otra vista, detrás.
 */
function Punto({ x, y, color, aro }: { x: number; y: number; color: string; aro: string }) {
  return (
    <>
      <View style={[estilos.aro, { left: x, top: y, backgroundColor: aro }]} />
      <View style={[estilos.punto, { left: x, top: y, backgroundColor: color }]} />
    </>
  );
}

const estilos = StyleSheet.create({
  grafico: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: C.linea, paddingTop: 26, paddingBottom: 6 },
  lienzo: { height: ALTO },
  punto: {
    position: 'absolute',
    width: 7,
    height: 7,
    marginLeft: -3.5,
    marginTop: -3.5,
    borderRadius: 3.5,
  },
  aro: { position: 'absolute', width: 13, height: 13, marginLeft: -6.5, marginTop: -6.5, borderRadius: 6.5 },
  pie: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 14, marginTop: 16 },
  hoy: { color: C.tinta, fontSize: 30, fontWeight: '300', fontVariant: ['tabular-nums'] },
  cambio: { color: C.apagado, fontSize: 11, letterSpacing: 0.7, fontVariant: ['tabular-nums'] },
  cuando: { flex: 1, color: C.apagado, fontSize: 12 },
  rangos: { flexDirection: 'row', gap: 14, marginTop: 10 },
  rango: { color: C.apagado, fontSize: 12, paddingVertical: 4 },
  nota: { color: C.apagado, fontSize: 11, marginTop: 12, lineHeight: 16 },
  // El de la meta se subraya: es lo unico de este pie que se toca.
  notaBoton: { textDecorationLine: 'underline', paddingVertical: 4 },
  // ---- LA SEMANA, EN BARRAS ----
  barras: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  columna: { flex: 1, justifyContent: 'flex-end', height: ALTO },
  barra: { width: '100%', borderRadius: 2 },
  sinDato: { height: 0 },
  // La linea de la meta cruza las siete, como en el trazo.
  metaBarras: { position: 'absolute', left: 0, right: 0, height: 1, opacity: 0.45 },
  letras: { flexDirection: 'row', gap: 6, marginTop: 8 },
  letra: { flex: 1, textAlign: 'center', color: C.apagado, fontSize: 10 },
});
