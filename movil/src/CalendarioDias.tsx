import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { supabase } from './supabase';
import { miId } from '@compartido/quienSoy';
import { DIAS_SEMANA, MESES, deISO, hoyISO } from '@nucleo/fechas';
import { T } from '@nucleo/textos';
import { cargarMes, celdasDelMes, moverMes, recalcularRacha, type DatosDelMes } from '@compartido/calendario';
import HojaDelDia from './HojaDelDia';
import { C, conAlfa, conTema } from './colores';
import { useTema } from './useTema';
import { Text } from './Texto';
import { L } from './fuentes';
import { R } from './roles';
import Tocable from './Tocable';

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
  useTema();
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
    const uid = await miId(supabase);
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
        <Tocable style={estilos.flecha} onPress={() => mover(-1)} accessibilityLabel={T.calendario.mesAnterior}>
          <Text style={estilos.flechaTexto}>‹</Text>
        </Tocable>
        <Text style={estilos.mes}>{T.calendario.mesYAnio(MESES[ancla.mes], ancla.anio)}</Text>
        <Tocable
          style={[estilos.flecha, esMesActual && { opacity: 0.25 }]}
          onPress={() => mover(1)}
          disabled={esMesActual}
          accessibilityLabel={T.calendario.mesSiguiente}
        >
          <Text style={estilos.flechaTexto}>›</Text>
        </Tocable>
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
                  // CUBIERTO POR UNA VIDA: aro punteado con el color del rango (15/10).
                  c.estado === 'vacio' && mes.vidas?.has(c.fecha) && [estilos.conVida, { borderColor: paleta.claro }],
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
                      c.estado === 'hecho' && { color: C.fondo, fontWeight: '600' },
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
        {(mes.vidas?.size ?? 0) > 0 && (
          <View style={estilos.referencia}>
            <View style={[estilos.muestra, estilos.conVida, { borderColor: paleta.claro }]} />
            <Text style={estilos.referenciaTexto}>{T.calendario.leyendaVida}</Text>
          </View>
        )}
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
      <Tocable onPress={recalcular} disabled={recalculando} hitSlop={8} style={{ marginTop: 10 }}>
        <Text style={estilos.botonTexto}>{recalculando ? T.calendario.recalculando : T.calendario.recalcular}</Text>
      </Tocable>
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

const estilos = conTema(() => StyleSheet.create({
  conVida: { borderWidth: 1.5, borderStyle: 'dashed' },
  calendario: { borderTopWidth: 1, borderColor: C.linea, paddingTop: 20, paddingBottom: 6 },
  cabecera: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 },
  // 44 pt: el mínimo con el que un pulgar acierta.
  flecha: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  flechaTexto: { color: C.sub, fontSize: 20 },
  mes: { ...R.etiqueta, fontFamily: L.dato  },
  grilla: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 10 },
  casilla: { width: `${100 / 7}%`, alignItems: 'center' },
  nombreDia: { color: C.apagado, fontSize: 10, textAlign: 'center', fontFamily: L.dato },
  dia: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  numero: { color: C.sub, fontSize: 12, fontFamily: L.dato },
  guion: { width: 10, height: 2, borderRadius: 1, backgroundColor: C.apagado },
  marca: {
    position: 'absolute',
    bottom: -2,
    width: 5,
    height: 5,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: C.fondo,
  },
  leyenda: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: 18, rowGap: 6, marginTop: 22 },
  referencia: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  muestra: { width: 12, height: 12, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  referenciaTexto: { ...R.etiqueta },
  nota: { ...R.nota, marginTop: 12  },
  botonTexto: { color: C.claro, fontSize: 14 },
  aviso: { color: C.sub, fontSize: 13, marginTop: 8 },
}));
