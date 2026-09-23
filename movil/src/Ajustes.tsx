import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { supabase } from './supabase';
import { DIAS_SEMANA } from '@nucleo/fechas';
import { planetaDeDia } from '@nucleo/rangos';
import { umbralesDisponibles, umbralValido, type Umbral } from '@nucleo/estancamiento';
import { useVersionDelEsquema } from '@compartido/esquema';
import type { Perfil, UnidadPeso } from '@nucleo/tipos';
import { T } from '@nucleo/textos';
import { plataforma } from '@plataforma';
import { guardarSonido, leerSonido, puedeVibrar } from '@compartido/descanso';
import Avatar from './Avatar';
import FondoEspacial from './FondoEspacial';
import Gimnasio from './ajustes/Gimnasio';
import Salud from './ajustes/Salud';
import MetaDePasos from './ajustes/MetaDePasos';
import Identidad from './ajustes/Identidad';
import Fondo from './ajustes/Fondo';
import ComoSeCompara from './ajustes/ComoSeCompara';
import MisDatos from './ajustes/MisDatos';
import Sugerencias from './ajustes/Sugerencias';
import Cuenta from './ajustes/Cuenta';
import Diagnostico from './ajustes/Diagnostico';

/**
 * AJUSTES — lo que se puede cambiar, en la app nativa.
 *
 * SON TODAS PREFERENCIAS DEL DUEÑO y por eso comparten forma: se pinta el
 * cambio YA y se guarda de fondo. Esperar el viaje de red deja el botón medio
 * segundo sin responder, que se siente roto para algo que es un interruptor.
 * Si la base lo rechaza, vuelve solo y se dice — volver atrás en silencio es
 * peor que no volver, porque el interruptor se mueve solo y parece que la app
 * hace lo que quiere.
 *
 * LOS DÍAS DE DESCANSO no se escriben directo: van por `fijar_descansos`, que
 * los guarda CON FECHA. El cambio rige desde hoy hacia adelante y el pasado
 * queda con la configuración que estaba vigente entonces — cambiar de rutina
 * nunca puede hacer perder una racha ya ganada.
 *
 * LO QUE FALTA, Y ESTÁ EN LA TANDA 3: el punto del gimnasio. Necesita el GPS y
 * el diálogo de permisos, o sea el teléfono de verdad, y va junto con el resto
 * de lo que depende de los puertos. El sexo para el DOTS y el descanso entre
 * series llegan con sus pantallas.
 */
export default function Ajustes({
  perfil,
  alCambiar,
  alSalir,
}: {
  perfil: Perfil;
  alCambiar: (parcial: Partial<Perfil>) => void;
  alSalir: () => void;
}) {
  const router = useRouter();
  const [fallo, setFallo] = useState('');
  // El sonido del descanso es de ESTE teléfono, igual que en la web: se guarda
  // en el aparato y no en la cuenta.
  const [sonido, setSonido] = useState(false);
  useEffect(() => {
    leerSonido().then(setSonido);
  }, []);

  /** Pinta el cambio, guarda, y vuelve atrás si la base dice que no. */
  async function guardar(parcial: Partial<Perfil>, aviso: string) {
    const antes: Partial<Perfil> = {};
    for (const k of Object.keys(parcial) as (keyof Perfil)[]) {
      (antes as Record<string, unknown>)[k] = perfil[k];
    }
    setFallo('');
    alCambiar(parcial);
    const { error } = await supabase.from('profiles').update(parcial).eq('id', perfil.id);
    if (error) {
      alCambiar(antes);
      setFallo(aviso);
    }
  }

  async function alternarDia(dia: number) {
    const nuevos = perfil.dias_descanso.includes(dia)
      ? perfil.dias_descanso.filter((d) => d !== dia)
      : [...perfil.dias_descanso, dia];
    const antes = perfil.dias_descanso;
    setFallo('');
    alCambiar({ dias_descanso: nuevos });
    const { error } = await supabase.rpc('fijar_descansos', { p_dias: nuevos });
    if (error) {
      alCambiar({ dias_descanso: antes });
      setFallo(T.general.falloDescansos);
    }
  }

  const umbral = umbralValido(perfil.umbral_estancamiento);
  // El 2 aparece cuando la base lo acepta (migración 40).
  const version = useVersionDelEsquema();
  const avisos = perfil.avisos_estancamiento !== false;

  return (
    <>
      {/* AJUSTES NO PEDÍA FONDO, así que se quedaba con el de la pantalla
          anterior — o sea, con el planeta de Inicio. Ahora pide el suyo:
          solo el cielo, como las otras tres que no son Inicio. */}
      <FondoEspacial rango={perfil.rango_actual} planeta={planetaDeDia(perfil.racha_actual)} velo={0.72} />
    <ScrollView contentContainerStyle={estilos.pantalla}>

      <Text style={estilos.titulo}>{T.ajustes.titulo}</Text>

      {/* TU PERFIL, arriba de todo y como en la web: Ajustes es donde se lo
          busca cuando no se lo encontró en Inicio. */}
      <Pressable style={estilos.tuPerfil} onPress={() => router.push('/yo')} accessibilityRole="button">
        <Avatar url={perfil.avatar_url} nombre={perfil.username} tam={40} />
        <View style={{ flex: 1 }}>
          <Text style={estilos.tuNombre}>{perfil.username}</Text>
          <Text style={estilos.tuPie}>{T.ajustes.tuPerfil}</Text>
        </View>
      </Pressable>

      {/* EL GIMNASIO VA PRIMERO, igual que en la web: es lo que diferencia a
          la app, y en una lista de interruptores al fondo no lo marca nadie. */}
      <Gimnasio perfil={perfil} alCambiar={alCambiar} />

      {/* Y LA SALUD DEL TELÉFONO JUSTO DEBAJO: son las dos formas de que un
          día entre sin que aprietes nada, y leerlas juntas se entiende. La
          web no tiene esta sección porque el navegador no ve nada de esto. */}
      <Salud />
      {/* La meta va PEGADA a Salud: sin Health no hay pasos, y una meta
          para un gráfico que no existe es un campo que no sirve. */}
      <MetaDePasos />

      <Text style={estilos.seccion}>{T.ajustes.diasDescanso}</Text>
      <View style={estilos.fila}>
        {DIAS_SEMANA.map((d, i) => (
          <Pressable
            key={i}
            onPress={() => alternarDia(i)}
            style={[estilos.pastilla, perfil.dias_descanso.includes(i) && estilos.prendida]}
          >
            <Text
              style={[
                estilos.textoPastilla,
                perfil.dias_descanso.includes(i) && estilos.textoPrendido,
              ]}
            >
              {d}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={estilos.nota}>{T.ajustes.diasDescansoNota}</Text>

      <Text style={estilos.seccion}>{T.ajustes.peso}</Text>
      <View style={estilos.fila}>
        {(['kg', 'lb'] as UnidadPeso[]).map((u) => (
          <Pressable
            key={u}
            onPress={() => guardar({ unidad_peso: u }, T.general.falloPreferencia)}
            style={[estilos.ancha, (perfil.unidad_peso ?? 'kg') === u && estilos.prendida]}
          >
            <Text
              style={[
                estilos.textoPastilla,
                (perfil.unidad_peso ?? 'kg') === u && estilos.textoPrendido,
              ]}
            >
              {u === 'kg' ? T.ajustes.kilos : T.ajustes.libras}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* LOS CINCO PRESETS DE DURACIÓN SE FUERON (23/9, "Ajustes tiene
          demasiados botones"). No se perdió nada: la duración ya se elige
          DENTRO de la pantalla del descanso, que es donde se decide de
          verdad —mirando el número correr, no dos días antes—, y lo que se
          elige ahí vale para lo que queda de la sesión (§18.5).

          EL SONIDO SE QUEDA, y es una línea, no cinco botones: es de ESTE
          teléfono, no de la cuenta, y no tiene otra casa — entró en N4
          justamente porque arrancaba apagado y no había dónde prenderlo. */}
      <Text style={estilos.seccion}>{T.ajustes.avisoDelDescanso}</Text>
      <Pressable
        onPress={() => {
          const nuevo = !sonido;
          setSonido(nuevo);
          void guardarSonido(nuevo);
        }}
        style={{ paddingVertical: 10 }}
        accessibilityRole="switch"
        accessibilityState={{ checked: sonido }}
      >
        <Text style={estilos.enlace}>{sonido ? T.ajustes.sonidoPrendido : T.ajustes.sonidoApagado}</Text>
      </Pressable>
      {/* TRES TEXTOS Y NO DOS: en el teléfono el aviso es una notificación del
          sistema y llega con la pantalla bloqueada, así que decir "con la app
          abierta" sería mentir. Lo decide el puerto. */}
      <Text style={estilos.nota}>
        {plataforma.avisos.conPantallaBloqueada()
          ? T.ajustes.vibraBloqueada
          : puedeVibrar()
            ? T.ajustes.vibra
            : T.ajustes.noVibra}
      </Text>
      {sonido && (
        <Text style={estilos.nota}>
          {plataforma.audio.respetaLaMusica() ? T.ajustes.sonidoRespeta : T.ajustes.sonidoCorta}
        </Text>
      )}

      <Text style={estilos.seccion}>{T.ajustes.estancamiento}</Text>
      <View style={estilos.fila}>
        {[true, false].map((v) => (
          <Pressable
            key={String(v)}
            onPress={() => guardar({ avisos_estancamiento: v }, T.general.falloPreferencia)}
            style={[estilos.ancha, avisos === v && estilos.prendida]}
          >
            <Text style={[estilos.textoPastilla, avisos === v && estilos.textoPrendido]}>
              {v ? T.ajustes.estancamientoSi : T.ajustes.estancamientoNo}
            </Text>
          </Pressable>
        ))}
      </View>
      {avisos && (
        <>
          <View style={[estilos.fila, { marginTop: 10 }]}>
            {umbralesDisponibles(version).map((u: Umbral) => (
              <Pressable
                key={u}
                onPress={() => guardar({ umbral_estancamiento: u }, T.general.falloPreferencia)}
                style={[estilos.ancha, estilos.umbral, u === umbral && estilos.prendida]}
              >
                <Text style={[estilos.textoPastilla, u === umbral && estilos.textoPrendido]}>
                  {T.ajustes.semanas(u)}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={estilos.nota}>{T.ajustes.estancamientoNota(umbral)}</Text>
        </>
      )}

      {fallo !== '' && <Text style={estilos.error}>{fallo}</Text>}

      {/* Antes del nombre, como en la web: el fondo es una preferencia de
          ESTE aparato y no un dato de la cuenta. */}
      <Fondo />

      <Identidad perfil={perfil} alCambiar={alCambiar} />

      <Sugerencias userId={perfil.id} />

      <MisDatos perfil={perfil} />

      {/* Abajo de todo y plegado: son dos pantallas de texto, y el que las
          busca las encuentra igual. */}
      <ComoSeCompara />

      {/* Cerrar sesion, cambiar la clave y darse de baja: las tres son sobre
          la cuenta y no sobre como entrenas, asi que van juntas y al final. */}
      <Cuenta perfil={perfil} alSalir={alSalir} />

      {/* ABAJO DE TODO Y PLEGADO: no es una pantalla de la app, es el banco de
          trabajo para leer que vio el vigilante en el gimnasio. Se saca
          cuando el automatico este probado. */}
      <Diagnostico perfil={perfil} />
    </ScrollView>
    </>
  );
}

const estilos = StyleSheet.create({
  tuPerfil: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, marginBottom: 4 },
  tuNombre: { color: '#e8ecf6', fontSize: 17 },
  tuPie: { color: '#8a93a8', fontSize: 12, marginTop: 2 },
  pantalla: { flexGrow: 1, backgroundColor: '#05060a', padding: 24, paddingTop: 60 },
  titulo: {
    color: '#8a93a8',
    fontSize: 11,
    letterSpacing: 4,
    textTransform: 'uppercase',
    marginBottom: 26,
  },
  seccion: {
    color: '#8a93a8',
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: 26,
    marginBottom: 10,
  },
  fila: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  pastilla: {
    width: 40,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#2a3040',
    alignItems: 'center',
  },
  ancha: {
    flex: 1,
    minWidth: 84,
    paddingVertical: 11,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#2a3040',
    alignItems: 'center',
  },
  // Cuatro en una fila: con el ancho mínimo de las otras, el cuarto bajaba solo.
  umbral: { minWidth: 0 },
  prendida: { borderColor: '#7e8ca8' },
  textoPastilla: { color: '#8a93a8', fontSize: 13 },
  textoPrendido: { color: '#c4c2ba' },
  nota: { color: '#4a5163', fontSize: 12, marginTop: 8, lineHeight: 18 },
  error: { color: '#e8705f', fontSize: 13, marginTop: 18, lineHeight: 19 },
  enlace: { color: '#8a93a8', fontSize: 13 },
  salir: { marginTop: 48, alignItems: 'center' },
});
