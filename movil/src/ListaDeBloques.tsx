import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { EstadoBloques } from '@nucleo/bloques';
import type { Ejercicio } from '@nucleo/tipos';
import type { Unidad } from '@nucleo/peso';
import { cargaVigente, llevaNumero, type Carga } from '@nucleo/carga';
import { useEnVuelo } from '@compartido/useEnVuelo';
import { T } from '@nucleo/textos';
import { nombreVisible } from '@nucleo/propios';
import type { EjercicioDelDia } from '@nucleo/rutinas';
import { rutinaActivaDelTelefono } from '@compartido/rutinas';
import { eventos, RUTINA_CAMBIO } from '@compartido/eventos';
import Hoja from './Hoja';
import { nuevaEnCadaApertura } from './hojaNueva';
import CampoPeso from './CampoPeso';
import EtiquetaDeCarga from './EtiquetaDeCarga';
import SelectorEjercicio from './SelectorEjercicio';
import { C, conTema } from './colores';
import { useTema } from './useTema';
import { Text } from './Texto';
import { L } from './fuentes';
import { Fantasma, R } from './roles';
import MiRutina from './MiRutina';
import Tocable from './Tocable';
import FondoOctogonal from './FondoOctogonal';

/**
 * LA LISTA DE HOY (22/11, a pedido; antes «Ver lista»): lo hecho y cómo corregirlo, y lo que sigue de la rutina de hoy.
 * Lo hecho es la misma hoja que la web: cada bloque cerrado con su − y su +, quitarlo pregunta, y los pesos de cada
 * serie se corrigen de a uno. El bloque en curso se ve pero sus series se tocan afuera.
 *
 * «EDITAR ESTE DÍA» cambia el contenido de esta misma hoja por el editor de un día (`MiRutina` con `soloElDia`), y
 * «Listo» vuelve a la lista. No es otra hoja encima: el selector de ejercicios del editor ya es un modal adentro de
 * este, y un tercero apilado es lo que en el iPhone no se pudo probar.
 *
 * Y el ejercicio de un bloque cerrado se corrige tocando su nombre (18/9): las
 * series y sus pesos se quedan, cambia de qué fueron. El selector va ADENTRO
 * de esta hoja: en iOS un modal solo se presenta encima de otro si está dentro
 * de su contenido.
 */
function ListaDeBloques({
  visible,
  estado,
  ejercicios,
  unidad,
  anotarPeso,
  conCarga,
  alCorregirPeso,
  alCorregirCarga,
  alCorregirEjercicio,
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
  alCorregirEjercicio: (indice: number, id: string, cargaQueSeVeia?: Carga) => void;
  alTocar: (indice: number, delta: number | 'quitar') => void;
  alCerrar: () => void;
}) {
  useTema();
  // El bloque que está por quitarse, POR IDENTIDAD (su id) y no por índice: el
  // índice se corre si la lista cambia entre "✕" y "Sí". `i:<n>` es el respaldo
  // para bloques de una caché vieja sin id.
  const [porQuitar, setPorQuitar] = useState<string | null>(null);
  const claveDe = (b: { id?: string }, i: number) => b.id ?? 'i:' + i;
  // Quitar POR IDENTIDAD, con traba. Dos motivos, el mismo arreglo:
  //  - doble-tap en "Sí": sin traba, quitaba el bloque y después un vecino,
  //    porque la lista ya se había corrido y el índice apuntaba a otro (A6);
  //  - la lista cambia debajo (otro cierre, una recarga de la base) entre "✕" y
  //    "Sí": el índice guardado quedaba stale y borraba el bloque equivocado.
  // Se resuelve el índice ACTUAL desde el id al momento de quitar; si el bloque
  // ya no está, no se borra nada. La clave de la traba es el id, así el repetido
  // se ignora pero quitar dos bloques distintos seguidos NO se pisa.
  // LO TECLEADO SIN CONFIRMAR NO SE PIERDE AL CERRAR (4/10). El campo confirma
  // cuando pierde el foco, y tocar "Listo" o el fondo no se lo saca: la hoja se
  // desmontaba con el número nuevo a la vista y la serie quedaba con el viejo.
  const sinConfirmar = useRef<(() => void) | null>(null);
  const cerrar = () => {
    sinConfirmar.current?.();
    sinConfirmar.current = null;
    alCerrar();
  };

  const quitar = useEnVuelo(
    (clave: string) => {
      const idx = clave.startsWith('i:')
        ? Number(clave.slice(2))
        : estado.cerrados.findIndex((b) => b.id === clave);
      if (idx < 0 || idx >= estado.cerrados.length) return setPorQuitar(null);
      alTocar(idx, 'quitar');
      setPorQuitar(null);
    },
    { clave: (c) => c }
  );
  // El bloque cuyo ejercicio se está corrigiendo: abre el selector.
  const [cambiando, setCambiando] = useState<number | null>(null);
  // LO QUE SIGUE: lo de hoy en la rutina activa (la copia del teléfono, que anda sin señal) que todavía no se hizo en
  // esta sesión. Se relee cuando la rutina cambia: es lo que se acaba de editar acá mismo.
  const [deHoy, setDeHoy] = useState<EjercicioDelDia[]>([]);
  const leerDeHoy = useCallback(async () => {
    const dia = (await rutinaActivaDelTelefono())?.dias[new Date().getDay()];
    setDeHoy(dia && !dia.descanso ? dia.ejercicios : []);
  }, []);
  useEffect(() => {
    if (!visible) return;
    void leerDeHoy();
    return eventos.escuchar(RUTINA_CAMBIO, () => void leerDeHoy());
  }, [visible, leerDeHoy]);
  const yaHechos = new Set([...estado.cerrados.map((b) => b.ejercicio), estado.hechas > 0 ? estado.ejercicio : null]);
  const loQueSigue = deHoy.filter((e) => !yaHechos.has(e.ejercicio));
  const [editando, setEditando] = useState(false);
  // Mientras se arrastra un ejercicio para ordenarlo, la hoja no se desplaza.
  const [arrastrando, setArrastrando] = useState(false);
  const del = (id: string | null) => ejercicios.find((e) => e.id === id);
  const nombre = (id: string | null) => (id ? nombreVisible(id, del(id)?.nombre) : T.sesion.sinEjercicio);
  const admitePeso = (id: string | null) => id !== null && del(id)?.admite_peso !== false;
  const nada = estado.cerrados.length === 0 && estado.hechas === 0;

  const pesos = (indice: number, ejercicio: string | null, series: number, lista: (number | null)[] | undefined, carga: Carga | undefined) => {
    if (!anotarPeso || series <= 0 || !admitePeso(ejercicio)) return null;
    // CON PESO CORPORAL NO HAY NÚMERO: no se ofrece un campo por serie, y la
    // etiqueta queda siempre, que es por donde se vuelve a un peso.
    const vista = cargaVigente(carga, del(ejercicio)?.carga);
    const conNumero = llevaNumero(vista);
    return (
      <View style={estilos.pesos}>
        {conNumero &&
          Array.from({ length: series }, (_, s) => (
            <CampoPeso
              key={s}
              compacto
              kg={lista?.[s]}
              unidad={unidad}
              etiqueta={T.sesion.pesoDeSerie(s + 1)}
              alCambiar={(kg) => alCorregirPeso(indice, s, kg)}
              alTeclear={(confirmar) => {
                sinConfirmar.current = confirmar;
              }}
            />
          ))}
        {conCarga && (lista || !conNumero) && (
          <EtiquetaDeCarga chica carga={vista} ejercicio={ejercicio} alElegir={(c) => alCorregirCarga(indice, c)} />
        )}
      </View>
    );
  };

  if (editando) {
    return (
      <Hoja visible={visible} alCerrar={cerrar} desplazable={!arrastrando}>
        <Text style={estilos.titulo}>{T.sesion.listaEditarDia}</Text>
        <MiRutina visible soloElDia alArrastrar={setArrastrando} />
        <Tocable testID="editar-este-dia-listo" style={estilos.listo} onPress={() => setEditando(false)}>
          <FondoOctogonal relleno={C.claro} luz={C.claro} />
          <Text style={estilos.listoTexto}>{T.sesion.listo}</Text>
        </Tocable>
      </Hoja>
    );
  }

  return (
    <Hoja visible={visible} alCerrar={cerrar}>
      <Text style={estilos.titulo}>{T.sesion.listaTitulo}</Text>

      <Text style={estilos.seccion}>{T.sesion.listaHecho}</Text>
      {nada ? (
        <Text style={estilos.vacio}>{T.sesion.listaVacia}</Text>
      ) : (
        <>
          {estado.cerrados.map((b, i) => {
            const clave = claveDe(b, i);
            return (
            // POR SU ID, NO POR EL LUGAR (4/10). Con el lugar, quitar el bloque
            // de arriba le dejaba a la fila de abajo los campos del anterior:
            // un peso a medio teclear se anotaba en OTRO bloque.
            <View key={clave} style={estilos.fila}>
              <View style={estilos.filaArriba}>
                <View style={estilos.izquierda}>
                  <View style={[estilos.punto, estilos.puntoHecho]} />
                  <Tocable
                    style={{ flexShrink: 1 }}
                    onPress={() => setCambiando(i)}
                    accessibilityRole="button"
                    accessibilityLabel={T.sesion.listaCambiarEjercicio(nombre(b.ejercicio))}
                    hitSlop={8}
                  >
                    <Text style={[estilos.nombre, estilos.tocable]}>{nombre(b.ejercicio)}</Text>
                  </Tocable>
                </View>
                {porQuitar === clave ? (
                  <View style={estilos.controles}>
                    <Text style={estilos.pregunta}>{T.sesion.listaQuitarPregunta}</Text>
                    <Tocable style={estilos.boton} onPress={() => quitar(clave)}>
                      <Text style={estilos.botonTexto}>{T.album.si}</Text>
                    </Tocable>
                    <Tocable style={estilos.boton} onPress={() => setPorQuitar(null)}>
                      <Text style={estilos.botonTexto}>{T.album.no}</Text>
                    </Tocable>
                  </View>
                ) : (
                  <View style={estilos.controles}>
                    <Tocable style={estilos.paso} onPress={() => alTocar(i, -1)} disabled={b.series === 0} accessibilityLabel={T.inicio.sacarSerie}>
                      <Text style={estilos.pasoTexto}>−</Text>
                    </Tocable>
                    <Text style={estilos.cuantas}>{b.series}</Text>
                    <Tocable style={estilos.paso} onPress={() => alTocar(i, 1)} accessibilityLabel={T.inicio.sumarSerie}>
                      <Text style={estilos.pasoTexto}>+</Text>
                    </Tocable>
                    <Tocable style={estilos.paso} onPress={() => setPorQuitar(clave)} accessibilityLabel={T.sesion.listaQuitar}>
                      <Text style={estilos.quitar}>✕</Text>
                    </Tocable>
                  </View>
                )}
              </View>
              {pesos(i, b.ejercicio, b.series, b.pesos, b.carga)}
            </View>
            );
          })}

          {estado.hechas > 0 && (
            <View style={estilos.fila}>
              <View style={estilos.filaArriba}>
                <View style={estilos.izquierda}>
                  <View style={[estilos.punto, estilos.puntoEnCurso]} />
                  <Text style={estilos.nombre}>{nombre(estado.ejercicio)}</Text>
                </View>
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

      {/* LO QUE SIGUE, en línea: todavía no pasó. El que ya está cargado en el bloque lleva el punto prendido. */}
      <View style={estilos.sigueCabecera}>
        <Text style={[estilos.seccion, estilos.seccionEnFila]}>{T.sesion.listaSigue}</Text>
        <Fantasma testID="editar-este-dia-abrir" texto={T.sesion.listaEditarDia} alTocar={() => setEditando(true)} enHoja alinear="center" />
      </View>
      <View testID="lo-que-sigue">
        {loQueSigue.length === 0 ? (
          <Text style={estilos.vacio}>{deHoy.length === 0 ? T.sesion.listaSinRutina : T.sesion.listaNadaMas}</Text>
        ) : (
          loQueSigue.map((e, i) => (
            <View key={`${e.ejercicio}-${i}`} style={[estilos.fila, estilos.filaArriba]}>
              <View style={[estilos.punto, e.ejercicio === estado.ejercicio && estilos.puntoAhora]} />
              <Text style={[estilos.nombre, estilos.porVenir]} numberOfLines={1}>{nombre(e.ejercicio)}</Text>
              <Text style={estilos.cuanto}>{e.minutos !== undefined ? T.rutina.minutos(e.minutos) : e.reps ? `${e.series} × ${e.reps}` : T.rutina.series(e.series)}</Text>
            </View>
          ))
        )}
      </View>

      <Tocable style={estilos.listo} onPress={cerrar}>
<FondoOctogonal relleno={C.claro} luz={C.claro} />
        <Text style={estilos.listoTexto}>{T.sesion.listo}</Text>
      </Tocable>
      {cambiando !== null && estado.cerrados[cambiando] && (
        <SelectorEjercicio
          visible
          ejercicios={ejercicios}
          valor={estado.cerrados[cambiando].ejercicio}
          alElegir={(id) => {
            const b = estado.cerrados[cambiando];
            // El modo que se veía viaja con las series: los números se
            // escribieron leyendo esa etiqueta.
            const vista = conCarga && b.pesos ? cargaVigente(b.carga, del(b.ejercicio)?.carga) : undefined;
            if (id) alCorregirEjercicio(cambiando, id, vista);
          }}
          alCerrar={() => setCambiando(null)}
        />
      )}
    </Hoja>
  );
}

export default nuevaEnCadaApertura(ListaDeBloques, (p) => p.visible);

const estilos = conTema(() => StyleSheet.create({
  // Una línea punteada debajo: "esto se toca" sin parecer un enlace.
  tocable: { textDecorationLine: 'underline', textDecorationStyle: 'dotted', textDecorationColor: C.sub },
  titulo: { color: C.tinta, fontSize: 20, fontWeight: '500', marginBottom: 4 },
  seccion: { ...R.etiqueta, marginTop: 18, marginBottom: 2 },
  // La etiqueta y «Editar este día» en la misma línea: el enlace es alto para el dedo, la etiqueta se centra con él.
  sigueCabecera: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 6 },
  seccionEnFila: { marginTop: 0, marginBottom: 0 },
  // LA COLUMNA DE PUNTOS: lleno lo hecho, prendido lo que se está haciendo, en aro lo que sigue (el cargado en el
  // bloque, con el aro del color del rango).
  izquierda: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  punto: { width: 7, height: 7, borderRadius: 3.5, borderWidth: 1, borderColor: C.lineaFuerte },
  puntoHecho: { backgroundColor: C.sub, borderColor: C.sub },
  puntoEnCurso: { backgroundColor: C.claro, borderColor: C.claro },
  puntoAhora: { borderColor: C.claro },
  porVenir: { flex: 1, color: C.sub },
  cuanto: { color: C.sub, fontSize: 13, fontFamily: L.dato },
  vacio: { color: C.sub, fontSize: 14, marginVertical: 12 },
  fila: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.linea },
  filaArriba: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  nombre: { color: C.tinta, fontSize: 15, flexShrink: 1 },
  controles: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  paso: { minWidth: 40, minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  pasoTexto: { color: C.sub, fontSize: 20 },
  quitar: { color: C.apagado, fontSize: 14 },
  cuantas: { color: C.tinta, fontSize: 16, minWidth: 22, textAlign: 'center', fontFamily: L.dato },
  rotulo: { ...R.etiqueta, marginLeft: 8  },
  pregunta: { color: C.sub, fontSize: 13, marginRight: 6 },
  boton: { minHeight: 40, paddingHorizontal: 10, justifyContent: 'center' },
  botonTexto: { color: C.tinta, fontSize: 14 },
  // Debajo del nombre, no del punto.
  pesos: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 14, marginTop: 6, marginLeft: 15 },
  listo: { paddingVertical: 14, alignItems: 'center', marginTop: 18 },
  listoTexto: { color: C.fondo, fontSize: 15, fontWeight: '600' },
}));
