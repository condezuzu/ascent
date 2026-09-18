import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { supabase } from './supabase';
import { DIAS_SEMANA, MESES, deISO, hoyISO } from '@nucleo/fechas';
import { T } from '@nucleo/textos';
import { cargarMes, celdasDelMes, moverMes, recalcularRacha, type DatosDelMes } from '@compartido/calendario';
import HojaDelDia from './HojaDelDia';
import { C, conAlfa } from './colores';

/**
 * EL CALENDARIO DE STATS, en la app nativa: uno solo, y se toca para MIRAR.
 * Tocar un día abre su resumen (`HojaDelDia`); corregirlo es un paso aparte
 * adentro. Lo mismo que la web (`src/components/CalendarioDias.tsx`), con lo
 * que se pide y cómo se arma cada celda en `compartido/calendario.ts`.
 *
 * Las formas son las de la web y dicen lo mismo sin color de alarma: relleno
 * es "fui", un aro fino es "sin registrar" —ni rojo ni cruz—, y un guion es
 * descanso, que no puede parecer un fallo. Y van con su referencia abajo:
 * sin ella había que tocar un día para descubrir qué significaba cada forma, y
 * tocar es justo lo que abre la hoja.
 */
export default function CalendarioDias({
  paleta,
  alCambiar,
  porRevisar = new Set(),
  alRevisar,
}: {
  paleta: { principal: string; claro: string };
  alCambiar: () => void;
  /** Días con pesos anotados antes de los modos (migración 39): llevan una marca. */
  porRevisar?: Set<string>;
  alRevisar?: () => void;
}) {
  const hoy = hoyISO();
  const base = deISO(hoy);
  const [ancla, setAncla] = useState({ anio: base.getFullYear(), mes: base.getMonth() });
  const [mes, setMes] = useState<DatosDelMes>({ conLog: new Set(), descansoAMano: new Set(), configs: [] });
  const [abierto, setAbierto] = useState<string | null>(null);
  const [recalculando, setRecalculando] = useState(false);
  const [aviso, setAviso] = useState('');
  // Si se corrigió algo en esta visita. La nota de recalcular aparece recién
  // ahí: antes es una instrucción para algo que nadie hizo.
  const [corrigio, setCorrigio] = useState(false);

  const cargar = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) return;
    setMes(await cargarMes(supabase, uid, ancla.anio, ancla.mes));
  }, [ancla]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const celdas = celdasDelMes(ancla.anio, ancla.mes, hoy, mes);
  const huecos = new Date(ancla.anio, ancla.mes, 1).getDay();
  const esMesActual = ancla.anio === base.getFullYear() && ancla.mes === base.getMonth();

  function mover(delta: number) {
    const siguiente = moverMes(ancla.anio, ancla.mes, delta, hoy);
    if (siguiente) setAncla(siguiente);
  }

  async function recalcular() {
    setRecalculando(true);
    setAviso('');
    const r = await recalcularRacha(supabase);
    setRecalculando(false);
    setAviso(r.texto);
    if (!r.ok) return;
    setCorrigio(false);
    alCambiar();
  }

  const aro = conAlfa(paleta.principal, 0.35);

  return (
    <View style={estilos.calendario}>
      <View style={estilos.cabecera}>
        <Pressable style={estilos.flecha} onPress={() => mover(-1)} accessibilityLabel={T.calendario.mesAnterior}>
          <Text style={estilos.flechaTexto}>‹</Text>
        </Pressable>
        <Text style={estilos.mes}>{T.calendario.mesYAnio(MESES[ancla.mes], ancla.anio)}</Text>
        <Pressable
          style={[estilos.flecha, esMesActual && { opacity: 0.25 }]}
          onPress={() => mover(1)}
          disabled={esMesActual}
          accessibilityLabel={T.calendario.mesSiguiente}
        >
          <Text style={estilos.flechaTexto}>›</Text>
        </Pressable>
      </View>

      <View style={[estilos.grilla, { marginBottom: 14 }]}>
        {DIAS_SEMANA.map((d, i) => (
          <Text key={i} style={[estilos.casilla, estilos.nombreDia]}>
            {d}
          </Text>
        ))}
      </View>

      <View style={estilos.grilla}>
        {Array.from({ length: huecos }).map((_, i) => (
          <View key={`h${i}`} style={estilos.casilla} />
        ))}
        {celdas.map((c) => {
          const esHoy = c.fecha === hoy;
          return (
            <View key={c.fecha} style={estilos.casilla}>
              <Pressable
                onPress={() => setAbierto(c.fecha)}
                disabled={c.estado === 'futuro'}
                accessibilityLabel={T.calendario.verDia(c.dia)}
                style={({ pressed }) => [
                  estilos.dia,
                  c.estado === 'hecho' && { backgroundColor: paleta.principal },
                  c.estado === 'vacio' && { borderColor: aro },
                  esHoy && { borderColor: conAlfa(paleta.claro, 0.6) },
                  pressed && { transform: [{ scale: 0.88 }] },
                ]}
              >
                {c.estado === 'descanso' ? (
                  <View style={estilos.guion} />
                ) : (
                  <Text
                    style={[
                      estilos.numero,
                      c.estado === 'hecho' && { color: '#08080c', fontWeight: '600' },
                      c.estado === 'futuro' && { color: conAlfa(C.apagado, 0.4) },
                    ]}
                  >
                    {c.dia}
                  </Text>
                )}
                {/* Un punto chico abajo: el día se sigue leyendo como lo que es,
                    y la marca solo dice que hay algo para mirar adentro. */}
                {porRevisar.has(c.fecha) && <View style={[estilos.marca, { backgroundColor: paleta.claro }]} />}
              </Pressable>
            </View>
          );
        })}
      </View>

      <View style={estilos.leyenda}>
        <View style={estilos.referencia}>
          <View style={[estilos.muestra, { backgroundColor: paleta.principal }]} />
          <Text style={estilos.referenciaTexto}>{T.calendario.leyendaHecho}</Text>
        </View>
        <View style={estilos.referencia}>
          <View style={[estilos.muestra, { borderWidth: 1, borderColor: aro }]} />
          <Text style={estilos.referenciaTexto}>{T.calendario.leyendaVacio}</Text>
        </View>
        <View style={estilos.referencia}>
          <View style={estilos.muestra}>
            <View style={[estilos.guion, { width: 9 }]} />
          </View>
          <Text style={estilos.referenciaTexto}>{T.calendario.leyendaDescanso}</Text>
        </View>
        {porRevisar.size > 0 && (
          <View style={estilos.referencia}>
            <View style={[estilos.marca, { position: 'relative', bottom: 0, backgroundColor: paleta.claro }]} />
            <Text style={estilos.referenciaTexto}>{T.volumen.leyendaRevisar}</Text>
          </View>
        )}
      </View>

      <Text style={estilos.nota}>{T.calendario.nota}</Text>
      {/* El botón está siempre; la instrucción aparece recién después de
          corregir, que es cuando se entiende para qué es. */}
      {corrigio && <Text style={estilos.nota}>{T.calendario.recalcularNota}</Text>}
      <Pressable onPress={recalcular} disabled={recalculando} hitSlop={8} style={{ marginTop: 10 }}>
        <Text style={estilos.botonTexto}>{recalculando ? T.calendario.recalculando : T.calendario.recalcular}</Text>
      </Pressable>
      {!!aviso && <Text style={estilos.aviso}>{aviso}</Text>}

      {abierto && (
        <HojaDelDia
          fecha={abierto}
          principal={paleta.principal}
          alCambiar={() => {
            setCorrigio(true);
            cargar();
            alCambiar();
          }}
          alRevisar={alRevisar}
          alCerrar={() => setAbierto(null)}
        />
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  calendario: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: C.linea, paddingTop: 20, paddingBottom: 6 },
  cabecera: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 },
  // 44 pt: el mínimo con el que un pulgar acierta.
  flecha: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  flechaTexto: { color: C.sub, fontSize: 20 },
  mes: { color: C.sub, fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', fontVariant: ['tabular-nums'] },
  grilla: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 10 },
  casilla: { width: `${100 / 7}%`, alignItems: 'center' },
  nombreDia: { color: C.apagado, fontSize: 10, letterSpacing: 1, textAlign: 'center' },
  dia: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  numero: { color: C.sub, fontSize: 12, fontVariant: ['tabular-nums'] },
  guion: { width: 10, height: 2, borderRadius: 1, backgroundColor: C.apagado },
  marca: {
    position: 'absolute',
    bottom: -2,
    width: 5,
    height: 5,
    borderRadius: 2.5,
    borderWidth: 1.5,
    borderColor: C.fondo,
  },
  leyenda: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: 18, rowGap: 6, marginTop: 22 },
  referencia: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  muestra: { width: 12, height: 12, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  referenciaTexto: { color: C.apagado, fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase' },
  nota: { color: C.apagado, fontSize: 12, lineHeight: 17, marginTop: 12 },
  botonTexto: { color: C.claro, fontSize: 14 },
  aviso: { color: C.sub, fontSize: 13, marginTop: 8 },
});
