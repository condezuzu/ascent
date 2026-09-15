import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { PRESETS_DESCANSO } from '@nucleo/reglas';
import { T } from '@nucleo/textos';
import { plataforma } from '@plataforma';
import {
  borrarDescanso,
  cambiarDuracion,
  cuentaAtras,
  duracionCorta,
  leerSonido,
  restante,
  vibrar,
  type DescansoVivo,
} from '@compartido/descanso';
import { C } from './colores';

/**
 * EL DESCANSO ENTRE SERIES, en nativo (§18). La misma pantalla que la web:
 * toma la pantalla entera porque el teléfono está en el banco, a dos metros, y
 * se lo mira de reojo. El número es lo ÚNICO grande.
 *
 * LO QUE CAMBIA DE VERDAD NO ESTÁ ACÁ: está en `compartido/descanso.ts`, que
 * programa el aviso del sistema al guardar el descanso. Esta pantalla avisa
 * con la app adelante (vibra y, si está prendido, suena); con el teléfono en
 * el bolsillo avisa la notificación, que es la mitad de la razón de migrar.
 *
 * LA BARRA SE VACÍA en vez del anillo de la web: el anillo necesita SVG, y
 * sumar `react-native-svg` por un solo dibujo es una dependencia para decir lo
 * mismo que una barra. Se vacía, no se llena: algo se está gastando.
 */
export default function Descanso({
  visible,
  vivo,
  alReiniciar,
  alSaltar,
  alOcultar,
  alSumar,
}: {
  visible: boolean;
  vivo: DescansoVivo;
  alReiniciar: (d: DescansoVivo) => void;
  alSaltar: () => void;
  /** Cerrar la pantalla SIN cortar el descanso: sigue en la píldora de arriba. */
  alOcultar: () => void;
  /** Sumar la serie sin salir: suma y vuelve a arrancar el descanso. */
  alSumar: () => void;
}) {
  const [, repintar] = useState(0);
  const [terminado, setTerminado] = useState(() => restante(vivo.fin) === 0);
  const yaAviso = useRef(terminado);
  const sonido = useRef(false);

  // Un descanso nuevo (el + desde acá) vuelve a dejar pendiente el aviso.
  useEffect(() => {
    const listo = restante(vivo.fin) === 0;
    yaAviso.current = listo;
    setTerminado(listo);
  }, [vivo.fin]);

  useEffect(() => {
    if (!visible) return;
    let vivoEfecto = true;
    (async () => {
      if (!(await leerSonido()) || !vivoEfecto) return;
      await plataforma.audio.preparar();
      sonido.current = true;
    })();
    return () => {
      vivoEfecto = false;
      sonido.current = false;
      plataforma.audio.soltar();
    };
  }, [visible]);

  const avisar = useCallback(() => {
    vibrar();
    if (sonido.current) plataforma.audio.avisar();
  }, []);

  // La pantalla no se apaga mientras se mira el descanso.
  useEffect(() => {
    if (!visible) return;
    plataforma.pantalla.mantenerDespierta();
    return () => {
      void plataforma.pantalla.soltar();
    };
  }, [visible]);

  // El intervalo no cuenta: solo repinta. El valor sale de `restante(fin)`.
  useEffect(() => {
    if (!visible) return;
    const tic = () => {
      if (restante(vivo.fin) === 0 && !yaAviso.current) {
        yaAviso.current = true;
        setTerminado(true);
        avisar();
      }
      repintar((n) => n + 1);
    };
    tic();
    const id = setInterval(tic, 250);
    const dejarDeMirar = plataforma.ciclo.alCambiar(tic);
    return () => {
      clearInterval(id);
      dejarDeMirar();
    };
  }, [visible, vivo.fin, avisar]);

  function usarPreset(segundos: number) {
    const nuevo = cambiarDuracion(vivo, segundos);
    const listo = restante(nuevo.fin) === 0;
    yaAviso.current = listo;
    setTerminado(listo);
    alReiniciar(nuevo);
  }

  const falta = restante(vivo.fin);
  const proporcion = terminado ? 0 : Math.min(1, falta / vivo.duracion);

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={alOcultar} statusBarTranslucent>
      <View style={[estilos.pantalla, terminado && estilos.listo]}>
        <Pressable style={estilos.cerrar} onPress={alOcultar} accessibilityLabel={T.descanso.cerrar}>
          <Text style={estilos.cerrarTexto}>✕</Text>
        </Pressable>

        <View style={estilos.centro}>
          <Text style={estilos.numero} accessibilityLiveRegion="polite">
            {cuentaAtras(falta)}
          </Text>
          <View style={estilos.pista}>
            <View style={[estilos.barra, { width: `${proporcion * 100}%` }, !terminado && falta <= 10 && estilos.barraFinal]} />
          </View>
        </View>

        {terminado ? (
          <View style={estilos.abajo}>
            <Text style={estilos.pie}>{T.descanso.listoPie}</Text>
            <Pressable style={estilos.solido} onPress={alSumar}>
              <Text style={estilos.solidoTexto}>{T.descanso.serieHecha}</Text>
            </Pressable>
            <Pressable
              style={estilos.texto}
              onPress={() => {
                void borrarDescanso();
                alSaltar();
              }}
            >
              <Text style={estilos.textoBoton}>{T.descanso.seguir}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={estilos.abajo}>
            <View style={estilos.presets}>
              {PRESETS_DESCANSO.map((p) => (
                <Pressable key={p} style={[estilos.preset, p === vivo.duracion && estilos.presetActivo]} onPress={() => usarPreset(p)}>
                  <Text style={[estilos.presetTexto, p === vivo.duracion && estilos.presetTextoActivo]}>{duracionCorta(p)}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable style={estilos.texto} onPress={alSumar}>
              <Text style={estilos.textoBoton}>{T.descanso.serieHecha}</Text>
            </Pressable>
            <Pressable style={estilos.texto} onPress={alOcultar}>
              <Text style={estilos.textoBoton}>{T.descanso.saltar}</Text>
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: C.fondo, paddingHorizontal: 24, paddingTop: 56, paddingBottom: 36 },
  // Al terminar el fondo cambia de golpe: es el aviso que siempre funciona.
  listo: { backgroundColor: '#1a1f2b' },
  cerrar: { position: 'absolute', top: 48, right: 16, minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  cerrarTexto: { color: C.sub, fontSize: 20 },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  numero: { color: C.tinta, fontSize: 104, fontWeight: '200', fontVariant: ['tabular-nums'] },
  pista: { width: '72%', height: 4, borderRadius: 2, backgroundColor: C.linea, marginTop: 18, overflow: 'hidden' },
  barra: { height: '100%', backgroundColor: C.principal },
  barraFinal: { backgroundColor: C.claro },
  abajo: { alignItems: 'stretch' },
  pie: { color: C.sub, fontSize: 15, textAlign: 'center', marginBottom: 18 },
  solido: { backgroundColor: C.claro, borderRadius: 2, paddingVertical: 16, alignItems: 'center' },
  solidoTexto: { color: C.fondo, fontSize: 16, fontWeight: '600' },
  presets: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginBottom: 10 },
  preset: { borderWidth: 1, borderColor: C.linea, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 },
  presetActivo: { borderColor: C.sub },
  presetTexto: { color: C.apagado, fontSize: 13 },
  presetTextoActivo: { color: C.tinta },
  texto: { paddingVertical: 13, alignItems: 'center' },
  textoBoton: { color: C.sub, fontSize: 15 },
});
