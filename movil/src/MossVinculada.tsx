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
  // Vinculada, moss_hoy siempre contesta (aunque sea vacío); sin vínculo o con error, null.
  return !!d && d.hoy !== null;
}

function Barra({ valor, meta, raya, gruesa }: { valor: number; meta: number; raya?: number; gruesa?: boolean }) {
  const lleno = Math.max(0, Math.min(1, valor / meta));
  return (
    <View style={[estilos.barra, gruesa && estilos.barraGruesa]}>
      <View style={[estilos.barraLlena, { width: `${lleno * 100}%` }]} />
      {raya !== undefined && <View style={[estilos.raya, { left: `${Math.min(1, raya / meta) * 100}%` }]} />}
    </View>
  );
}

/** Un número grande con lo que es abajo, como «Tu año» de Moss. */
function Cifra({ valor, que }: { valor: string; que: string }) {
  return (
    <View style={estilos.cifra}>
      <Text style={estilos.cifraValor}>{valor}</Text>
      <Text style={estilos.cifraQue}>{que}</Text>
    </View>
  );
}

/** Lo comido contra la meta: el nombre, la barra y el número. */
function Macro({ que, total, meta, unidad }: { que: string; total: number; meta: number | null; unidad: string }) {
  return (
    <View style={estilos.macro}>
      <Text style={estilos.macroQue}>{que}</Text>
      <View style={estilos.macroBarra}>{meta ? <Barra valor={total} meta={meta} gruesa /> : null}</View>
      <Text style={estilos.macroNum}>{meta ? `${Math.round(total)}/${Math.round(meta)}` : Math.round(total)} {unidad}</Text>
    </View>
  );
}

export default function MossVinculada({ datos, alDesvincular }: { datos: Datos; alDesvincular: () => void }) {
  const lista = useRef<ScrollView>(null);
  const { hoy, semanas, objetivo, anio } = datos;
  const ahora = new Date();
  const esperar = queEsperarHoy(hoy?.comida ?? null, ahora.getHours() * 60 + ahora.getMinutes(), objetivo?.peso ?? null);
  // La última semana con algo: Moss manda todas las semanas, también las vacías.
  const semana = [...semanas].reverse().find((w) => w.dormido !== null || w.proteinaGKg !== null || w.peso !== null);
  const comida = hoy?.comida;
  const kg = (n: number) => `${pesoCorto(n, 'kg')} kg`;
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

      {anio && (anio.diasConComida > 0 || anio.noches > 0) && (
        <View style={estilos.bloque}>
          <Text style={estilos.etiqueta}>{T.moss.tuAnio}</Text>
          <View style={estilos.cifras}>
            <Cifra valor={String(anio.diasConComida)} que={T.moss.diasAnotados} />
            <Cifra valor={String(anio.noches)} que={T.moss.noches} />
            {anio.pesoInicio !== null && anio.pesoHoy !== null && <Cifra valor={`${pesoCorto(anio.pesoInicio, 'kg')} → ${pesoCorto(anio.pesoHoy, 'kg')}`} que={T.moss.pesoDelAnio} />}
          </View>
        </View>
      )}

      {objetivo && (
        <View style={estilos.bloque}>
          <Text style={estilos.etiqueta}>{T.moss.tuObjetivo}</Text>
          <Text style={estilos.grande}>{T.moss.objetivos[objetivo.objetivo]}</Text>
          {objetivo.peso !== null && objetivo.pesoMeta !== null && <Text style={estilos.linea}>{`${kg(objetivo.peso)} → ${kg(objetivo.pesoMeta)}`}</Text>}
        </View>
      )}

      {semana && (
        <View style={estilos.bloque}>
          <Text style={estilos.etiqueta}>{T.moss.estaSemana}</Text>
          <View style={estilos.cifras}>
            {semana.dormido !== null && <Cifra valor={horas(semana.dormido)} que={T.moss.suenoPromedio} />}
            {semana.proteinaGKg !== null && <Cifra valor={`${pesoCorto(semana.proteinaGKg, 'kg')} g/kg`} que={T.moss.proteinaPorDia} />}
            {semana.balance !== null && <Cifra valor={`${semana.balance > 0 ? '+' : ''}${Math.round(semana.balance)}`} que={T.moss.balancePorDia} />}
            {semana.peso !== null && <Cifra valor={kg(semana.peso)} que={T.moss.peso} />}
          </View>
        </View>
      )}

      <View style={estilos.bloque}>
        <Text style={estilos.etiqueta}>{datos.entrenoHoy ? T.moss.despuesDeEntrenar : T.moss.antesDeEntrenar}</Text>
        {comida && (comida.total.kcal > 0 || comida.comidas.length > 0) && (
          <View style={estilos.macros}>
            <Macro que={T.moss.proteina} total={comida.total.proteina} meta={comida.meta?.proteina ?? null} unidad="g" />
            {comida.total.carbos !== null && <Macro que={T.moss.carbohidratos} total={comida.total.carbos} meta={comida.meta?.carbos ?? null} unidad="g" />}
            {comida.total.grasas !== null && <Macro que={T.moss.grasas} total={comida.total.grasas} meta={comida.meta?.grasas ?? null} unidad="g" />}
            <Macro que={T.moss.calorias} total={comida.total.kcal} meta={comida.meta?.kcal ?? null} unidad="kcal" />
          </View>
        )}
        {!datos.entrenoHoy &&
          esperar.map((e) => (
            <View key={e} style={estilos.esperar}>
              {/* El punto, como en Moss: terracota si es un aviso, oro si está bien. */}
              <View style={[estilos.punto, { backgroundColor: e === 'bienComido' ? MOSS.oro : MOSS.terracota }]} />
              <Text testID={`moss-esperar-${e}`} style={estilos.linea}>
                {T.moss.esperar[e]}
              </Text>
            </View>
          ))}
      </View>

      {(hoy?.noche || hoy?.energia) && (
        <View style={[estilos.bloque, estilos.ultimo]}>
          <Text style={estilos.etiqueta}>{T.moss.tuNoche}</Text>
          {hoy?.noche && (
            <>
              <Text style={estilos.enorme}>
                {horas(hoy.noche.dormido)}
                <Text style={estilos.deCuanto}>{`  ${T.moss.de} ${horas(hoy.noche.necesidad)}`}</Text>
              </Text>
              {/* La raya de las 6 h, como en Moss. */}
              <Barra valor={hoy.noche.dormido} meta={hoy.noche.necesidad} raya={360} gruesa />
              {hoy.noche.deudaPalabra && <Text style={estilos.linea}>{T.moss.deudaEs(T.moss.deudas[hoy.noche.deudaPalabra])}</Text>}
            </>
          )}
          {hoy?.energia && <Text style={estilos.linea}>{T.moss.energiaEs(T.moss.energias[hoy.energia])}</Text>}
        </View>
      )}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  contenido: { flexGrow: 1, justifyContent: 'flex-end', paddingHorizontal: 24, paddingTop: 90, paddingBottom: 120 },
  titulo: { color: MOSS.pergamino, fontFamily: LETRAS_DE_MOSS.titulo, fontSize: 30, textAlign: 'center' },
  desvincular: { color: MOSS.pergaminoTenue, fontFamily: LETRAS_DE_MOSS.texto, fontSize: 13, textAlign: 'center', paddingVertical: 10, marginBottom: 6 },
  bloque: { gap: 10, paddingVertical: 22, borderTopWidth: 1, borderTopColor: MOSS.linea },
  ultimo: { paddingBottom: 6 },
  etiqueta: { color: MOSS.oro, fontFamily: LETRAS_DE_MOSS.texto, fontSize: 12, letterSpacing: 2.6, textTransform: 'uppercase' },
  grande: { color: MOSS.pergamino, fontFamily: LETRAS_DE_MOSS.texto, fontSize: 26, lineHeight: 32 },
  enorme: { color: MOSS.oroClaro, fontFamily: LETRAS_DE_MOSS.texto, fontSize: 44, lineHeight: 52 },
  deCuanto: { color: MOSS.pergaminoTenue, fontSize: 18 },
  linea: { flex: 1, color: MOSS.pergamino, fontFamily: LETRAS_DE_MOSS.texto, fontSize: 15, lineHeight: 21 },
  cifras: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 16 },
  cifra: { width: '50%', gap: 2 },
  cifraValor: { color: MOSS.pergamino, fontFamily: LETRAS_DE_MOSS.texto, fontSize: 26 },
  cifraQue: { color: MOSS.pergaminoTenue, fontFamily: LETRAS_DE_MOSS.texto, fontSize: 13 },
  macros: { gap: 10 },
  macro: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  macroQue: { width: 96, color: MOSS.pergamino, fontFamily: LETRAS_DE_MOSS.texto, fontSize: 14 },
  macroBarra: { flex: 1 },
  macroNum: { minWidth: 84, textAlign: 'right', color: MOSS.pergaminoTenue, fontFamily: LETRAS_DE_MOSS.texto, fontSize: 13 },
  barra: { height: 4, borderRadius: 999, backgroundColor: MOSS.linea, overflow: 'hidden' },
  barraGruesa: { height: 10 },
  barraLlena: { height: '100%', backgroundColor: MOSS.oro, borderRadius: 999 },
  raya: { position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: MOSS.pergamino },
  esperar: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  punto: { width: 8, height: 8, borderRadius: 4, marginTop: 7 },
});
