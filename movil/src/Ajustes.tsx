import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { supabase } from './supabase';
import { DIAS_SEMANA } from '@nucleo/fechas';
import { cuerpoDe } from '@nucleo/rangos';
import { umbralesDisponibles, umbralValido, type Umbral } from '@nucleo/estancamiento';
import { useVersionDelEsquema } from '@compartido/esquema';
import type { Perfil, UnidadPeso } from '@nucleo/tipos';
import { T } from '@nucleo/textos';
import { plataforma } from '@plataforma';
import { guardarSonido, leerSonido, puedeVibrar } from '@compartido/descanso';
import { escritorEnFila } from '@compartido/enFila';
import Avatar from './Avatar';
import FondoEspacial from './FondoEspacial';
import Gimnasio from './ajustes/Gimnasio';
import Salud from './ajustes/Salud';
import Identidad from './ajustes/Identidad';
import Fondo from './ajustes/Fondo';
import ComoSeCompara from './ajustes/ComoSeCompara';
import MisDatos from './ajustes/MisDatos';
import Sugerencias from './ajustes/Sugerencias';
import Cuenta from './ajustes/Cuenta';
import Bloqueados from './ajustes/Bloqueados';
import Diagnostico from './ajustes/Diagnostico';
import Interruptor from './Interruptor';

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

/**
 * EL PANEL DE DIAGNÓSTICO SOLO EN LAS BUILDS INTERNAS (26/9).
 *
 * Es el mismo flag con el que `Raiz` ya esconde el botón flotante de la caja
 * negra (`EXPO_PUBLIC_DIAGNOSTICO`), y va puesto en los perfiles `telefono`,
 * `dev` y `minimo` de `eas.json` — pero NO en `store`. El panel de abajo de
 * Ajustes (la caja negra, el vigilante del gimnasio, medir cuadros, compartir
 * el log crudo) no leía el flag y se colaba en la build de tienda, visible
 * para cualquiera. Es un banco de trabajo, no una pantalla de la app: en
 * producción no va.
 */
const CON_DIAGNOSTICO = process.env.EXPO_PUBLIC_DIAGNOSTICO === '1';

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
  // LO QUE NO SE USA TODOS LOS DÍAS, plegado (item estructura). Lo frecuente
  // —gimnasio, salud, descanso, peso, avisos, quién sos— queda arriba y a la
  // vista; el resto entra acá adentro para que Ajustes no sea una lista larga y
  // plana donde "cuentas bloqueadas" aparecía de la nada.
  const [avanzado, setAvanzado] = useState(false);
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

  // LOS DÍAS DE DESCANSO VAN EN FILA: ver `escritorEnFila`. `alCambiar` llega
  // nuevo en cada dibujo, y la fila vive más que un dibujo: se llama al último.
  const pintarDias = useRef(alCambiar);
  useEffect(() => {
    pintarDias.current = alCambiar;
  });
  const [descansos] = useState(() =>
    escritorEnFila<number[]>({
      guardado: perfil.dias_descanso,
      escribir: async (dias) => !(await supabase.rpc('fijar_descansos', { p_dias: dias })).error,
      iguales: (a, b) => a.length === b.length && a.every((d) => b.includes(d)),
      pintar: (dias) => pintarDias.current({ dias_descanso: dias }),
      alFallar: () => setFallo(T.general.falloDescansos),
    })
  );
  useEffect(() => {
    descansos.alDia(perfil.dias_descanso);
  }, [descansos, perfil.dias_descanso]);

  function alternarDia(dia: number) {
    const ahora = descansos.deseado();
    const nuevos = ahora.includes(dia) ? ahora.filter((d) => d !== dia) : [...ahora, dia];
    setFallo('');
    alCambiar({ dias_descanso: nuevos });
    descansos.pedir(nuevos);
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
      <FondoEspacial {...cuerpoDe(perfil.racha_actual)} velo={0.72} />
    {/* `automaticallyAdjustKeyboardInsets`: sin esto el teclado tapaba el campo
        de abajo —el de escribir el nombre para darse de baja— y se escribía a
        ciegas (28/9). iOS ahora insetea el scroll y lleva el campo enfocado a la
        vista. Cubre también el nombre de usuario y la meta de pasos, que viven
        en esta misma pantalla. */}
    <ScrollView style={estilos.scroll} contentContainerStyle={estilos.pantalla} automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled">

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

      {/* ACTIVIDAD EN VIVO: opt-in, apagado por defecto (27/9). Cuando el
          vigilante te detecta en el gimnasio, tus amigos ven "estás entrenando
          ahora" en Ranking —nunca dónde—; caduca sola a las 2 h. Solo tiene
          sentido con un punto marcado, así que aparece cuando lo hay. Se apaga
          acá y deja de aparecer al toque. */}
      {perfil.gimnasio_lat != null && (
        <View style={estilos.filaOpcion}>
          <View style={estilos.textoOpcion}>
            <Text style={estilos.opcion}>{T.ajustes.comparteGimnasio}</Text>
            <Text style={estilos.nota}>{T.ajustes.comparteGimnasioNota}</Text>
          </View>
          <Interruptor
            value={perfil.comparte_gimnasio === true}
            accessibilityLabel={T.ajustes.comparteGimnasio}
            onValueChange={async (v) => {
              alCambiar({ comparte_gimnasio: v } as Partial<Perfil>);
              const { error } = await supabase.rpc('fijar_comparte_gimnasio', { p_valor: v });
              if (error) alCambiar({ comparte_gimnasio: !v } as Partial<Perfil>);
            }}
          />
        </View>
      )}

      {/* Y LA SALUD DEL TELÉFONO JUSTO DEBAJO: son las dos formas de que un
          día entre sin que aprietes nada, y leerlas juntas se entiende. La
          web no tiene esta sección porque el navegador no ve nada de esto. */}
      <Salud />
      {/* LA META DE PASOS YA NO VA ACÁ (27/9). Vive en Stats, al lado del
          gráfico de pasos (`GraficoPasos` → `PieDeMeta`/`HojaDeMeta`), que es
          donde se ve para qué sirve. Acá era un campo de texto suelto que
          parecía un enlace azul, y encima a veces abría el editor al entrar. */}

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

      <Identidad perfil={perfil} alCambiar={alCambiar} />

      {/* AJUSTES AVANZADOS: todo lo que no se toca seguido, detrás de un solo
          pliegue. Adentro va cada cosa con su propio contexto —incluida cuentas
          bloqueadas— así ninguna aparece suelta en medio de la lista. */}
      <Pressable
        style={estilos.avanzadoCabe}
        onPress={() => setAvanzado(!avanzado)}
        accessibilityRole="button"
        accessibilityState={{ expanded: avanzado }}
      >
        <Text style={estilos.avanzadoTitulo}>{T.ajustes.avanzados}</Text>
        <Text style={estilos.avanzadoSigno}>{avanzado ? '−' : '+'}</Text>
      </Pressable>

      {avanzado && (
        <>
          {/* El fondo es una preferencia de ESTE aparato, no un dato de la cuenta. */}
          <Fondo />

          <Sugerencias userId={perfil.id} />

          <MisDatos perfil={perfil} />

          {/* Dos pantallas de texto: el que las busca las encuentra igual. */}
          <ComoSeCompara />

          {/* Cuentas bloqueadas: privacidad, con su contexto y su cuenta. */}
          <Bloqueados />

          {/* Cerrar sesion, cambiar la clave y darse de baja: sobre la cuenta,
              no sobre como entrenas. Van juntas y al final. */}
          <Cuenta perfil={perfil} alSalir={alSalir} />

          {/* El banco de trabajo del gimnasio. Solo en builds internas. */}
          {CON_DIAGNOSTICO && <Diagnostico perfil={perfil} />}
        </>
      )}
    </ScrollView>
    </>
  );
}

const estilos = StyleSheet.create({
  tuPerfil: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, marginBottom: 4 },
  tuNombre: { color: '#e8ecf6', fontSize: 17 },
  tuPie: { color: '#8a93a8', fontSize: 12, marginTop: 2 },
  // EL FONDO VA EN EL SCROLLVIEW, NO SOLO EN EL CONTENIDO (29/9). El
  // `contentContainerStyle` pinta el ALTO DEL CONTENIDO; con Ajustes corto (todo
  // plegado en avanzados) el rebote de iOS tiraba de más y dejaba ver el motor
  // detrás —el rectángulo negro se terminaba y aparecía el sol—. El fondo en el
  // ScrollView mismo llega hasta el borde con el contenido corto, largo, y con
  // el rebote. `pantalla` mantiene su fondo por si el contenido no llena.
  scroll: { flex: 1, backgroundColor: '#05060a' },
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
  // El pliegue de "Ajustes avanzados": una línea con su signo, separada arriba
  // por una hairline para que se lea como el corte entre lo de siempre y el resto.
  avanzadoCabe: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    marginTop: 30,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#1d2230',
    paddingTop: 18,
  },
  avanzadoTitulo: { color: '#8a93a8', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase' },
  avanzadoSigno: { color: '#8a93a8', fontSize: 18 },
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
  filaOpcion: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 18 },
  textoOpcion: { flex: 1 },
  opcion: { color: '#e8ecf6', fontSize: 15 },
  error: { color: '#e8705f', fontSize: 13, marginTop: 18, lineHeight: 19 },
  enlace: { color: '#8a93a8', fontSize: 13 },
  salir: { marginTop: 48, alignItems: 'center' },
});
