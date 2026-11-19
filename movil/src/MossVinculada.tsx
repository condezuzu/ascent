import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { plataforma } from '@plataforma';
import { T } from '@nucleo/textos';
import { pesoCorto } from '@nucleo/peso';
import {
  fechaDeMoss,
  leerMossAnio,
  leerMossHoy,
  leerMossObjetivo,
  leerMossSemanas,
  queEsperarHoy,
  type MossAnio,
  type MossHoy,
  type MossObjetivo,
  type MossSemana,
} from '@nucleo/mossHoy';
import { miId } from '@compartido/quienSoy';
import { supabase } from './supabase';
import { MOSS } from './coloresDeMoss';
import { LETRAS_DE_MOSS } from './fuentes';
import { Text } from './Texto';

type Datos = { hoy: MossHoy | null; semanas: MossSemana[]; objetivo: MossObjetivo | null; anio: MossAnio | null; entrenoHoy: boolean };

const horas = (min: number) => `${Math.floor(min / 60)} h ${String(Math.round(min % 60)).padStart(2, '0')}`;

/**
 * LO DE MOSS EN ASCENT, VINCULADA (19/11): espejo de la sección de Ascent en Moss, con el estilo de Moss.
 * Se llega abajo de todo, como en Moss: tu noche y tu energía; arriba, hoy según el momento; después la
 * semana; más arriba, el objetivo y el año. Los datos son los de la migración 0015 de Moss: sin ella (o
 * sin vínculo) las funciones no contestan y no se muestra ningún bloque, solo «Vinculada con Moss».
 */
export function useDatosDeMoss(abierta: boolean) {
  const [datos, setDatos] = useState<Datos | null>(null);
  const cargar = useCallback(async () => {
    const fecha = fechaDeMoss(new Date());
    const [hoy, semanas, objetivo, anio, dia] = await Promise.all([
      supabase.schema('moss').rpc('moss_hoy', { p_fecha: fecha }),
      supabase.schema('moss').rpc('moss_semanas', { p_desde: fechaDeMoss(new Date(Date.now() - 27 * 86400_000)) }),
      supabase.schema('moss').rpc('moss_objetivo'),
      supabase.schema('moss').rpc('moss_anio', { p_anio: Number(fecha.slice(0, 4)) }),
      supabase.rpc('mi_hoy'),
    ]).catch(() => [null, null, null, null, null] as const);
    const uid = await miId(supabase);
    const hoyDeAscent = typeof dia?.data === 'string' ? dia.data : null;
    const { count } = uid && hoyDeAscent ? await supabase.from('logs').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('fecha', hoyDeAscent) : { count: 0 };
    setDatos({
      hoy: leerMossHoy(hoy?.error ? null : hoy?.data),
      semanas: leerMossSemanas(semanas?.error ? null : semanas?.data),
      objetivo: leerMossObjetivo(objetivo?.error ? null : objetivo?.data),
      anio: leerMossAnio(anio?.error ? null : anio?.data),
      entrenoHoy: (count ?? 0) > 0,
    });
  }, []);
  useEffect(() => {
    if (!abierta) return;
    void cargar();
    return plataforma.ciclo.alCambiar((visible) => {
      if (visible) void cargar();
    });
  }, [abierta, cargar]);
  return datos;
}

/** ¿Hay algo de Moss para mostrar? Sin la 0015 no. */
export function hayDatosDeMoss(d: Datos | null): d is Datos {
  return !!d && !!(d.hoy?.noche || d.hoy?.comida || d.hoy?.energia || d.semanas.length || d.objetivo || d.anio);
}

function Barra({ valor, meta, raya }: { valor: number; meta: number; raya?: number }) {
  const lleno = Math.max(0, Math.min(1, valor / meta));
  return (
    <View style={estilos.barra}>
      <View style={[estilos.barraLlena, { width: `${lleno * 100}%` }]} />
      {raya !== undefined && <View style={[estilos.raya, { left: `${Math.min(1, raya / meta) * 100}%` }]} />}
    </View>
  );
}

function Fila({ izq, der }: { izq: string; der: string }) {
  return (
    <View style={estilos.fila}>
      <Text style={estilos.filaIzq}>{izq}</Text>
      <Text style={estilos.filaDer}>{der}</Text>
    </View>
  );
}

export default function MossVinculada({ datos, alDesvincular }: { datos: Datos; alDesvincular: () => void }) {
  const lista = useRef<ScrollView>(null);
  const { hoy, semanas, objetivo, anio } = datos;
  const ahora = new Date();
  const esperar = queEsperarHoy(hoy?.comida ?? null, ahora.getHours() * 60 + ahora.getMinutes(), objetivo?.peso ?? null);
  const semana = semanas[semanas.length - 1];
  const comida = hoy?.comida;
  return (
    <ScrollView
      ref={lista}
      testID="moss-vinculada"
      style={StyleSheet.absoluteFill}
      contentContainerStyle={estilos.contenido}
      // Se llega abajo, como en Moss: lo de hoy primero, y para atrás en el tiempo hacia arriba.
      onContentSizeChange={() => lista.current?.scrollToEnd({ animated: false })}
    >
      <Text style={estilos.titulo}>{T.moss.vinculada}</Text>
      <Text testID="moss-desvincular" style={estilos.desvincular} onPress={alDesvincular} accessibilityRole="button">
        {T.moss.desvincular}
      </Text>

      {anio && (
        <View style={estilos.bloque}>
          <Text style={estilos.etiqueta}>{T.moss.tuAnio}</Text>
          <Fila izq={T.moss.diasAnotados} der={String(anio.diasConComida)} />
          {anio.pesoInicio !== null && anio.pesoHoy !== null && <Fila izq={T.moss.pesoDelAnio} der={`${pesoCorto(anio.pesoInicio, 'kg')} → ${pesoCorto(anio.pesoHoy, 'kg')} kg`} />}
        </View>
      )}

      {objetivo && (
        <View style={estilos.bloque}>
          <Text style={estilos.etiqueta}>{T.moss.tuObjetivo}</Text>
          <Fila izq={T.moss.objetivos[objetivo.objetivo]} der={objetivo.pesoMeta !== null ? `${pesoCorto(objetivo.pesoMeta, 'kg')} kg` : ''} />
        </View>
      )}

      {semana && (
        <View style={estilos.bloque}>
          <Text style={estilos.etiqueta}>{T.moss.estaSemana}</Text>
          {semana.dormido !== null && <Fila izq={T.moss.suenoPromedio} der={horas(semana.dormido)} />}
          {semana.proteinaGKg !== null && <Fila izq={T.moss.proteinaPorDia} der={`${pesoCorto(semana.proteinaGKg, 'kg')} g/kg`} />}
          {semana.balance !== null && <Fila izq={T.moss.balancePorDia} der={`${semana.balance > 0 ? '+' : ''}${Math.round(semana.balance)} kcal`} />}
          {semana.peso !== null && <Fila izq={T.moss.peso} der={`${pesoCorto(semana.peso, 'kg')} kg`} />}
        </View>
      )}

      <View style={estilos.bloque}>
        <Text style={estilos.etiqueta}>{datos.entrenoHoy ? T.moss.despuesDeEntrenar : T.moss.antesDeEntrenar}</Text>
        {comida && (
          <>
            <Fila izq={T.moss.proteina} der={comida.meta ? `${Math.round(comida.total.proteina)} / ${Math.round(comida.meta.proteina)} g` : `${Math.round(comida.total.proteina)} g`} />
            {comida.meta && <Barra valor={comida.total.proteina} meta={comida.meta.proteina} />}
            <Fila izq={T.moss.calorias} der={comida.meta ? `${Math.round(comida.total.kcal)} / ${Math.round(comida.meta.kcal)} kcal` : `${Math.round(comida.total.kcal)} kcal`} />
            {comida.meta && <Barra valor={comida.total.kcal} meta={comida.meta.kcal} />}
          </>
        )}
        {!datos.entrenoHoy && esperar.map((e) => (
          <Text key={e} testID={`moss-esperar-${e}`} style={estilos.linea}>
            {T.moss.esperar[e]}
          </Text>
        ))}
      </View>

      {(hoy?.noche || hoy?.energia) && (
        <View style={estilos.bloque}>
          <Text style={estilos.etiqueta}>{T.moss.tuNoche}</Text>
          {hoy?.noche && (
            <>
              <Fila izq={T.moss.dormiste} der={`${horas(hoy.noche.dormido)} / ${horas(hoy.noche.necesidad)}`} />
              {/* La raya de las 6 h, como en Moss. */}
              <Barra valor={hoy.noche.dormido} meta={hoy.noche.necesidad} raya={360} />
              {hoy.noche.deudaPalabra && <Fila izq={T.moss.deuda} der={T.moss.deudas[hoy.noche.deudaPalabra]} />}
            </>
          )}
          {hoy?.energia && <Fila izq={T.moss.energia} der={T.moss.energias[hoy.energia]} />}
        </View>
      )}

    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  contenido: { flexGrow: 1, justifyContent: 'flex-end', paddingHorizontal: 28, paddingTop: 90, paddingBottom: 130, gap: 22 },
  titulo: { color: MOSS.pergamino, fontFamily: LETRAS_DE_MOSS.titulo, fontSize: 30, textAlign: 'center' },
  bloque: { gap: 6 },
  etiqueta: { color: MOSS.oro, fontFamily: LETRAS_DE_MOSS.texto, fontSize: 11, letterSpacing: 2.4, textTransform: 'uppercase', marginBottom: 2 },
  fila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 },
  filaIzq: { color: MOSS.pergaminoTenue, fontFamily: LETRAS_DE_MOSS.texto, fontSize: 14 },
  filaDer: { color: MOSS.pergamino, fontFamily: LETRAS_DE_MOSS.texto, fontSize: 14 },
  barra: { height: 3, borderRadius: 999, backgroundColor: MOSS.oroBorde, overflow: 'hidden', marginBottom: 4 },
  barraLlena: { height: 3, backgroundColor: MOSS.oro },
  raya: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: MOSS.pergamino },
  linea: { color: MOSS.pergamino, fontFamily: LETRAS_DE_MOSS.texto, fontSize: 14, lineHeight: 20, marginTop: 4 },
  desvincular: { color: MOSS.pergaminoTenue, fontFamily: LETRAS_DE_MOSS.texto, fontSize: 13, textAlign: 'center', paddingVertical: 10 },
});
