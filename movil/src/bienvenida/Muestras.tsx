import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { T } from '@nucleo/textos';
import { DIAS_SEMANA } from '@nucleo/fechas';
import { C, conAlfa } from '../colores';

/**
 * LO QUE SE VE ARRIBA DE CADA TEXTO DE LA ENTRADA (15/10): un pedazo de la app con
 * datos de muestra, que se mueve solo. Es la misma reconstrucción que se aprobó en
 * la galería (`src/app/galeria/propuestas/bienvenida`), con las medidas de la app.
 * `t` son los segundos desde que apareció la pantalla.
 */

/** El bloque de Inicio: las píldoras, el peso de la última vez y los puntos llenándose. */
export function MiniBloque({ t }: { t: number }) {
  const hechas = Math.floor(t / 1.2) % 4;
  return (
    <View style={estilos.caja}>
      <Text style={estilos.ejercicio}>{T.bienvenida.muestraEjercicio}</Text>
      <View style={estilos.pildoras}>
        {[2, 3, 4, 5].map((m) => (
          <View key={m} style={[estilos.pildora, m === 3 && estilos.pildoraElegida]}>
            <Text style={[estilos.pildoraTexto, m === 3 && estilos.pildoraTextoElegida]}>×{m}</Text>
          </View>
        ))}
      </View>
      <View style={estilos.filaPeso}>
        <Text style={estilos.peso}>
          60 <Text style={estilos.unidad}>kg</Text>
          <Text style={estilos.laUltima}>{'  ' + T.bienvenida.muestraLaUltimaVez}</Text>
        </Text>
        <View style={estilos.puntos}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={[estilos.punto, i < hechas && estilos.puntoLleno]} />
          ))}
        </View>
      </View>
      <View style={estilos.mas}>
        <Text style={estilos.masTexto}>+</Text>
      </View>
    </View>
  );
}

/** La semana, con el día de hoy llenándose cuando "llegás". */
export function MiniSemana({ t }: { t: number }) {
  const llego = Math.floor(t / 2.4) % 2 === 1;
  // Lunes primero, como la tira de Inicio.
  const letras = [1, 2, 3, 4, 5, 6, 0].map((d) => DIAS_SEMANA[d]);
  return (
    <View style={[estilos.caja, { paddingHorizontal: 14 }]}>
      <View style={estilos.llegada}>
        <Svg width={16} height={20} viewBox="0 0 16 20">
          <Path d="M8 19s6-6.2 6-11A6 6 0 0 0 2 8c0 4.8 6 11 6 11z" fill="none" stroke={llego ? C.tinta : C.sub} strokeWidth={1.5} />
          <Circle cx={8} cy={8} r={2.2} fill={llego ? C.tinta : C.sub} />
        </Svg>
        <Text style={[estilos.llegadaTexto, llego && { color: C.tinta }]}>{llego ? T.bienvenida.muestraLlegaste : T.bienvenida.muestraDeCamino}</Text>
      </View>
      <View style={estilos.dias}>
        {letras.map((d, i) => (
          <View key={i} style={estilos.dia}>
            <View style={[estilos.circulo, i === 3 && { borderColor: C.claro }, (i < 3 || (i === 3 && llego)) && { backgroundColor: C.claro }]} />
            <Text style={estilos.letra}>{d}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** El punto de "en vivo", con su latido. */
function Vivo() {
  const latido = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.loop(Animated.timing(latido, { toValue: 1, duration: 1800, easing: Easing.out(Easing.quad), useNativeDriver: true }));
    anim.start();
    return () => anim.stop();
  }, [latido]);
  return (
    <View style={estilos.vivo}>
      <Animated.View
        style={[
          estilos.vivoAro,
          {
            opacity: latido.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] }),
            transform: [{ scale: latido.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.5] }) }],
          },
        ]}
      />
      <View style={estilos.vivoPunto} />
    </View>
  );
}

/** "Entrenando contigo", vivo: el descanso corre y, al terminar, la serie avanza. */
export function MiniAmigo({ t }: { t: number }) {
  // Lucía: 12 s de descanso, 6 s haciendo la serie, y vuelta.
  const ciclo = t % 18;
  const serie = 2 + (Math.floor(t / 18) % 3);
  const descansa = ciclo < 12;
  const falta = Math.ceil(12 - ciclo) + 60;
  const mateoDescansa = (t + 7) % 14 < 6;
  const fila = (inicial: string, nombre: string, que: string, derecha: React.ReactNode) => (
    <View style={estilos.persona}>
      <View style={estilos.avatar}>
        <Text style={estilos.inicial}>{inicial}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={estilos.nombreFila}>
          <Text style={estilos.nombre}>{nombre}</Text>
          <Vivo />
        </View>
        <Text style={estilos.que}>{que}</Text>
      </View>
      {derecha}
    </View>
  );
  return (
    <View style={[estilos.caja, { paddingVertical: 6 }]}>
      <Text style={estilos.rotulo}>{T.bienvenida.muestraEntrenandoContigo}</Text>
      {fila(
        'L',
        'lucia',
        T.bienvenida.muestraSerie(T.bienvenida.muestraSentadilla, serie, 4),
        descansa ? (
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={estilos.reloj}>
              {Math.floor(falta / 60)}:{String(falta % 60).padStart(2, '0')}
            </Text>
            <Text style={estilos.relojRotulo}>{T.bienvenida.muestraDescanso}</Text>
          </View>
        ) : (
          <Text style={estilos.haciendo}>{T.bienvenida.muestraHaciendoLaSerie}</Text>
        )
      )}
      <View style={estilos.separador} />
      {fila('M', 'mateo', T.bienvenida.muestraSerie(T.bienvenida.muestraRemo, 1, 3), <Text style={estilos.estado}>{mateoDescansa ? T.bienvenida.muestraDescansa : T.bienvenida.muestraAhora}</Text>)}
    </View>
  );
}

const estilos = StyleSheet.create({
  caja: { borderWidth: 1, borderColor: C.linea, borderRadius: 14, paddingVertical: 16, paddingHorizontal: 18, backgroundColor: conAlfa(C.hoja, 0.72) },
  ejercicio: { color: C.tinta, fontSize: 17 },
  pildoras: { flexDirection: 'row', gap: 6, marginVertical: 14 },
  pildora: { flex: 1, alignItems: 'center', borderWidth: 1, borderColor: C.linea, borderRadius: 999, paddingVertical: 7 },
  pildoraElegida: { borderColor: C.sub },
  pildoraTexto: { color: C.apagado, fontSize: 13 },
  pildoraTextoElegida: { color: C.tinta },
  filaPeso: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  peso: { color: C.tinta, fontSize: 22, fontWeight: '300' },
  unidad: { color: C.sub, fontSize: 14 },
  laUltima: { color: C.apagado, fontSize: 12 },
  puntos: { flexDirection: 'row', gap: 8 },
  punto: { width: 14, height: 14, borderRadius: 7, borderWidth: 1, borderColor: C.sub },
  puntoLleno: { backgroundColor: C.claro, borderColor: C.claro },
  mas: { marginTop: 14, borderWidth: 1, borderColor: C.lineaFuerte, borderRadius: 4, paddingVertical: 12, alignItems: 'center' },
  masTexto: { color: C.tinta, fontSize: 22 },
  llegada: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  llegadaTexto: { color: C.sub, fontSize: 14 },
  dias: { flexDirection: 'row', justifyContent: 'space-between' },
  dia: { alignItems: 'center', gap: 8 },
  circulo: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: C.lineaFuerte },
  letra: { color: C.apagado, fontSize: 12 },
  rotulo: { color: C.apagado, fontSize: 10, letterSpacing: 2.2, textTransform: 'uppercase', paddingTop: 10, paddingBottom: 2 },
  persona: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  avatar: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: C.lineaFuerte, alignItems: 'center', justifyContent: 'center' },
  inicial: { color: C.tinta, fontSize: 14 },
  nombreFila: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nombre: { color: C.tinta, fontSize: 15 },
  que: { color: C.sub, fontSize: 13, marginTop: 2 },
  reloj: { color: C.tinta, fontSize: 17, fontVariant: ['tabular-nums'] },
  relojRotulo: { color: C.sub, fontSize: 11 },
  haciendo: { color: C.claro, fontSize: 13 },
  estado: { color: C.sub, fontSize: 13 },
  separador: { height: StyleSheet.hairlineWidth, backgroundColor: C.linea },
  vivo: { width: 7, height: 7, alignItems: 'center', justifyContent: 'center' },
  vivoPunto: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.vivo },
  vivoAro: { position: 'absolute', width: 15, height: 15, borderRadius: 8, borderWidth: 1, borderColor: C.vivo },
});
