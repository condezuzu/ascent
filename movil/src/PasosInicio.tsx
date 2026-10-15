import { useEffect, useRef, useState, memo } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { T } from '@nucleo/textos';
import { CLAVE_FESTEJO_PASOS, hayQueFestejar } from '@nucleo/pasos';
import { hoyISO } from '@nucleo/fechas';
import { plataforma } from '@plataforma';
import { HojaDeMeta } from './GraficoPasos';
import { C, conAlfa } from './colores';

/**
 * LOS PASOS DE HOY, CON BARRA (5.1).
 *
 * Antes era un renglón "10.110 de 10.000 pasos": el "de" y el número de la meta
 * pegados hacían que llegar y no llegar se leyeran casi igual. Ahora el número
 * grande es lo tuyo (sin "de"), la meta va chica al costado, y una barra muestra
 * el avance de un vistazo. Al LLEGAR la barra se llena del color del rango, la
 * meta pasa a un ✓ y hay un latido corto: el momento tiene que NOTARSE, que era
 * justo lo que faltaba.
 *
 * El color de acento sale del rango (lo pasa Inicio): el logro se siente parte
 * del mismo mundo que el planeta del fondo, no un verde de sistema.
 */
function PasosInicio({
  pasos,
  meta,
  acento,
  compacto = false,
  alCambiarMeta,
}: {
  pasos: number;
  meta: number;
  acento: string;
  /** Mientras se entrena (8/10): el renglón solo, sin la barra, para no empujar el bloque. */
  compacto?: boolean;
  alCambiarMeta?: (meta: number) => void;
}) {
  const [cambiandoMeta, setCambiandoMeta] = useState(false);
  const llego = meta > 0 && pasos >= meta;
  const pct = meta > 0 ? Math.min(1, pasos / meta) : 0;

  const avance = useRef(new Animated.Value(0)).current; // 0..1 del ancho de la barra
  const latido = useRef(new Animated.Value(0)).current; // 0..1 del brillo al llegar
  const llegoAntes = useRef(llego);
  const crece = useRef(new Animated.Value(0)).current; // 0..1 del número al festejar
  const [festejando, setFestejando] = useState(false);

  // La barra crece hasta el avance de hoy, suave. Non-native (anima ancho).
  useEffect(() => {
    Animated.timing(avance, {
      toValue: pct,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [pct, avance]);

  // AL LLEGAR: un latido corto del brillo, UNA vez (cuando cruza, no cada dibujo).
  useEffect(() => {
    if (llego && !llegoAntes.current) {
      Animated.sequence([
        Animated.timing(latido, { toValue: 1, duration: 260, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(latido, { toValue: 0, duration: 900, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]).start();
    }
    llegoAntes.current = llego;
  }, [llego, latido]);

  // EL FESTEJO DEL DÍA (15/10): el latido de arriba casi nunca se veía —hay que
  // cruzar la meta CON Inicio abierto—. Este sale la primera vez del día que
  // Inicio la ve cumplida, aunque se haya llegado con el teléfono en el bolsillo.
  useEffect(() => {
    if (compacto || !llego) return;
    let vivo = true;
    void (async () => {
      const hoy = hoyISO();
      const ya = await plataforma.almacenamiento.leer(CLAVE_FESTEJO_PASOS).catch(() => null);
      if (!vivo || !hayQueFestejar(pasos, meta, ya, hoy)) return;
      void plataforma.almacenamiento.guardar(CLAVE_FESTEJO_PASOS, hoy).catch(() => {});
      setFestejando(true);
      plataforma.haptica.pulso();
      const pulso = (a: Animated.Value, alto: number) => [
        Animated.timing(a, { toValue: alto, duration: 280, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(a, { toValue: 0, duration: 700, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ];
      Animated.parallel([Animated.sequence([...pulso(latido, 1), ...pulso(latido, 1)]), Animated.sequence(pulso(crece, 1))]).start();
      setTimeout(() => vivo && setFestejando(false), 3200);
    })();
    return () => {
      vivo = false;
      // Si la sesión arranca a mitad del festejo, el temporizador ya no lo baja: se baja acá.
      setFestejando(false);
    };
    // Una vez por llegada: no se rearma con cada paso nuevo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [llego, compacto]);

  const ancho = avance.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  const escalaLatido = latido.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const escalaNumero = crece.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] });

  return (
    <>
    <Pressable
      testID={compacto ? 'pasos-en-sesion' : 'pasos-de-hoy'}
      style={[estilos.raiz, compacto && estilos.raizCompacta]}
      // La meta se cambia acá mismo (vuelta 7): mandaba a Ajustes, donde no estaba.
      onPress={compacto ? undefined : () => setCambiandoMeta(true)}
      accessibilityHint={compacto ? undefined : T.inicio.pasosCambiarMeta}
    >
      <View style={estilos.fila}>
        <Animated.Text style={[estilos.numero, { transform: [{ scale: escalaNumero }] }]}>
          {pasos.toLocaleString(T.general.locale)} <Text style={estilos.unidad}>{T.inicio.pasosUnidad}</Text>
        </Animated.Text>
        {llego ? (
          <Animated.Text testID={festejando ? 'pasos-festejo' : undefined} style={[estilos.meta, { color: acento, transform: [{ scale: escalaLatido }] }]}>
            {festejando ? T.inicio.pasosFestejo : T.inicio.pasosMetaLlego}
          </Animated.Text>
        ) : (
          <Text style={estilos.meta}>{T.inicio.pasosMetaChica(meta.toLocaleString(T.general.locale))}</Text>
        )}
      </View>
      {!compacto && (
      <View style={estilos.pista}>
        <Animated.View style={[estilos.relleno, { width: ancho, backgroundColor: acento }]} />
        {/* El brillo del latido: un velo del color que aparece y se va al llegar. */}
        <Animated.View
          pointerEvents="none"
          style={[estilos.brillo, { backgroundColor: acento, opacity: latido.interpolate({ inputRange: [0, 1], outputRange: [0, 0.5] }) }]}
        />
      </View>
      )}
    </Pressable>
    <HojaDeMeta visible={cambiandoMeta} alCerrar={() => setCambiandoMeta(false)} alCambiar={alCambiarMeta} />
    </>
  );
}

const estilos = StyleSheet.create({
  raiz: { marginTop: 14, gap: 7 },
  raizCompacta: { marginTop: 8, marginBottom: 2 },
  fila: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  // El origen del crecimiento a la izquierda: así crece desde donde empieza el número.
  numero: { color: C.tinta, fontSize: 15, fontVariant: ['tabular-nums'], transformOrigin: 'left' },
  unidad: { color: C.sub, fontSize: 13 },
  meta: { color: C.apagado, fontSize: 12, fontVariant: ['tabular-nums'] },
  pista: { height: 6, borderRadius: 999, backgroundColor: conAlfa(C.tinta, 0.08), overflow: 'hidden' },
  relleno: { height: '100%', borderRadius: 999 },
  brillo: { ...StyleSheet.absoluteFillObject, borderRadius: 999 },
});

// Con los mismos props no se redibuja: el + de la sesión redibuja Inicio y esto no cambió (15/10).
export default memo(PasosInicio);
