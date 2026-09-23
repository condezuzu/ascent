import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { RANGOS } from '@nucleo/rangos';
import { T } from '@nucleo/textos';
import { plataforma } from '@plataforma';
import FondoEspacial from './FondoEspacial';
import { C } from './colores';

/** Lo que tarda en formarse el objeto nuevo antes de que aparezca su nombre. */
const FORMARSE_MS = 2600;

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
 * NO SE NOMBRA LO QUE VIENE DESPUÉS (§7). Se dice el rango al que llegaste y
 * el que dejaste atrás; cuántos hay y cuál sigue, nunca. Descubrir en qué te
 * vas a convertir es la recompensa.
 *
 * EL OBJETO ES EL DE VERDAD, no un dibujo: `FondoEspacial` con el rango nuevo,
 * el mismo motor que pinta la pantalla principal. Lo que NO está es la
 * coreografía de la web —el objeto viejo se deshace y el nuevo se arma con sus
 * partículas, que en `src/motor/subida.ts` es una secuencia propia—. Acá el
 * nuevo se forma con la animación de entrada del motor. Es menos, y se nota;
 * es muchísimo más que nada, que es lo que había.
 */
export default function SubidaRango({
  rangoAntes,
  rangoDespues,
  planeta,
  racha,
  alCerrar,
}: {
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

  useEffect(() => {
    // EL NOMBRE APARECE ÚLTIMO, cuando el objeto ya está formado: si entrara
    // junto con él, se leería el nombre y no se miraría la forma, que es lo
    // que de verdad cambió.
    const t = setTimeout(() => {
      setFormado(true);
      plataforma.haptica.pulso();
      Animated.timing(aparecer, { toValue: 1, duration: 700, useNativeDriver: true }).start();
    }, FORMARSE_MS);
    return () => clearTimeout(t);
  }, [aparecer]);

  const nombre = RANGOS.find((r) => r.n === rangoDespues)?.nombre ?? '';
  const anterior = RANGOS.find((r) => r.n === rangoAntes)?.nombre ?? '';

  return (
    // `animationType="fade"`: entrar deslizando desde abajo lo haría una hoja
    // más, y esto no es una hoja — es la pantalla entera cambiando de estado.
    <Modal visible transparent={false} animationType="fade" onRequestClose={alCerrar}>
      <Pressable
        style={estilos.todo}
        // SOLO SE PUEDE SALIR UNA VEZ FORMADO. Tocar antes no cierra: el
        // momento dura menos de tres segundos y saltearlo de un toque
        // accidental sería perderse lo único que la app celebra.
        onPress={formado ? alCerrar : undefined}
        accessibilityRole="button"
        accessibilityLabel={T.sesion.nuevoRango}
      >
        {/* EL OBJETO NUEVO, centrado y sin velo: acá es el protagonista, no el
            fondo de una pantalla con datos encima. */}
        <FondoEspacial rango={rangoDespues} planeta={planeta ?? undefined} esquina="centro" />

        <View style={estilos.texto}>
          <Animated.View style={{ opacity: aparecer }}>
            <Text style={estilos.rotulo}>{T.sesion.nuevoRango}</Text>
            <Text style={estilos.nombre}>{nombre}</Text>
            {/* De dónde venís, en voz baja: el rango nuevo es el que manda. */}
            {anterior !== '' && <Text style={estilos.desde}>{T.sesion.rangoDesde(anterior)}</Text>}
            {typeof racha === 'number' && racha > 0 && (
              <Text style={estilos.dia}>{T.sesion.rangoDia(racha)}</Text>
            )}
            <Text style={estilos.seguir}>{T.sesion.rangoSeguir}</Text>
          </Animated.View>
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
  desde: { color: C.sub, fontSize: 14, lineHeight: 20, marginTop: 10 },
  dia: { color: C.apagado, fontSize: 13, marginTop: 4, fontVariant: ['tabular-nums'] },
  seguir: { color: C.apagado, fontSize: 12, marginTop: 26 },
});
