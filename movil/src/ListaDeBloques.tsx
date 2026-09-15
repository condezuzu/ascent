import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { EstadoBloques } from '@nucleo/bloques';
import type { Ejercicio } from '@nucleo/tipos';
import type { Unidad } from '@nucleo/peso';
import { cargaVigente, type Carga } from '@nucleo/carga';
import { T } from '@nucleo/textos';
import Hoja from './Hoja';
import CampoPeso from './CampoPeso';
import EtiquetaDeCarga from './EtiquetaDeCarga';
import { C } from './colores';

/**
 * LO QUE LLEVÁS HOY, Y CÓMO CORREGIRLO. La misma hoja que la web: cada bloque
 * cerrado con su − y su +, quitarlo pregunta, y los pesos de cada serie se
 * corrigen de a uno. El bloque en curso se ve pero sus series se tocan afuera.
 */
export default function ListaDeBloques({
  visible,
  estado,
  ejercicios,
  unidad,
  anotarPeso,
  conCarga,
  alCorregirPeso,
  alCorregirCarga,
  alTocar,
  alCerrar,
}: {
  visible: boolean;
  estado: EstadoBloques;
  ejercicios: Ejercicio[];
  unidad: Unidad;
  anotarPeso: boolean;
  conCarga: boolean;
  alCorregirPeso: (indice: number, serie: number, kg: number | null) => void;
  alCorregirCarga: (indice: number, c: Carga) => void;
  alTocar: (indice: number, delta: number | 'quitar') => void;
  alCerrar: () => void;
}) {
  const [porQuitar, setPorQuitar] = useState<number | null>(null);
  const del = (id: string | null) => ejercicios.find((e) => e.id === id);
  const nombre = (id: string | null) => (id ? (del(id)?.nombre ?? id) : T.sesion.sinEjercicio);
  const admitePeso = (id: string | null) => id !== null && del(id)?.admite_peso !== false;
  const nada = estado.cerrados.length === 0 && estado.hechas === 0;

  const pesos = (indice: number, ejercicio: string | null, series: number, lista: (number | null)[] | undefined, carga: Carga | undefined) =>
    anotarPeso && series > 0 && admitePeso(ejercicio) ? (
      <View style={estilos.pesos}>
        {Array.from({ length: series }, (_, s) => (
          <CampoPeso
            key={s}
            compacto
            kg={lista?.[s]}
            unidad={unidad}
            etiqueta={T.sesion.pesoDeSerie(s + 1)}
            alCambiar={(kg) => alCorregirPeso(indice, s, kg)}
          />
        ))}
        {conCarga && lista && (
          <EtiquetaDeCarga
            chica
            carga={cargaVigente(carga, del(ejercicio)?.carga)}
            ejercicio={ejercicio}
            alElegir={(c) => alCorregirCarga(indice, c)}
          />
        )}
      </View>
    ) : null;

  return (
    <Hoja visible={visible} alCerrar={alCerrar}>
      <Text style={estilos.titulo}>{T.sesion.listaTitulo}</Text>

      {nada ? (
        <Text style={estilos.vacio}>{T.sesion.listaVacia}</Text>
      ) : (
        <>
          {estado.cerrados.map((b, i) => (
            <View key={i} style={estilos.fila}>
              <View style={estilos.filaArriba}>
                <Text style={estilos.nombre}>{nombre(b.ejercicio)}</Text>
                {porQuitar === i ? (
                  <View style={estilos.controles}>
                    <Text style={estilos.pregunta}>{T.sesion.listaQuitarPregunta}</Text>
                    <Pressable
                      style={estilos.boton}
                      onPress={() => {
                        alTocar(i, 'quitar');
                        setPorQuitar(null);
                      }}
                    >
                      <Text style={estilos.botonTexto}>{T.album.si}</Text>
                    </Pressable>
                    <Pressable style={estilos.boton} onPress={() => setPorQuitar(null)}>
                      <Text style={estilos.botonTexto}>{T.album.no}</Text>
                    </Pressable>
                  </View>
                ) : (
                  <View style={estilos.controles}>
                    <Pressable style={estilos.paso} onPress={() => alTocar(i, -1)} disabled={b.series === 0} accessibilityLabel={T.inicio.sacarSerie}>
                      <Text style={estilos.pasoTexto}>−</Text>
                    </Pressable>
                    <Text style={estilos.cuantas}>{b.series}</Text>
                    <Pressable style={estilos.paso} onPress={() => alTocar(i, 1)} accessibilityLabel={T.inicio.sumarSerie}>
                      <Text style={estilos.pasoTexto}>+</Text>
                    </Pressable>
                    <Pressable style={estilos.paso} onPress={() => setPorQuitar(i)} accessibilityLabel={T.sesion.listaQuitar}>
                      <Text style={estilos.quitar}>✕</Text>
                    </Pressable>
                  </View>
                )}
              </View>
              {pesos(i, b.ejercicio, b.series, b.pesos, b.carga)}
            </View>
          ))}

          {estado.hechas > 0 && (
            <View style={[estilos.fila, estilos.ahora]}>
              <View style={estilos.filaArriba}>
                <Text style={estilos.nombre}>{nombre(estado.ejercicio)}</Text>
                <View style={estilos.controles}>
                  <Text style={estilos.cuantas}>{estado.hechas}</Text>
                  <Text style={estilos.rotulo}>{T.sesion.listaAhora}</Text>
                </View>
              </View>
              {pesos(-1, estado.ejercicio, estado.hechas, estado.pesos, estado.carga)}
            </View>
          )}
        </>
      )}

      <Pressable style={estilos.listo} onPress={alCerrar}>
        <Text style={estilos.listoTexto}>{T.sesion.listo}</Text>
      </Pressable>
    </Hoja>
  );
}

const estilos = StyleSheet.create({
  titulo: { color: C.tinta, fontSize: 20, fontWeight: '500', marginBottom: 12 },
  vacio: { color: C.sub, fontSize: 14, marginVertical: 12 },
  fila: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.linea },
  ahora: { opacity: 0.85 },
  filaArriba: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  nombre: { color: C.tinta, fontSize: 15, flexShrink: 1 },
  controles: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  paso: { minWidth: 40, minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  pasoTexto: { color: C.sub, fontSize: 20 },
  quitar: { color: C.apagado, fontSize: 14 },
  cuantas: { color: C.tinta, fontSize: 16, minWidth: 22, textAlign: 'center', fontVariant: ['tabular-nums'] },
  rotulo: { color: C.apagado, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', marginLeft: 8 },
  pregunta: { color: C.sub, fontSize: 13, marginRight: 6 },
  boton: { minHeight: 40, paddingHorizontal: 10, justifyContent: 'center' },
  botonTexto: { color: C.tinta, fontSize: 14 },
  pesos: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 14, marginTop: 6 },
  listo: { backgroundColor: C.claro, borderRadius: 2, paddingVertical: 14, alignItems: 'center', marginTop: 18 },
  listoTexto: { color: C.fondo, fontSize: 15, fontWeight: '600' },
});
