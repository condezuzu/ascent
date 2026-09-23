import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { RANGOS } from '@nucleo/rangos';
import { T } from '@nucleo/textos';
import { plataforma } from '@plataforma';
import LienzoSubida from './LienzoSubida';
import { C } from './colores';

/**
 * SUBISTE DE RANGO. El premio de la app, que en el teléfono no existía.
 *
 * LO QUE ESTO ARREGLA ES UN AGUJERO, no una función que faltaba. El evento
 * `SUBIO_RANGO` ya se emitía desde el vigilante del gimnasio y desde registrar
 * el día — **no lo escuchaba nadie**. O sea: subías de rango y no pasaba
 * absolutamente nada. Es el mismo bug que la web tuvo hasta el 15/9, con el
 * agravante de que acá el día puede entrar solo, con el teléfono en el
 * bolsillo, y entonces el único momento en que la app te dice algo es este.
 *
 * SIN CONFETI, SIN SONIDO, SIN "FELICITACIONES". El silencio es lo que lo hace
 * sentir importante, y es la misma decisión que la web. Lo único que se
 * permite es un golpe corto cuando la forma queda hecha: es un momento del
 * juego, no un aviso de sistema.
 *
 * SOLO EL RANGO NUEVO Y EL DÍA (23/9, a pedido). Antes decía también de
 * dónde venías; el momento es al que llegaste, y nombrar el que dejaste le
 * reparte la atención. Y NO SE NOMBRA LO QUE VIENE DESPUÉS (§7): cuántos hay
 * y cuál sigue, nunca. Descubrir en qué te vas a convertir es la recompensa.
 *
 * LA COREOGRAFÍA YA ESTÁ (23/9). Hasta ahora acá se veía el objeto nuevo
 * entrando con la animación de entrada del fondo: aparecía formado, sin que el
 * viejo se deshiciera. Faltaba justo lo que la subida cuenta —los días que ya
 * hiciste son el material de lo que sos ahora—, y sin eso quedaba un cartel.
 *
 * Ahora corre la de verdad (`LienzoSubida` → `compartido/motor/subida.ts`), que
 * es EL MISMO ARCHIVO que la web: las 900 partículas del objeto viejo se
 * dispersan, giran y se reorganizan en el nuevo. El salto 4 → 5 trae además su
 * flash, que es la única de las siete que lo tiene.
 *
 * TOCAR ANTES DE TIEMPO LA SALTEA, no la corta. Antes tocar no hacía nada y se
 * sentía colgado; ahora adelanta al objeto formado, igual que la web. Recién
 * el segundo toque cierra.
 */
export default function SubidaRango({
  rangoAntes,
  rangoDespues,
  planeta,
  racha,
  alCerrar,
}: {
  /**
   * De qué rango se viene. NO SE ESCRIBE en pantalla —"Dejaste atrás Luna" se
   * sacó el 23/9— pero es la mitad de la coreografía: es la forma que se
   * deshace.
   */
  rangoAntes: number;
  rangoDespues: number;
  /** Los días que se llevan: el número es la mitad de lo que se ganó. */
  racha?: number;
  /** El planeta de esta persona: el rango 4 no es un planeta cualquiera. */
  planeta?: string | null;
  alCerrar: () => void;
}) {
  const [formado, setFormado] = useState(false);
  const aparecer = useRef(new Animated.Value(0)).current;
  const saltar = useRef<(() => void) | null>(null);

  // EL NOMBRE APARECE ÚLTIMO, cuando el objeto ya está formado: si entrara
  // junto con él, se leería el nombre y no se miraría la forma, que es lo que
  // de verdad cambió.
  //
  // LO DECIDE LA ANIMACIÓN, NO UN RELOJ. Antes era un `setTimeout` de 2600 ms
  // contra una animación que dura 4 s —y 5,2 s en la ignición—, así que el
  // nombre entraba con el objeto todavía armándose. Ahora llega cuando llega, y
  // sigue estando bien si alguien la saltea.
  const alTerminar = useCallback(() => {
    setFormado(true);
    plataforma.haptica.pulso();
    Animated.timing(aparecer, { toValue: 1, duration: 700, useNativeDriver: true }).start();
  }, [aparecer]);

  /**
   * LA RED DE SEGURIDAD, y tapa un agujero que dejé yo el 23/9.
   *
   * Esta pantalla SOLO SE CIERRA cuando el objeto está formado, y quien dice
   * que está formado es la animación. Si la animación no arranca nunca —el
   * contexto de GL no nace, la app estaba en segundo plano, se quedó sin
   * memoria— `formado` se queda en falso para siempre. Y entonces: el toque no
   * cierra (solo saltea, y no hay nada que saltear), `onRequestClose` es de
   * Android, y esto es un `Modal` a pantalla completa. Quedás encerrado en una
   * pantalla negra sin salida, y la única forma de salir es matar la app.
   *
   * Encontrado barriendo el 24/9, no usándola: es el caso raro de siempre, el
   * que aparece el día que el teléfono está cargado de cosas.
   *
   * SIETE SEGUNDOS: la más larga de las siete —la ignición 4 → 5— dura 5,2, y
   * esto tiene que llegar DESPUÉS de todas para no cortar ninguna. Si la
   * animación anduvo, cuando salte ya está formado y no hace nada.
   */
  useEffect(() => {
    const red = setTimeout(() => setFormado(true), 7000);
    return () => clearTimeout(red);
  }, []);

  const nombre = RANGOS.find((r) => r.n === rangoDespues)?.nombre ?? '';

  return (
    // `animationType="fade"`: entrar deslizando desde abajo lo haría una hoja
    // más, y esto no es una hoja — es la pantalla entera cambiando de estado.
    <Modal visible transparent={false} animationType="fade" onRequestClose={alCerrar}>
      <Pressable
        style={estilos.todo}
        // EL PRIMER TOQUE SALTEA, EL SEGUNDO CIERRA. Un toque accidental no se
        // lleva puesto lo único que la app celebra —te deja el objeto formado y
        // su nombre—, y el que ya la vio siete veces no tiene que esperar cinco
        // segundos mirando una pantalla que no responde.
        onPress={formado ? alCerrar : () => saltar.current?.()}
        accessibilityRole="button"
        accessibilityLabel={T.sesion.nuevoRango}
      >
        {/* LA TRANSFORMACIÓN, centrada y sin velo: acá es la protagonista, no
            el fondo de una pantalla con datos encima. */}
        <LienzoSubida
          rangoAntes={rangoAntes}
          rangoDespues={rangoDespues}
          planeta={planeta}
          alArrancar={(fn) => {
            saltar.current = fn;
          }}
          alTerminar={alTerminar}
        />

        <View style={estilos.texto}>
          {/* SOLO EXISTE UNA VEZ FORMADO, y no puesto con opacidad 0: así un
              lector de pantalla no canta el rango nuevo antes de tiempo, y una
              prueba que busca el nombre no se puede dar por satisfecha con la
              animación sin correr. Es lo que hace la web. */}
          {formado && (
            <Animated.View style={{ opacity: aparecer }}>
              <Text style={estilos.rotulo}>{T.sesion.nuevoRango}</Text>
              <Text style={estilos.nombre}>{nombre}</Text>
              {/* DE DÓNDE VENÍAS NO SE DICE (sacado el 23/9, a pedido). El
                  momento es el rango nuevo; nombrar el viejo al lado le
                  reparte la atención a lo que se acaba de dejar. */}
              {typeof racha === 'number' && racha > 0 && (
                <Text style={estilos.dia}>{T.sesion.rangoDia(racha)}</Text>
              )}
              <Text style={estilos.seguir}>{T.sesion.rangoSeguir}</Text>
            </Animated.View>
          )}
        </View>
      </Pressable>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  todo: { flex: 1, backgroundColor: C.fondo },
  // El texto abajo y el objeto en el medio: la forma se mira primero.
  texto: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 28, paddingBottom: 64 },
  rotulo: { color: C.sub, fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 10 },
  nombre: { color: C.tinta, fontSize: 32, fontWeight: '300', letterSpacing: -0.4 },
  dia: { color: C.apagado, fontSize: 13, marginTop: 4, fontVariant: ['tabular-nums'] },
  seguir: { color: C.apagado, fontSize: 12, marginTop: 26 },
});
