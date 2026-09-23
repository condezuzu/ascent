import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { hoyISO } from '@nucleo/fechas';
import { mirarElGimnasio } from '@compartido/gimnasio';
import { leerVigilancia } from '@compartido/sesionCache';
import { anotar, borrarBitacora, comoTexto, leerBitacora } from '@compartido/bitacora';
import { cuantasPendientes, vaciar } from '@compartido/cola';
import { plataforma } from '@plataforma';
import { T } from '@nucleo/textos';
import type { OrigenSesion, Perfil } from '@nucleo/tipos';
import { supabase } from '../supabase';
import SubidaRango from '../SubidaRango';
import { C } from '../colores';
import { comoLeyoLosPasos } from '../plataforma/salud';
import { comoAnduvoElMotor, type EstadoDelMotor } from '../estadoDelMotor';
import { medirCuadros, type Medicion } from '../medirCuadros';

/**
 * QUÉ ESTÁ VIENDO LA APP, Y QUÉ FUE HACIENDO.
 *
 * EXISTE POR UNA RAZÓN SOLA, y acá es más cierta que en la web: **el registro
 * por ubicación solo se puede probar caminando hasta un gimnasio**. Ahí no hay
 * consola, ni terminal, ni forma de mirar nada — y desde que el teléfono
 * despierta a la app con la pantalla bloqueada, buena parte de lo que pasa
 * ocurre sin que haya siquiera una pantalla dibujada. Todo queda anotado, y
 * esto es donde se lee después, en casa, con calma.
 *
 * ESTA PANTALLA FALTABA EN EL TELÉFONO (23/9) y es la que más falta hacía: la
 * web la tenía desde que existe el vigilante, y la app —la única de las dos
 * donde el automático funciona de verdad— no. Se anotaba todo y no había forma
 * de leerlo.
 *
 * VA PLEGADA Y ABAJO DE TODO: no es una pantalla de la app, es un banco de
 * trabajo. Se saca cuando el automático esté probado.
 *
 * LO QUE AGREGA SOBRE LA WEB, y las dos cosas salieron de que el automático
 * acá es de verdad:
 *
 * 1. **Revisar la zona.** Es LA pregunta del teléfono y en la web no existe:
 *    sin el permiso de ubicación "siempre", el geofence no se arma, la app
 *    sigue andando igual, y la única diferencia es que el día no entra con la
 *    app cerrada — justo lo que se fue a probar.
 * 2. **Compartir lo anotado.** En la web se selecciona el texto y listo; en un
 *    teléfono, seleccionar doce líneas con el dedo es una pelea. Va por
 *    `Share` de React Native, que es del núcleo: agregar `expo-clipboard`
 *    habría sido un módulo nativo, o sea una build nueva y las
 *    actualizaciones por el aire cortadas, por un botón de copiar.
 */
export default function Diagnostico({ perfil }: { perfil: Perfil }) {
  const [abierto, setAbierto] = useState(false);
  const [dia, setDia] = useState<{ origen: string } | null>(null);
  const [sinDia, setSinDia] = useState(false);
  const [sesion, setSesion] = useState<{
    corriendo: boolean;
    inicio?: string;
    origen?: OrigenSesion;
  } | null>(null);
  const [visita, setVisita] = useState<Awaited<ReturnType<typeof leerVigilancia>>>(null);
  const [lineas, setLineas] = useState('');
  const [mirando, setMirando] = useState(false);
  const [pendientes, setPendientes] = useState(0);
  const [zona, setZona] = useState<boolean | null>(null);
  // Ver la subida de rango sin tener que llegar al día 11. Ver abajo.
  const [verSubida, setVerSubida] = useState(false);
  // El medidor de cuadros. Ver abajo y `medirCuadros.ts`.
  const [cuadros, setCuadros] = useState<Medicion | null>(null);
  const [midiendoCuadros, setMidiendoCuadros] = useState(false);

  const cargar = useCallback(async () => {
    const { data: log } = await supabase
      .from('logs')
      .select('origen')
      .eq('user_id', perfil.id)
      .eq('fecha', hoyISO())
      .maybeSingle();
    setDia(log);
    setSinDia(!log);
    const { data: s } = await supabase.rpc('mi_sesion');
    setSesion(s);
    setVisita(await leerVigilancia());
    setLineas(comoTexto(await leerBitacora()));
    setPendientes(await cuantasPendientes());
  }, [perfil.id]);

  useEffect(() => {
    if (abierto) cargar();
  }, [abierto, cargar]);

  /**
   * Mirar AHORA, a mano. Es lo que se aprieta parado en la puerta del gimnasio
   * para ver a cuántos metros dice que estás: la única forma de saber si el
   * radio quedó bien sin esperar los siete minutos.
   */
  async function mirarAhora() {
    setMirando(true);
    const m = await mirarElGimnasio(perfil);
    await anotar('miré a mano', {
      adentro: m.adentro === null ? 'no sé' : m.adentro,
      metros: m.metros,
      precision: m.precision,
      radio: perfil.gimnasio_radio,
    });
    setMirando(false);
    cargar();
  }

  /**
   * ¿QUEDÓ REGISTRADA LA ZONA EN EL SISTEMA? Es la pregunta que en la web no
   * existe y acá es LA pregunta: sin permiso de ubicación "siempre" el
   * geofence no se arma, la app sigue andando igual, y la única diferencia es
   * que el día no entra con la app cerrada — que es justo lo que se fue a
   * probar. Volver a pedirla es idempotente: `startGeofencing` reemplaza la
   * zona anterior de la misma tarea.
   */
  async function revisarZona() {
    if (!perfil.gimnasio_lat || !perfil.gimnasio_lon) return setZona(false);
    const quedo = await plataforma.ubicacion.vigilarLlegada(
      { lat: perfil.gimnasio_lat, lon: perfil.gimnasio_lon },
      perfil.gimnasio_radio,
      () => {}
    );
    setZona(quedo);
    await anotar(quedo ? 'zona: registrada' : 'zona: NO se pudo (falta el permiso siempre)', {});
    cargar();
  }

  // Los cinco estados del motor, dichos. Es un mapa y no un `if` encadenado
  // para que agregar un estado en `estadoDelMotor.ts` sin contarlo acá no
  // compile.
  const DICE_EL_MOTOR: Record<EstadoDelMotor, string> = {
    'sin-pedido': T.ajustes.diagMotorSinPedido,
    apagado: T.ajustes.diagMotorApagado,
    arrancando: T.ajustes.diagMotorArrancando,
    andando: T.ajustes.diagMotorAndando,
    'no-arranco': T.ajustes.diagMotorNoArranco,
  };

  const hora = (iso?: string | null) =>
    iso
      ? new Date(iso).toLocaleTimeString(T.general.locale, { hour: '2-digit', minute: '2-digit' })
      : '—';
  const horaMs = (ms?: number | null) => (ms ? hora(new Date(ms).toISOString()) : '—');

  const filas: [string, string][] = [
    [
      T.ajustes.diagPunto,
      perfil.gimnasio_lat ? T.ajustes.diagRadio(perfil.gimnasio_radio) : T.ajustes.diagSinPunto,
    ],
    [T.ajustes.diagDia, sinDia ? T.ajustes.diagSinDia : (dia?.origen ?? '—')],
    [
      T.ajustes.diagSesion,
      sesion?.corriendo
        ? `${sesion.origen ?? '—'} · ${T.ajustes.diagDesde(hora(sesion.inicio))}`
        : T.ajustes.diagSinSesion,
    ],
    [T.ajustes.diagCola, pendientes === 0 ? T.ajustes.diagColaVacia : T.ajustes.diagColaCon(pendientes)],
    [
      T.ajustes.diagVisita,
      visita
        ? `${T.ajustes.diagLlegada(horaMs(visita.desde))} · ${T.ajustes.diagVisto(
            horaMs(visita.ultimoAdentro)
          )}${visita.arranco ? ' · ' + T.ajustes.diagYaArranco : ''}`
        : T.ajustes.diagSinVisita,
    ],
    [T.ajustes.diagZona, zona === null ? '—' : zona ? T.ajustes.diagZonaSi : T.ajustes.diagZonaNo],
    // SE LEE AL DIBUJAR, no en `cargar()`: no es algo que haya que ir a
    // buscar, es una variable que ya está en memoria, y el panel entero se
    // vuelve a dibujar cada vez que se abre.
    [T.ajustes.diagMotor, DICE_EL_MOTOR[comoAnduvoElMotor()]],
  ];

  return (
    <View style={estilos.seccion}>
      <Pressable
        style={estilos.plegable}
        onPress={() => setAbierto(!abierto)}
        accessibilityState={{ expanded: abierto }}
      >
        <Text style={estilos.titulo}>{T.ajustes.diagnostico}</Text>
        <Text style={estilos.signo}>{abierto ? '−' : '+'}</Text>
      </Pressable>

      {abierto && (
        <>
          {/* CÓMO LEYÓ LOS PASOS. El gráfico de Stats salió vacío en un
              teléfono con Health conectado y datos adentro, y desde una
              computadora no hay forma de ver qué contestó HealthKit. Esto lo
              dice: "cubos: 340" es que anduvo, "uno por uno: 28" es que la
              consulta agrupada no sirve en ese aparato y entró el camino
              largo, y "nada" es que Health no devolvió un solo día. */}
          {(() => {
            const l = comoLeyoLosPasos();
            return (
              <View style={estilos.fila}>
                <Text style={estilos.que}>{T.ajustes.diagPasos}</Text>
                <Text style={estilos.dice}>
                  {l === null ? T.ajustes.diagPasosNada : `${l.como}: ${l.dias}`}
                </Text>
              </View>
            );
          })()}
          {filas.map(([que, dice]) => (
            <View key={que} style={estilos.fila}>
              <Text style={estilos.que}>{que}</Text>
              <Text style={estilos.dice}>{dice}</Text>
            </View>
          ))}

          {pendientes > 0 && (
            <Pressable
              style={estilos.boton}
              onPress={async () => {
                await vaciar(supabase);
                cargar();
              }}
            >
              <Text style={estilos.botonTexto}>{T.ajustes.diagVaciarCola}</Text>
            </Pressable>
          )}

          <Pressable style={estilos.boton} onPress={mirarAhora} disabled={mirando}>
            <Text style={estilos.botonTexto}>
              {mirando ? T.ajustes.gimnasioBuscando : T.ajustes.diagMirarAhora}
            </Text>
          </Pressable>
          <Text style={estilos.nota}>{T.ajustes.diagMirarNota}</Text>

          {/* VER LA SUBIDA DE RANGO SIN ESPERAR AL DÍA 11. Es lo único de la
              app que solo se puede mirar una vez cada diez días, y ese ritmo
              no sirve para ajustar una animación: mirarla, cambiar algo y
              volver a mirarla tomaría un mes. Muestra el rango en el que
              estás como si acabaras de llegar. */}
          <Pressable style={estilos.boton} onPress={() => setVerSubida(true)}>
            <Text style={estilos.botonTexto}>{T.ajustes.diagVerSubida}</Text>
          </Pressable>

          <Pressable style={estilos.boton} onPress={revisarZona}>
            <Text style={estilos.botonTexto}>{T.ajustes.diagRevisarZona}</Text>
          </Pressable>
          <Text style={estilos.nota}>{T.ajustes.diagZonaNota}</Text>

          {/* CUÁNTOS CUADROS POR SEGUNDO, EN ESTE TELÉFONO. Ver
              `medirCuadros.ts`: es un bucle de `requestAnimationFrame`, o sea
              que mide el hilo de JavaScript, que es donde vive el
              deslizamiento entre pestañas.

              MIDE MIENTRAS USÁS LA APP, no mientras mirás esta pantalla: se
              aprieta, se sale de Ajustes y se hace el gesto que se quiere
              revisar. El resultado va a la bitácora de acá abajo, que es lo
              que ya se puede compartir. */}
          <Pressable
            style={estilos.boton}
            onPress={async () => {
              setMidiendoCuadros(true);
              setCuadros(null);
              const m = await medirCuadros();
              setMidiendoCuadros(false);
              setCuadros(m);
              cargar();
            }}
            disabled={midiendoCuadros}
          >
            <Text style={estilos.botonTexto}>
              {midiendoCuadros ? T.ajustes.diagCuadrosMidiendo : T.ajustes.diagCuadros}
            </Text>
          </Pressable>
          <Text style={estilos.nota}>{T.ajustes.diagCuadrosNota}</Text>
          {cuadros && (
            <Text style={estilos.nota}>
              {T.ajustes.diagCuadrosListo(cuadros.fps, cuadros.peor, cuadros.largos)}
            </Text>
          )}

          {/* EN UN CAMPO DE TEXTO Y NO EN UNA LISTA: así se puede desplazar y
              leer entero. Lo que de verdad hace falta en un teléfono es el
              botón de copiar, abajo. */}
          <ScrollView style={estilos.cuadro} nestedScrollEnabled>
            <TextInput
              style={estilos.bitacora}
              value={lineas || T.ajustes.diagVacia}
              editable={false}
              selectTextOnFocus
              multiline
            />
          </ScrollView>

          <View style={estilos.acciones}>
            <Pressable onPress={cargar} hitSlop={8}>
              <Text style={estilos.enlace}>{T.ajustes.diagRefrescar}</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                // Sin bitácora no se abre nada: la hoja de compartir vacía es
                // peor que un botón que no responde.
                if (lineas) void Share.share({ message: lineas }).catch(() => {});
              }}
              hitSlop={8}
            >
              <Text style={estilos.enlace}>{T.ajustes.diagCompartir}</Text>
            </Pressable>
            <Pressable
              onPress={async () => {
                await borrarBitacora();
                cargar();
              }}
              hitSlop={8}
            >
              <Text style={estilos.enlace}>{T.ajustes.diagBorrar}</Text>
            </Pressable>
          </View>
        </>
      )}

      {verSubida && (
        <SubidaRango
          rangoAntes={Math.max(1, (perfil.rango_actual ?? 1) - 1)}
          rangoDespues={perfil.rango_actual ?? 1}
          racha={perfil.racha_actual}
          alCerrar={() => setVerSubida(false)}
        />
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  seccion: { marginTop: 34 },
  plegable: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  titulo: { color: C.sub, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase' },
  signo: { color: C.sub, fontSize: 18 },
  fila: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 5 },
  que: { color: C.apagado, fontSize: 12 },
  dice: { color: C.sub, fontSize: 12, flexShrink: 1, textAlign: 'right' },
  boton: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.lineaFuerte,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  botonTexto: { color: C.tinta, fontSize: 14 },
  nota: { color: C.apagado, fontSize: 11, lineHeight: 16, marginTop: 6 },
  cuadro: {
    maxHeight: 220,
    marginTop: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.linea,
    borderRadius: 10,
    backgroundColor: C.hoja,
  },
  // Monoespaciada: son pares de dato y valor, y alineados se leen de un
  // vistazo en vez de tener que seguir cada línea.
  bitacora: { color: C.sub, fontSize: 11, lineHeight: 16, padding: 10, fontFamily: 'Courier' },
  acciones: { flexDirection: 'row', gap: 18, marginTop: 12 },
  enlace: { color: C.sub, fontSize: 13 },
});
