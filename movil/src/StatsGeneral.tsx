import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { supabase } from './supabase';
import { T } from '@nucleo/textos';
import { deISO, fechaLinda, hoyISO, restarDias } from '@nucleo/fechas';
import { aKilos, conComa, deKilos, limites, type Unidad } from '@nucleo/peso';
import { RANGOS, rangoDeRacha } from '@nucleo/rangos';
import { paletaDe } from '@nucleo/paletas';
import { duracionLinda, type ResumenSesiones } from '@nucleo/sesiones';
import { agruparPorDia, etiquetaDeDia, type DiaConSesiones } from '@nucleo/dias';
import type { Log } from '@nucleo/tipos';
import { plataforma } from '@plataforma';
import { CLAVE_META_PASOS, leerMeta } from '@nucleo/pasos';
import { C } from './colores';
import GraficoPeso from './GraficoPeso';
import GraficoPasos from './GraficoPasos';
import Insignia from './Insignia';
import SeccionFuerza from './SeccionFuerza';
import AnotarPeso from './AnotarPeso';
import ListaDePesos from './ListaDePesos';

/**
 * STATS → GENERAL, lo que va además de los cuatro números. Las mismas
 * secciones y en el mismo orden que la web (`src/app/stats/page.tsx`), con
 * las cuentas del núcleo.
 *
 * EL GRÁFICO DEL PESO Y LAS INSIGNIAS DE LA ESCALERA, iguales a la web desde
 * el 18/9 (`GraficoPeso` e `Insignia`, con la cuenta y los dibujos
 * compartidos).
 *
 * LA FUERZA, también desde el 18/9, entre el peso y la escalera como en la
 * web (`SeccionFuerza`). El aviso de estancamiento va arriba de todo y lo pone
 * `Stats`.
 *
 * LOS PASOS (23/9) son lo único de esta pantalla que NO está en la web, y no
 * por falta de ganas: ningún navegador ve los pasos del teléfono. Van pegados
 * al peso porque son el otro gráfico de la misma clase —una tendencia diaria
 * del cuerpo, no del entrenamiento— y comparten la cuenta
 * (`nucleo/tendencia.ts`). Sin Health o sin permiso, la sección no existe:
 * no se muestra un hueco explicando lo que falta.
 */

export type Vidas = { quedan: number; total: number; vuelve: string | null; falta: number | null };
export type PesoAnotado = { fecha: string; valor: number };

export function LineaDeVidas({ vidas }: { vidas: Vidas }) {
  return (
    <View style={estilos.vidas}>
      <Text style={estilos.et}>{T.impulso.titulo}</Text>
      <View style={estilos.puntos} accessibilityLabel={`${vidas.quedan} de ${vidas.total}`}>
        {Array.from({ length: vidas.total }, (_, i) => (
          <View key={i} style={[estilos.vida, i < vidas.quedan && estilos.vidaViva]} />
        ))}
      </View>
      <Text style={estilos.nota}>
        {T.impulso.nota}
        {vidas.vuelve ? ' ' + T.impulso.vuelve(fechaLinda(vidas.vuelve)) : ''}
        {vidas.falta !== null && vidas.falta > 0 ? ' ' + T.impulso.seGanaEn(vidas.falta) : ''}
      </Text>
    </View>
  );
}

export default function StatsGeneral({
  logs,
  racha,
  rango,
  planeta,
  unidad,
  pesos,
  sexo,
  alCambiar,
}: {
  logs: Log[];
  racha: number;
  rango: number;
  planeta: string | null;
  unidad: Unidad;
  sexo: string | null;
  pesos: PesoAnotado[];
  alCambiar: () => void;
}) {
  const hoy = hoyISO();
  const pal = paletaDe(rango, planeta);

  // LOS PASOS DE APPLE HEALTH. `null` mientras no se sabe y también cuando no
  // hay —sin Health, sin permiso, en un iPad—, que para esta pantalla es lo
  // mismo: no se dibuja nada.
  //
  // UN AÑO, y no la ventana elegida: el botón "Todo" tiene que poder mostrar
  // todo sin volver a preguntarle a Health, y una consulta con los cubos por
  // día cuesta lo mismo por 30 que por 365 (ver `pasosPorDia`). Cambiar de
  // ventana es recortar una serie que ya está en memoria.
  const [pasos, setPasos] = useState<{ fecha: string; valor: number }[] | null>(null);
  const [metaPasos, setMetaPasos] = useState(leerMeta(null));
  useEffect(() => {
    let vivo = true;
    plataforma.almacenamiento
      .leer(CLAVE_META_PASOS)
      .then((m) => {
        if (vivo) setMetaPasos(leerMeta(m));
      })
      .catch(() => {});
    plataforma.salud
      .pasosPorDia(365)
      .then((r) => {
        if (vivo) setPasos(r);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  // EL AÑO: 26 semanas, una columna por semana, de domingo a sábado. La misma
  // cuenta que la web.
  const entrenados = new Set(logs.filter((l) => !l.es_descanso).map((l) => l.fecha));
  const descansos = new Set(logs.filter((l) => l.es_descanso).map((l) => l.fecha));
  const finSemana = restarDias(hoy, deISO(hoy).getDay() - 6);
  const semanas: { fecha: string; clase: 'si' | 'descanso' | 'futuro' | '' }[][] = [];
  for (let i = 26 * 7 - 1; i >= 0; i--) {
    const f = restarDias(finSemana, i);
    const clase = f > hoy ? 'futuro' : entrenados.has(f) ? 'si' : descansos.has(f) ? 'descanso' : '';
    const col = Math.floor((26 * 7 - 1 - i) / 7);
    (semanas[col] ??= []).push({ fecha: f, clase });
  }

  const rangoActual = rangoDeRacha(racha);

  return (
    <View>
      <Text style={estilos.seccion}>{T.stats.elAno}</Text>
      <View style={[estilos.tarjeta, estilos.mapa]}>
        {semanas.map((s, i) => (
          <View key={i} style={estilos.columna}>
            {s.map((c) => (
              <View
                key={c.fecha}
                style={[
                  estilos.celdaAno,
                  c.clase === 'si' && { backgroundColor: pal.claro },
                  c.clase === 'descanso' && { backgroundColor: pal.principal, opacity: 0.25 },
                  c.clase === 'futuro' && { backgroundColor: 'transparent' },
                ]}
              />
            ))}
          </View>
        ))}
      </View>

      <Sesiones />

      {/* Los tres casos de la web: con dos pesos o más, la tendencia; con uno,
          el número solo —decirle "anota tu peso" a quien acaba de anotarlo
          parece un error—; sin ninguno, la invitación. */}
      <Text style={estilos.seccion}>{pesos.length >= 2 ? T.stats.pesoTendencia : T.stats.peso}</Text>
      {pesos.length >= 2 && <GraficoPeso pesos={pesos} unidad={unidad} claro={pal.claro} />}
      {pesos.length === 1 && (
        <Text style={estilos.pesoSolo}>
          {conComa(deKilos(pesos[0].valor, unidad).toFixed(1))}
          <Text style={estilos.unidad}> {unidad}</Text>
        </Text>
      )}
      {pesos.length === 1 && <Text style={estilos.nota}>{T.stats.pesoUnoMas}</Text>}
      {pesos.length === 0 && <Text style={estilos.nota}>{T.stats.pesoVacio}</Text>}
      <AnotarPeso unidad={unidad} alGuardar={alCambiar} />
      <ListaDePesos pesos={pesos} unidad={unidad} alCambiar={alCambiar} />

      {/* LOS PASOS, si el teléfono los tiene. Con menos de dos días no hay
          tendencia que dibujar y no se pone nada: un gráfico de un punto es
          una mancha con un rótulo. */}
      {pasos && pasos.length >= 2 && (
        <>
          <Text style={estilos.seccion}>{T.stats.pasosTendencia}</Text>
          <GraficoPasos pasos={pasos} claro={pal.claro} meta={metaPasos} alCambiarMeta={setMetaPasos} />
        </>
      )}

      {/* La fuerza convive con la racha, no la reemplaza (§16.1): va después
          del peso y antes de la escalera, que es el cierre de la pantalla. El
          peso corporal va en KILOS, que es como está la tabla de estándares. */}
      <SeccionFuerza
        unidad={unidad}
        sexo={sexo}
        pesoCorporal={pesos.length > 0 ? pesos[pesos.length - 1].valor : null}
        claro={pal.claro}
      />

      <Text style={estilos.seccion}>{T.stats.laEscalera}</Text>
      <View style={estilos.tarjeta}>
        {RANGOS.map((r) => {
          const pasado = rangoActual.n > r.n;
          const esActual = rangoActual.n === r.n;
          return (
            <View key={r.n} style={[estilos.filaRango, !esActual && !pasado && { opacity: 0.45 }]}>
              <Insignia rango={r.n} />
              <Text style={[estilos.nombreRango, pasado && { color: C.sub }]}>{r.nombre}</Text>
              {esActual ? (
                <Text style={[estilos.actual, { color: pal.claro }]}>{T.stats.acaEstas}</Text>
              ) : (
                <Text style={estilos.dias}>{T.stats.diaN(r.desde === 0 ? 1 : r.desde)}</Text>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

/** Las duraciones de las sesiones. Pide lo suyo, como `SeccionSesiones` de la web. */
function Sesiones() {
  const [r, setR] = useState<ResumenSesiones | null>(null);
  const [dias, setDias] = useState<DiaConSesiones[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc('resumen_sesiones');
      setR(data as ResumenSesiones | null);
      const { data: filas } = await supabase
        .from('sesiones')
        .select('inicio, fin, estado, series, logs(fecha)')
        .order('inicio', { ascending: false })
        .limit(40);
      setDias(agruparPorDia(filas ?? []).slice(0, 7));
    })();
  }, []);

  if (!r || (r.validas === 0 && r.abandonadas === 0 && r.cortas === 0)) return null;

  const fuera: string[] = [];
  if (r.abandonadas > 0) fuera.push(T.stats.sinDuracion_(r.abandonadas));
  if (r.cortas > 0) fuera.push(T.stats.masCortas(r.cortas));
  const techo = Math.max(1, ...dias.map((d) => d.segundos));

  return (
    <View>
      <Text style={estilos.seccion}>{T.stats.sesiones}</Text>
      {r.validas > 0 ? (
        <View style={estilos.dosNumeros}>
          <View style={estilos.numero}>
            <Text style={estilos.valor}>{duracionLinda(r.promedio_segundos ?? 0)}</Text>
            <Text style={estilos.etiqueta}>{T.stats.promedio}</Text>
          </View>
          <View style={estilos.numero}>
            <Text style={estilos.valor}>{duracionLinda(r.total_segundos)}</Text>
            <Text style={estilos.etiqueta}>{T.stats.totalEn(r.validas)}</Text>
          </View>
        </View>
      ) : (
        <Text style={estilos.nota}>{T.stats.sinDuracion}</Text>
      )}
      {dias.map((d) => (
        <View key={d.fecha} style={estilos.diaSesion}>
          <Text style={[estilos.dato, { width: 70 }]}>{etiquetaDeDia(d.fecha)}</Text>
          <View style={estilos.barra}>
            <View style={[estilos.relleno, { width: `${(d.segundos / techo) * 100}%` }]} />
          </View>
          <Text style={[estilos.dato, { width: 70, textAlign: 'right' }]}>
            {d.segundos > 0 ? duracionLinda(d.segundos) : '—'}
            {d.cuantas > 1 ? ` ×${d.cuantas}` : ''}
          </Text>
        </View>
      ))}
      {fuera.length > 0 && <Text style={estilos.nota}>{T.stats.fueraDelPromedio(fuera.join(', '))}</Text>}
    </View>
  );
}

const estilos = StyleSheet.create({
  seccion: { color: C.sub, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', marginTop: 28, marginBottom: 10 },
  tarjeta: {
    backgroundColor: 'rgba(11,13,19,0.72)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.linea,
    borderRadius: 14,
    padding: 12,
  },
  mapa: { flexDirection: 'row', gap: 2 },
  columna: { flex: 1, gap: 2 },
  celdaAno: { aspectRatio: 1, borderRadius: 2, backgroundColor: C.linea },
  vidas: { marginBottom: 16, gap: 6 },
  et: { color: C.sub, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase' },
  puntos: { flexDirection: 'row', gap: 6 },
  vida: { width: 9, height: 9, borderRadius: 5, borderWidth: 1, borderColor: C.apagado },
  vidaViva: { backgroundColor: C.claro, borderColor: C.claro },
  nota: { color: C.apagado, fontSize: 12, lineHeight: 17, marginTop: 6 },
  dosNumeros: { flexDirection: 'row', gap: 12 },
  numero: { flex: 1 },
  valor: { color: C.tinta, fontSize: 24 },
  etiqueta: { color: C.sub, fontSize: 12, marginTop: 2 },
  diaSesion: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  dato: { color: C.sub, fontSize: 12, fontVariant: ['tabular-nums'] },
  barra: { flex: 1, height: 6, borderRadius: 3, backgroundColor: C.linea, overflow: 'hidden' },
  relleno: { height: 6, borderRadius: 3, backgroundColor: C.principal },
  pesoSolo: { color: C.tinta, fontSize: 32 },
  unidad: { color: C.sub, fontSize: 15 },
  anotar: { flexDirection: 'row', gap: 8, marginTop: 10 },
  campo: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.lineaFuerte,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: C.tinta,
    fontSize: 15,
  },
  botonFantasma: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.lineaFuerte,
    borderRadius: 10,
    paddingHorizontal: 18,
    justifyContent: 'center',
  },
  textoBoton: { color: C.tinta, fontSize: 14 },
  error: { color: C.error, fontSize: 13, marginTop: 6 },
  filaRango: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 },
  nombreRango: { flex: 1, color: C.tinta, fontSize: 15 },
  actual: { fontSize: 12, letterSpacing: 1 },
  dias: { color: C.sub, fontSize: 12 },
});
