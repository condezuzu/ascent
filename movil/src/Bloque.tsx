import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { supabase } from './supabase';
import { METAS, metaCumplida, type EstadoBloques } from '@nucleo/bloques';
import type { Ejercicio } from '@nucleo/tipos';
import { pesoCorto, type Unidad } from '@nucleo/peso';
import { OPCIONES_DE_LA_PREGUNTA, cargaVigente, hayQuePreguntar, kilosMovidos, muestraTotal, type Carga } from '@nucleo/carga';
import { disponible } from '@nucleo/esquema';
import { T } from '@nucleo/textos';
import { leerAnotarPeso } from '@compartido/anotarPeso';
import { useVersionDelEsquema } from '@compartido/esquema';
import SelectorEjercicio from './SelectorEjercicio';
import ListaDeBloques from './ListaDeBloques';
import CampoPeso from './CampoPeso';
import EtiquetaDeCarga from './EtiquetaDeCarga';
import { C } from './colores';

/**
 * QUÉ ESTÁS HACIENDO, CUÁNTAS TE PROPUSISTE, CUÁNTAS VAN — en nativo.
 *
 * LAS REGLAS NO ESTÁN ACÁ. Qué pasa al sumar, al cerrar el bloque, al cambiar
 * de ejercicio con series contadas, el peso vigente, el modo del peso y la
 * pregunta de la primera vez: todo eso es `nucleo/bloques.ts`, `nucleo/carga.ts`
 * y `useSesion` (compartido), lo mismo que usa `src/components/Bloque.tsx`.
 * Esto es el dibujo, con las mismas decisiones de la web:
 *
 * - El `+` es enorme: es el botón más tocado, con una mano y transpirado.
 * - Llegar a la meta NO cierra nada: el botón grande pasa a "Terminar serie" y
 *   sumar otra queda abajo, porque pasarse de la meta es normal.
 * - Cambiar de ejercicio con series sin cerrar pregunta de cuál eran.
 * - Sin la migración de cada cosa (peso 36, modo 38), el campo no aparece.
 */
export default function Bloque({
  estado,
  total,
  unidad,
  cargaConsultada,
  alSumar,
  debajoDelMas,
  alRestar,
  alSiguiente,
  alElegirEjercicio,
  alMudarSeries,
  alElegirMeta,
  alTocarBloque,
  alElegirPeso,
  alCorregirPeso,
  alElegirCarga,
  alCorregirCarga,
  alCorregirEjercicio,
}: {
  estado: EstadoBloques;
  total: number;
  unidad: Unidad;
  cargaConsultada: string | null;
  alSumar: () => void;
  /** La pregunta de marca de la serie recién confirmada: pegada al `+` (ver la web). */
  debajoDelMas?: ReactNode;
  alRestar: () => void;
  alSiguiente: () => void;
  alElegirEjercicio: (id: string | null) => void;
  alMudarSeries: (id: string | null, cargaQueSeVeia?: Carga) => void;
  alElegirMeta: (meta: number) => void;
  alTocarBloque: (indice: number, delta: number | 'quitar') => void;
  alElegirPeso: (kg: number | null) => void;
  alCorregirPeso: (indice: number, serie: number, kg: number | null) => void;
  alElegirCarga: (c: Carga) => void;
  alCorregirCarga: (indice: number, c: Carga) => void;
  alCorregirEjercicio: (indice: number, id: string, cargaQueSeVeia?: Carga) => void;
}) {
  const [ejercicios, setEjercicios] = useState<Ejercicio[]>([]);
  const [eligiendo, setEligiendo] = useState(false);
  const [lista, setLista] = useState(false);
  const [aDonde, setADonde] = useState<string | null | undefined>(undefined);
  const [prefierePeso, setPrefierePeso] = useState(true);
  const version = useVersionDelEsquema();
  const anotarPeso = prefierePeso && disponible('pesoPorSerie', version);
  const conCarga = anotarPeso && disponible('cargaDelPeso', version);

  useEffect(() => {
    leerAnotarPeso().then(setPrefierePeso);
  }, []);

  // El catálogo se pide una vez y no bloquea nada: sin él el contador anda
  // igual, con "sin ejercicio".
  useEffect(() => {
    let vivo = true;
    supabase
      .from('ejercicios')
      .select('*')
      .order('orden')
      .then(({ data }) => {
        if (vivo && data) setEjercicios(data as Ejercicio[]);
      });
    return () => {
      vivo = false;
    };
  }, []);

  const actual = ejercicios.find((e) => e.id === estado.ejercicio) ?? null;
  const nombreDe = (id: string | null) => (id ? (ejercicios.find((e) => e.id === id)?.nombre ?? id) : T.sesion.sinEjercicio);
  const cumplida = metaCumplida(estado);
  const puntos = Math.max(estado.meta, estado.hechas);
  const cargaVista = cargaVigente(estado.carga, actual?.carga);
  const admitePeso = !!estado.ejercicio && actual?.admite_peso !== false;
  const preguntar =
    conCarga &&
    admitePeso &&
    hayQuePreguntar({ ambigua: actual?.carga_ambigua, cargaDelBloque: estado.carga, yaSeConsulto: cargaConsultada === estado.ejercicio });

  return (
    <View style={estilos.bloque}>
      <View style={estilos.fila}>
        <Pressable style={estilos.ejercicio} onPress={() => setEligiendo(true)} accessibilityRole="button">
          <Text style={[estilos.ejercicioTexto, !estado.ejercicio && estilos.apagadoTexto]} numberOfLines={1}>
            {actual ? `${actual.nombre} · ${actual.grupo}` : T.sesion.sinEjercicio}
          </Text>
        </Pressable>
      </View>

      <View style={estilos.metas} accessibilityLabel={T.sesion.cuantasVasAHacer}>
        {METAS.map((m) => (
          <Pressable
            key={m}
            style={[estilos.meta, estado.meta === m && estilos.metaPrendida]}
            onPress={() => alElegirMeta(m)}
            accessibilityState={{ selected: estado.meta === m }}
          >
            <Text style={[estilos.metaTexto, estado.meta === m && estilos.metaTextoPrendido]}>×{m}</Text>
          </Pressable>
        ))}
      </View>

      {anotarPeso && admitePeso && (
        <View style={estilos.peso}>
          <CampoPeso kg={estado.peso} unidad={unidad} alCambiar={alElegirPeso} />
          {conCarga && !preguntar && (
            <EtiquetaDeCarga carga={cargaVista} ejercicio={estado.ejercicio} alElegir={alElegirCarga} />
          )}
          {conCarga && !preguntar && !!estado.peso && muestraTotal(cargaVista) && (
            <Text style={estilos.total}>
              {T.sesion.enTotal(pesoCorto(kilosMovidos(estado.peso, cargaVista), unidad), unidad)}
            </Text>
          )}
        </View>
      )}

      {/* CON QUÉ LO HACÉS, la primera vez. No bloquea: el + anda igual. */}
      {preguntar && actual && (
        <View style={estilos.pregunta}>
          <Text style={estilos.preguntaTexto}>{T.sesion.conQueLoHaces(actual.nombre)}</Text>
          <View style={estilos.opciones}>
            {OPCIONES_DE_LA_PREGUNTA.map((c) => (
              <Pressable key={c} style={estilos.opcion} onPress={() => alElegirCarga(c)}>
                <Text style={estilos.opcionTexto}>{T.sesion.respuestaCarga[c as 'par' | 'total' | 'una']}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={estilos.nota}>{T.sesion.conQueNota}</Text>
        </View>
      )}

      {/* ¿DE CUÁL ERAN? Se cambió de ejercicio con series sin cerrar. */}
      {aDonde !== undefined && (
        <View style={estilos.pregunta}>
          <Text style={estilos.preguntaTexto}>{T.sesion.deCual(estado.hechas)}</Text>
          <View style={estilos.opciones}>
            <Pressable
              style={estilos.opcion}
              onPress={() => {
                alElegirEjercicio(aDonde);
                setADonde(undefined);
              }}
            >
              <Text style={estilos.opcionTexto} numberOfLines={1}>{T.sesion.eranDe(nombreDe(estado.ejercicio))}</Text>
            </Pressable>
            <Pressable
              style={estilos.opcion}
              onPress={() => {
                alMudarSeries(aDonde, conCarga ? cargaVista : undefined);
                setADonde(undefined);
              }}
            >
              <Text style={estilos.opcionTexto} numberOfLines={1}>{T.sesion.eranDe(nombreDe(aDonde))}</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* UNA SOLA CUENTA DEL BLOQUE: los circulitos (19/9, lo mismo que la
          web). El "1 de 3" grande decía lo mismo con otra forma, y dos
          lecturas de lo mismo son las que hicieron creer que se habían
          perdido series. El total va chico al lado; el "1 de 3" queda para
          el lector de pantalla. */}
      <View style={estilos.cuenta} accessibilityLiveRegion="polite">
        <View
          style={estilos.puntos}
          accessible
          accessibilityRole="image"
          accessibilityLabel={T.sesion.deMeta(estado.hechas, estado.meta)}
        >
          {Array.from({ length: puntos }).map((_, i) => (
            <View
              key={i}
              style={[estilos.punto, i < estado.hechas && estilos.puntoLleno, i >= estado.meta && estilos.puntoExtra]}
            />
          ))}
        </View>
        <Text style={estilos.cuentaTotal}>{T.sesion.totalHoy(total)}</Text>
      </View>

      {cumplida ? (
        <Pressable
          style={[estilos.mas, estilos.masCerrar]}
          onPress={() => {
            alSiguiente();
            setLista(true);
          }}
        >
          <Text style={estilos.cerrarTexto}>{T.sesion.terminarSerie}</Text>
        </Pressable>
      ) : (
        <Pressable style={estilos.mas} onPress={alSumar} accessibilityLabel={T.inicio.sumarSerie} accessibilityRole="button">
          <Text style={estilos.masTexto}>+</Text>
        </Pressable>
      )}

      {debajoDelMas}

      {cumplida && (
        <Pressable style={estilos.texto} onPress={alSumar}>
          <Text style={estilos.textoBoton}>{T.sesion.sumarOtra}</Text>
        </Pressable>
      )}
      <Pressable style={estilos.texto} onPress={alRestar} disabled={estado.hechas === 0}>
        <Text style={[estilos.textoBoton, estado.hechas === 0 && estilos.apagadoTexto]}>{T.inicio.sacarSerie}</Text>
      </Pressable>
      {(estado.cerrados.length > 0 || estado.hechas > 0) && (
        <Pressable style={estilos.texto} onPress={() => setLista(true)}>
          <Text style={estilos.textoBoton}>{T.sesion.verLista}</Text>
        </Pressable>
      )}

      <SelectorEjercicio
        visible={eligiendo}
        ejercicios={ejercicios}
        valor={estado.ejercicio}
        alElegir={(id) => {
          if (estado.hechas > 0 && id !== estado.ejercicio) setADonde(id);
          else alElegirEjercicio(id);
        }}
        alCerrar={() => setEligiendo(false)}
      />
      <ListaDeBloques
        visible={lista}
        estado={estado}
        ejercicios={ejercicios}
        unidad={unidad}
        anotarPeso={anotarPeso}
        conCarga={conCarga}
        alCorregirPeso={alCorregirPeso}
        alCorregirCarga={alCorregirCarga}
        alCorregirEjercicio={alCorregirEjercicio}
        alTocar={alTocarBloque}
        alCerrar={() => setLista(false)}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  bloque: { marginTop: 22 },
  fila: { flexDirection: 'row', alignItems: 'center' },
  ejercicio: { flex: 1, borderBottomWidth: 1, borderBottomColor: C.lineaFuerte, paddingVertical: 10 },
  ejercicioTexto: { color: C.tinta, fontSize: 17 },
  apagadoTexto: { color: C.apagado },
  metas: { flexDirection: 'row', gap: 8, marginTop: 12 },
  meta: { flex: 1, borderWidth: 1, borderColor: C.linea, borderRadius: 999, paddingVertical: 9, alignItems: 'center' },
  metaPrendida: { borderColor: C.sub },
  metaTexto: { color: C.apagado, fontSize: 14 },
  metaTextoPrendido: { color: C.tinta },
  peso: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 8, marginTop: 12 },
  total: { width: '100%', color: C.apagado, fontSize: 12, marginTop: -2, paddingLeft: 44 },
  pregunta: { borderWidth: 1, borderColor: C.lineaFuerte, borderRadius: 2, padding: 12, marginTop: 12 },
  preguntaTexto: { color: C.sub, fontSize: 13, marginBottom: 10 },
  opciones: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  opcion: {
    flexGrow: 1,
    borderWidth: 1,
    borderColor: C.linea,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  opcionTexto: { color: C.claro, fontSize: 13 },
  nota: { color: C.apagado, fontSize: 12, marginTop: 8 },
  puntos: { flexDirection: 'row', justifyContent: 'center', gap: 10, flexWrap: 'wrap', flexShrink: 1 },
  punto: { width: 16, height: 16, borderRadius: 8, borderWidth: 1, borderColor: C.sub },
  puntoLleno: { backgroundColor: C.claro, borderColor: C.claro },
  puntoExtra: { width: 11, height: 11, borderRadius: 6, marginTop: 2.5 },
  cuenta: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 16, marginTop: 22 },
  cuentaTotal: { color: C.apagado, fontSize: 12, letterSpacing: 1 },
  // EL + OCUPA MEDIA PANTALLA: se toca con una mano, transpirado, sin apuntar.
  mas: {
    marginTop: 18,
    minHeight: 150,
    borderWidth: 1,
    borderColor: C.lineaFuerte,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  masTexto: { color: C.claro, fontSize: 56, fontWeight: '200' },
  masCerrar: { backgroundColor: C.claro, borderColor: C.claro },
  cerrarTexto: { color: C.fondo, fontSize: 18, fontWeight: '600' },
  texto: { paddingVertical: 12, alignItems: 'center' },
  textoBoton: { color: C.sub, fontSize: 14 },
});
