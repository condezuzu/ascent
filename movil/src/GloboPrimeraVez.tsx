import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { faltaElGlobo, marcarGloboVisto, type Globo } from '@compartido/guia';
import { T } from '@nucleo/textos';
import { supabase } from './supabase';
import { C, conAlfa } from './colores';

/**
 * UNA LÍNEA EXPLICANDO LA PANTALLA, la primera vez y nunca más (§10).
 *
 * QUEDAN DOS Y NO CINCO, y el porqué es el recorrido: Stats, Álbum, Ranking y
 * Ajustes ya los presenta él, una línea por pantalla. Estos dos explican algo
 * que el recorrido no puede mostrar porque no está ahí cuando pasa: contar
 * series adentro de una sesión, y que las fotos del perfil son privadas.
 *
 * ARRANCA ESCONDIDO y aparece recién cuando se confirmó que falta verlo.
 * Mostrarlo mientras se consulta haría que el que ya lo cerró lo viera
 * parpadear en cada visita, que es peor que no tenerlo.
 *
 * SE CIERRA Y NO VUELVE, salvo "ver la guía de nuevo" desde Ajustes.
 */
export default function GloboPrimeraVez({
  cual,
  children,
  cerrarCuando = false,
}: {
  cual: Globo;
  children: string;
  /**
   * Se cierra solo —y queda visto— cuando esto pasa a `true`: la cosa que
   * explica ya se usó. El de las series se va con el primer `+` (19/9).
   */
  cerrarCuando?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const [uid, setUid] = useState('');
  const opacidad = useRef(new Animated.Value(0)).current;
  const cerrando = useRef(false);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const u = data.session?.user?.id;
      if (!vivo || !u) return;
      setUid(u);
      if (await faltaElGlobo(u, cual)) {
        if (!vivo) return;
        setVisible(true);
        Animated.timing(opacidad, { toValue: 1, duration: 260, useNativeDriver: true }).start();
      }
    })();
    return () => {
      vivo = false;
    };
  }, [cual, opacidad]);

  useEffect(() => {
    if (!cerrarCuando || !visible || cerrando.current) return;
    cerrando.current = true;
    // No se espera a que se guarde para cerrar: el globo se va ya, y que
    // quede anotado es asunto de después.
    if (uid) void marcarGloboVisto(uid, cual);
    Animated.timing(opacidad, { toValue: 0, duration: 220, useNativeDriver: true }).start(() =>
      setVisible(false)
    );
  }, [cerrarCuando, visible, uid, cual, opacidad]);

  if (!visible) return null;

  function cerrar() {
    if (cerrando.current) return;
    cerrando.current = true;
    if (uid) void marcarGloboVisto(uid, cual);
    Animated.timing(opacidad, { toValue: 0, duration: 220, useNativeDriver: true }).start(() =>
      setVisible(false)
    );
  }

  return (
    <Animated.View style={[estilos.globo, { opacity: opacidad }]}>
      <Text style={estilos.texto}>{children}</Text>
      <Pressable onPress={cerrar} hitSlop={12} accessibilityLabel={T.general.entendido}>
        {/* Una cruz de dos rayas, sin SVG: son dos vistas rotadas y se dibuja
            igual, sin sumarle un paquete a la app por seis píxeles. */}
        <View style={estilos.cruz}>
          <View style={[estilos.raya, { transform: [{ rotate: '45deg' }] }]} />
          <View style={[estilos.raya, { transform: [{ rotate: '-45deg' }] }]} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

const estilos = StyleSheet.create({
  globo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.linea,
    backgroundColor: conAlfa(C.hoja, 0.92),
  },
  texto: { flex: 1, color: C.sub, fontSize: 13, lineHeight: 18 },
  cruz: { width: 14, height: 14, alignItems: 'center', justifyContent: 'center' },
  raya: { position: 'absolute', width: 14, height: 1.6, borderRadius: 1, backgroundColor: C.apagado },
});
