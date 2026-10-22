import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { pasadoDe } from '@nucleo/avisoDescanso';
import CompaneroEnDescanso from './CompaneroEnDescanso';
import { PRESETS_DESCANSO, descansoAMano } from '@nucleo/reglas';
import { T } from '@nucleo/textos';
import { plataforma } from '@plataforma';
import {
  borrarDescanso,
  cambiarDuracion,
  cuentaAtras,
  duracionCorta,
  leerSonido,
  restante,
  avisarFin,
  type DescansoVivo,
} from '@compartido/descanso';
import { C } from './colores';
import { taparElFondo } from './desenfoqueDelFondo';
import { useArriba } from './zonaSegura';
import { cuentaLaSerie } from './toques';

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
  acento,
  alReiniciar,
  alSaltar,
  alOcultar,
  alSumar,
  sinEmpezar,
}: {
  visible: boolean;
  vivo: DescansoVivo;
  /**
   * SIN EMPEZAR (21/10, a pedido): el botón «Descansar» de Inicio trae acá con el reloj quieto en
   * la duración, para elegir los minutos antes de arrancar. Antes arrancaba en el acto, y
   * cambiar los minutos era cambiar uno que ya corría. `vivo.duracion` es la que se ve.
   */
  sinEmpezar?: { alElegir: (segundos: number) => void; alEmpezar: () => void };
  /** El color del arco. Hoy, el del rango de cada uno; se decide en un solo lugar (Inicio). */
  acento: string;
  alReiniciar: (d: DescansoVivo) => void;
  alSaltar: () => void;
  /** Cerrar la pantalla SIN cortar el descanso: sigue en la píldora de arriba. */
  alOcultar: () => void;
  /** Sumar la serie sin salir: suma y vuelve a arrancar el descanso. */
  alSumar: () => void;
}) {
  const arriba = useArriba(56);
  const [, repintar] = useState(0);
  // Opaca y a pantalla completa: mientras se ve, el fondo 3D no tiene por qué dibujar.
  useEffect(() => {
    if (!visible) return;
    const yo = Symbol('descanso');
    taparElFondo(yo, true);
    return () => taparElFondo(yo, false);
  }, [visible]);
  // El "+": `null` cerrado; si no, lo que se va escribiendo.
  const [aMano, setAMano] = useState<string | null>(null);
  const quieto = !!sinEmpezar;
  const [terminado, setTerminado] = useState(() => !quieto && restante(vivo.fin) === 0);
  const yaAviso = useRef(terminado);
  const sonido = useRef(false);

  // Un descanso nuevo (el + desde acá) vuelve a dejar pendiente el aviso.
  useEffect(() => {
    const listo = !quieto && restante(vivo.fin) === 0;
    yaAviso.current = listo;
    setTerminado(listo);
    // El campo del + es de este descanso: no vuelve abierto en el siguiente (vuelta 7).
    setAMano(null);
  }, [vivo.fin]);
  // Ni al cerrar la pantalla sin usarlo.
  useEffect(() => {
    if (!visible) setAMano(null);
  }, [visible]);

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

  // UNA VEZ Y A TIEMPO (12/10): `avisarFin` no vibra si ya avisó el reloj
  // del fin o la notificación, ni si el descanso terminó hace rato y recién
  // ahora se lo mira (volver a la app a los cinco minutos vibraba tres veces
  // por nada). Desde el 14/10 lo normal es que ya haya sonado `sonarFin`.
  const avisar = useCallback((fin: number) => {
    if (!avisarFin(fin)) return;
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
    // Quieto no hay nada que contar ni que avisar.
    if (!visible || quieto) return;
    const tic = () => {
      if (restante(vivo.fin) === 0 && !yaAviso.current) {
        yaAviso.current = true;
        setTerminado(true);
        avisar(vivo.fin);
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
  }, [visible, vivo.fin, avisar, quieto]);

  function usarPreset(segundos: number) {
    if (sinEmpezar) return sinEmpezar.alElegir(segundos);
    const nuevo = cambiarDuracion(vivo, segundos);
    const listo = restante(nuevo.fin) === 0;
    yaAviso.current = listo;
    setTerminado(listo);
    alReiniciar(nuevo);
  }

  const falta = quieto ? vivo.duracion : restante(vivo.fin);
  const proporcion = terminado ? 0 : Math.min(1, falta / vivo.duracion);
  const ahora = Date.now();
  // Lo que se estaba haciendo: lo mismo que dice la tarjeta de la pantalla bloqueada.
  const serie = vivo.serie && vivo.serie > 0 ? T.descanso.serieDe(vivo.serie, vivo.meta ?? 0) : null;

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={alOcultar} statusBarTranslucent>
      <View style={[estilos.pantalla, { paddingTop: arriba }]}>
        <Pressable style={estilos.cerrar} onPress={alOcultar} accessibilityLabel={T.descanso.cerrar}>
          <Text style={estilos.cerrarTexto}>✕</Text>
        </Pressable>

        {/* ARRIBA, CHICO: qué estabas haciendo (12/10). Antes la pantalla era un
            número solo: decía cuándo volver y nada sobre a qué. */}
        <View style={estilos.arriba}>
          <Text style={estilos.rotulo}>{T.descanso.rotulo}</Text>
          {!!vivo.ejercicio && (
            <Text style={estilos.ejercicio} numberOfLines={1}>
              {vivo.ejercicio}
            </Text>
          )}
          {serie && <Text style={estilos.serie}>{serie}</Text>}
        </View>

        {/* EL ARCO SE VACÍA, con el color de quien entrena. Al terminar queda en 0:00
            sin cambiar de pantalla (19/10, aprobado en la galería), y lo que te pasaste
            va chico abajo a la derecha. */}
        <View style={estilos.centro}>
          <View style={estilos.arco}>
            <Svg width={LADO} height={LADO} style={estilos.dibujo}>
              <Circle cx={LADO / 2} cy={LADO / 2} r={RADIO} fill="none" stroke={C.linea} strokeWidth={2} />
              <Circle
                cx={LADO / 2}
                cy={LADO / 2}
                r={RADIO}
                fill="none"
                stroke={acento}
                strokeWidth={4}
                strokeLinecap="round"
                strokeDasharray={LARGO}
                strokeDashoffset={LARGO * (1 - proporcion)}
              />
            </Svg>
            <Text testID="descanso-reloj" style={estilos.numero} accessibilityLiveRegion="polite">
              {cuentaAtras(falta)}
            </Text>
            {terminado && (
              <Text testID="descanso-de-mas" style={estilos.deMas} accessibilityLabel={`${cuentaAtras(pasadoDe(vivo.fin, ahora))} ${T.descanso.deMas}`}>
                +{cuentaAtras(pasadoDe(vivo.fin, ahora))}
              </Text>
            )}
          </View>
        </View>

        {terminado ? (
          <View style={estilos.abajo}>
            <Pressable style={[estilos.solido, { backgroundColor: acento, borderColor: acento }]} onPress={() => cuentaLaSerie() && alSumar()}>
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
            {/* "SERIE HECHA" ES UN BOTÓN, no un enlace: sumar la serie sin salir
                es lo que más se hace desde acá. */}
            {sinEmpezar ? (
              <Pressable testID="descanso-empezar" style={[estilos.solido, { backgroundColor: acento, borderColor: acento }]} onPress={sinEmpezar.alEmpezar}>
                <Text style={estilos.solidoTexto}>{T.descanso.empezar}</Text>
              </Pressable>
            ) : (
              <Pressable style={estilos.borde} onPress={() => cuentaLaSerie() && alSumar()}>
                <Text style={estilos.bordeTexto}>{T.descanso.serieHecha}</Text>
              </Pressable>
            )}
            <View style={estilos.presets}>
              {PRESETS_DESCANSO.map((p) => (
                <Pressable key={p} style={[estilos.preset, p === vivo.duracion && estilos.presetActivo]} onPress={() => usarPreset(p)}>
                  <Text style={[estilos.presetTexto, p === vivo.duracion && estilos.presetTextoActivo]}>{duracionCorta(p)}</Text>
                </Pressable>
              ))}
              {/* Lo puesto a mano también se ve elegido, junto al resto. */}
              {!PRESETS_DESCANSO.includes(vivo.duracion) && (
                <View style={[estilos.preset, estilos.presetActivo]}>
                  <Text style={[estilos.presetTexto, estilos.presetTextoActivo]}>{duracionCorta(vivo.duracion)}</Text>
                </View>
              )}
              <Pressable
                testID="descanso-a-mano"
                style={[estilos.preset, aMano !== null && estilos.presetActivo]}
                onPress={() => setAMano(aMano === null ? '' : null)}
                accessibilityLabel={T.descanso.aMano}
                accessibilityRole="button"
              >
                <Text style={[estilos.presetTexto, aMano !== null && estilos.presetTextoActivo]}>+</Text>
              </Pressable>
            </View>
            {aMano !== null && (
              <View style={estilos.aMano}>
                <TextInput
                  testID="descanso-a-mano-campo"
                  style={estilos.aManoCampo}
                  value={aMano}
                  onChangeText={setAMano}
                  placeholder={T.descanso.aManoEjemplo}
                  placeholderTextColor={C.apagado}
                  keyboardType="numbers-and-punctuation"
                  autoFocus
                  maxLength={5}
                  onSubmitEditing={() => {
                    const s = descansoAMano(aMano);
                    if (s !== null) {
                      usarPreset(s);
                      setAMano(null);
                    }
                  }}
                />
                <Pressable
                  testID="descanso-a-mano-usar"
                  style={[estilos.preset, estilos.presetActivo]}
                  disabled={descansoAMano(aMano) === null}
                  onPress={() => {
                    const s = descansoAMano(aMano);
                    if (s === null) return;
                    usarPreset(s);
                    setAMano(null);
                  }}
                >
                  <Text style={[estilos.presetTexto, estilos.presetTextoActivo, descansoAMano(aMano) === null && { color: C.apagado }]}>
                    {T.descanso.aManoUsar}
                  </Text>
                </Pressable>
              </View>
            )}
            {aMano !== null && aMano.trim() !== '' && descansoAMano(aMano) === null && <Text style={estilos.aManoMal}>{T.descanso.aManoMal}</Text>}
            <Pressable style={estilos.texto} onPress={alOcultar}>
              <Text style={estilos.textoBoton}>{quieto ? T.general.cancelar : T.descanso.saltar}</Text>
            </Pressable>
          </View>
        )}

        <CompaneroEnDescanso visible={visible} ahora={ahora} />
      </View>
    </Modal>
  );
}

// El arco: 272 de lado entra con aire en el teléfono más angosto (320).
const RADIO = 128;
const LADO = RADIO * 2 + 16;
const LARGO = 2 * Math.PI * RADIO;

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: C.fondo, paddingHorizontal: 24, paddingTop: 56, paddingBottom: 30 },
  cerrar: { position: 'absolute', top: 48, right: 16, minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  cerrarTexto: { color: C.sub, fontSize: 20 },
  arriba: { alignItems: 'center', minHeight: 70 },
  rotulo: { color: C.sub, fontSize: 11, letterSpacing: 2.6 },
  ejercicio: { color: C.tinta, fontSize: 19, marginTop: 8, maxWidth: '80%' },
  serie: { color: C.sub, fontSize: 14, marginTop: 3 },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  arco: { width: LADO, height: LADO, alignItems: 'center', justifyContent: 'center' },
  // Girado un cuarto: el arco arranca arriba, como un reloj.
  dibujo: { position: 'absolute', top: 0, left: 0, transform: [{ rotate: '-90deg' }] },
  numero: { color: C.tinta, fontSize: 84, fontWeight: '200', fontVariant: ['tabular-nums'] },
  // En la esquina del cuadrado del arco, afuera del círculo.
  deMas: { position: 'absolute', right: 4, bottom: 4, color: C.sub, fontSize: 15, fontVariant: ['tabular-nums'] },
  abajo: { alignItems: 'stretch' },
  solido: { borderWidth: 1, borderRadius: 4, paddingVertical: 16, alignItems: 'center' },
  solidoTexto: { color: C.fondo, fontSize: 16, fontWeight: '600' },
  borde: { borderWidth: 1, borderColor: C.sub, borderRadius: 4, paddingVertical: 16, alignItems: 'center' },
  bordeTexto: { color: C.tinta, fontSize: 16 },
  presets: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 12 },
  aMano: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 10 },
  aManoCampo: { color: C.tinta, fontSize: 16, minWidth: 170, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.lineaFuerte, paddingVertical: 6, textAlign: 'center', fontVariant: ['tabular-nums'] },
  aManoMal: { color: C.sub, fontSize: 12, textAlign: 'center', marginTop: 6 },
  preset: { borderWidth: 1, borderColor: C.linea, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 11 },
  presetActivo: { borderColor: C.sub },
  presetTexto: { color: C.apagado, fontSize: 12 },
  presetTextoActivo: { color: C.tinta },
  texto: { paddingVertical: 9, alignItems: 'center' },
  textoBoton: { color: C.sub, fontSize: 14 },
});
