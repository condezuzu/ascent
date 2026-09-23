import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { planetaDeDia } from '@nucleo/rangos';
import { esUnidad, type Unidad } from '@nucleo/peso';
import { fechaDeMarca, origenDeMarca, pesoLindo } from '@nucleo/fuerza';
import type { Ejercicio, MiFuerza, PR, Perfil } from '@nucleo/tipos';
import { T } from '@nucleo/textos';
import { supabase } from './supabase';
import { irAPestana } from './irAPestana';
import FondoEspacial from './FondoEspacial';
import AnotarPeso from './AnotarPeso';
import CargarMarca from './CargarMarca';
import Surgir from './Surgir';
import { C } from './colores';

/**
 * MIS MARCAS (§16): donde se cargan, se miran y se borran.
 *
 * EL DOTS NO VIVE ACÁ SINO EN STATS, y la separación es a propósito: **acá se
 * escribe, allá se compara**. Lo único que aparece de la comparación es la
 * línea que dice qué falta para tener DOTS — porque el que está mirando sus
 * marcas es justo el que puede resolverlo — y ni siquiera explica por qué
 * hacen falta las tres: eso es un párrafo, y un párrafo en la pantalla donde
 * se anotan marcas no lo lee nadie. Vive entero en Ajustes.
 *
 * ES UNA PANTALLA APILADA Y NO UNA PESTAÑA, igual que el perfil: se entra
 * desde Stats, se mira, se vuelve. Una sexta pestaña para esto pondría en la
 * barra —el lugar más tocado de la app— algo que se usa una vez por mes.
 *
 * UNA MARCA CARGADA NO PISA A LA ANTERIOR (§16.5): cada carga queda y la mejor
 * es la que manda. Por eso cada fila se despliega y muestra el historial. Si
 * la última pisara a la anterior, anotar un mal día borraría un PR.
 */
export default function MisMarcas() {
  const router = useRouter();
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [ejercicios, setEjercicios] = useState<Ejercicio[]>([]);
  const [fuerza, setFuerza] = useState<MiFuerza | null>(null);
  const [historial, setHistorial] = useState<PR[]>([]);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [borrando, setBorrando] = useState<string | null>(null);
  const [hoja, setHoja] = useState<{ abierta: boolean; ejercicio?: string } | null>(null);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    const { data: sesion } = await supabase.auth.getSession();
    const uid = sesion.session?.user?.id;
    if (!uid) return setCargando(false);
    const [{ data: p }, { data: ejs }, { data: f }, { data: prs }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', uid).single(),
      supabase.from('ejercicios').select('*').order('orden'),
      supabase.rpc('mi_fuerza'),
      supabase
        .from('prs')
        .select('id, ejercicio, peso, reps, es_real, fecha')
        .eq('user_id', uid)
        .order('fecha', { ascending: false }),
    ]);
    setPerfil((p ?? null) as Perfil | null);
    setEjercicios((ejs ?? []) as Ejercicio[]);
    setFuerza((f ?? null) as MiFuerza | null);
    setHistorial((prs ?? []) as PR[]);
    setCargando(false);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function borrar(id: string) {
    setBorrando(id);
    await supabase.from('prs').delete().eq('id', id);
    setBorrando(null);
    cargar();
  }

  // LA SALIDA SE DIBUJA SIEMPRE. Esta es una pantalla apilada: no tiene barra
  // de pestañas debajo, así que si la rama que se dibuja no trae el "Volver",
  // no hay ninguna otra forma de salir. Sin red el único botón era
  // "Reintentar", que sin señal no puede hacer nada. Lo encontró el barrido
  // del 25/9 en el perfil propio; acá estaba igual, en las dos ramas.
  const salida = (
    <Pressable onPress={() => router.back()} hitSlop={10} style={estilos.volverSuelto}>
      <Text style={estilos.volver}>{T.general.volver}</Text>
    </Pressable>
  );

  if (cargando) {
    return (
      <View style={estilos.todo}>
        {salida}
        <View style={estilos.centrado}>
          <ActivityIndicator color={C.sub} />
        </View>
      </View>
    );
  }

  if (!perfil) {
    return (
      <View style={estilos.todo}>
        {salida}
        <View style={estilos.centrado}>
          <Text style={estilos.nota}>{T.general.noSePudo}</Text>
          <Pressable onPress={cargar}>
            <Text style={estilos.enlace}>{T.inicio.reintentar}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const unidad: Unidad = esUnidad(perfil.unidad_peso) ? perfil.unidad_peso : 'kg';
  const marcas = fuerza?.marcas ?? [];
  const delDots = marcas.filter((m) => m.cuenta_dots);
  const otras = marcas.filter((m) => !m.cuenta_dots);

  function filaMarca(m: (typeof marcas)[number], i: number) {
    const previas = historial.filter((h) => h.ejercicio === m.ejercicio);
    const desplegado = abierto === m.ejercicio;
    return (
      <Surgir key={m.ejercicio} indice={i}>
        <Pressable
          style={estilos.fila}
          onPress={() => setAbierto(desplegado ? null : m.ejercicio)}
          accessibilityState={{ expanded: desplegado }}
        >
          <Text style={estilos.nombre} numberOfLines={1}>
            {m.nombre}
          </Text>
          <Text style={estilos.kilos}>{pesoLindo(m.kg, unidad)}</Text>
          {/* LA FECHA VA AL LADO DEL NÚMERO, no escondida: un PR de hace dos
              años sigue valiendo, pero quien lo mira tiene derecho a saberlo
              sin tener que desplegar nada. */}
          <Text style={estilos.fecha}>{fechaDeMarca(m.fecha)}</Text>
        </Pressable>

        {desplegado && (
          <View style={estilos.historial}>
            <Text style={estilos.nota}>
              {previas.length === 1 ? T.fuerza.esLaUnica : T.fuerza.cuantasAnotaste(previas.length)}
            </Text>
            {previas.map((h) => (
              <View key={h.id} style={estilos.previa}>
                {/* PRIMERO LO QUE LEVANTÓ —100 kg × 8—, que es lo que la
                    persona hizo. El máximo calculado va al lado y en chico. */}
                <Text style={estilos.previaPeso}>
                  {pesoLindo(h.peso, unidad)}
                  {h.reps > 1 && <Text style={estilos.apagado}> × {h.reps}</Text>}
                </Text>
                <Text style={estilos.apagado}>{origenDeMarca(h)}</Text>
                <Text style={estilos.apagado}>{fechaDeMarca(h.fecha)}</Text>
                <Pressable onPress={() => borrar(h.id)} disabled={borrando === h.id} hitSlop={8}>
                  <Text style={estilos.peligro}>{T.general.borrar}</Text>
                </Pressable>
              </View>
            ))}
            <Pressable
              style={estilos.texto}
              onPress={() => setHoja({ abierta: true, ejercicio: m.ejercicio })}
            >
              <Text style={estilos.enlace}>{T.fuerza.otraDe(m.nombre.toLowerCase())}</Text>
            </Pressable>
          </View>
        )}
      </Surgir>
    );
  }

  return (
    <View style={estilos.todo}>
      <FondoEspacial
        rango={perfil.rango_actual}
        planeta={planetaDeDia(perfil.racha_actual)}
        esquina="arriba-derecha"
        velo={0.74}
      />
      <ScrollView contentContainerStyle={estilos.contenido}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text style={estilos.volver}>{T.general.volver}</Text>
        </Pressable>

        <Text style={estilos.titulo}>{T.fuerza.misMarcas}</Text>

        <Pressable style={estilos.solido} onPress={() => setHoja({ abierta: true })}>
          <Text style={estilos.solidoTexto}>{T.fuerza.anotarMarca}</Text>
        </Pressable>

        {marcas.length === 0 ? (
          <View style={estilos.vacio}>
            <Text style={estilos.vacioTexto}>{T.fuerza.vacioTitulo}</Text>
            <Text style={estilos.vacioTexto}>{T.fuerza.vacioPie}</Text>
          </View>
        ) : (
          <>
            <Text style={estilos.seccion}>{T.fuerza.lasTresQueCuentan}</Text>
            {delDots.length > 0 ? (
              <View style={estilos.tarjeta}>{delDots.map(filaMarca)}</View>
            ) : (
              <Text style={estilos.nota}>{T.fuerza.ningunaCargada}</Text>
            )}

            {fuerza?.falta === 'marcas' && delDots.length > 0 && (
              <Text style={estilos.nota}>
                {T.fuerza.faltanMarcas(delDots.length)}{' '}
                <Text style={estilos.enlace} onPress={() => irAPestana('ajustes')}>
                  {T.fuerza.verEnAjustes}
                </Text>
              </Text>
            )}
            {fuerza?.falta === 'sexo' && (
              <Text style={estilos.nota}>
                {T.fuerza.yaEstanLasTres} {T.fuerza.faltaSexo}{' '}
                <Text style={estilos.enlace} onPress={() => irAPestana('ajustes')}>
                  {T.general.ajustes}
                </Text>
                {T.fuerza.faltaSexoFin}
              </Text>
            )}
            {fuerza?.falta === 'peso' && (
              <>
                <Text style={estilos.nota}>
                  {T.fuerza.yaEstanLasTres} {T.fuerza.faltaPeso}
                </Text>
                <AnotarPeso unidad={unidad} alGuardar={cargar} />
              </>
            )}

            {otras.length > 0 && (
              <>
                <Text style={estilos.seccion}>{T.fuerza.loDemas}</Text>
                <Text style={estilos.nota}>
                  {T.fuerza.loDemasNota}{' '}
                  <Text style={estilos.enlace} onPress={() => irAPestana('ajustes')}>
                    {T.fuerza.verEnAjustes}
                  </Text>
                </Text>
                <View style={estilos.tarjeta}>{otras.map(filaMarca)}</View>
              </>
            )}
          </>
        )}
      </ScrollView>

      <CargarMarca
        visible={!!hoja?.abierta}
        ejercicios={ejercicios}
        unidad={unidad}
        inicial={hoja?.ejercicio}
        alCerrar={() => setHoja(null)}
        alGuardar={() => {
          setHoja(null);
          cargar();
        }}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  todo: { flex: 1 },
  contenido: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 48 },
  centrado: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  volver: { color: C.sub, fontSize: 15, paddingVertical: 6 },
  // Cuando no hay `ScrollView` que le ponga el margen: mismos 20 y 16 que
  // `contenido`, para que el enlace no se corra al llegar los datos.
  volverSuelto: { paddingHorizontal: 20, paddingTop: 16 },
  titulo: { color: C.tinta, fontSize: 26, fontWeight: '300', marginTop: 10, marginBottom: 18 },
  solido: { backgroundColor: C.tinta, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  solidoTexto: { color: C.fondo, fontSize: 15, fontWeight: '600' },
  seccion: { color: C.sub, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', marginTop: 28, marginBottom: 10 },
  tarjeta: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.linea,
    borderRadius: 12,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 13 },
  nombre: { flex: 1, color: C.tinta, fontSize: 15 },
  kilos: { color: C.tinta, fontSize: 15, fontVariant: ['tabular-nums'] },
  fecha: { color: C.apagado, fontSize: 12, minWidth: 54, textAlign: 'right' },
  historial: { paddingHorizontal: 12, paddingBottom: 12, gap: 8 },
  previa: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  previaPeso: { flex: 1, color: C.sub, fontSize: 13, fontVariant: ['tabular-nums'] },
  apagado: { color: C.apagado, fontSize: 12 },
  peligro: { color: C.error, fontSize: 12 },
  nota: { color: C.apagado, fontSize: 12, lineHeight: 18, marginTop: 10 },
  texto: { paddingVertical: 10 },
  enlace: { color: C.sub, fontSize: 13 },
  vacio: { marginTop: 34, alignItems: 'center', gap: 4 },
  vacioTexto: { color: C.apagado, fontSize: 13, textAlign: 'center', lineHeight: 19 },
});
