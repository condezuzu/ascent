import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { supabase } from './supabase';
import { DIAS_SEMANA, deISO, hoyISO, restarDias } from '@nucleo/fechas';
import { esDiaDeDescanso, type ConfigDescanso } from '@nucleo/descansos';
import { estaBloqueado, textoDeBloqueo } from '@nucleo/pendiente';
import { rangoDeRacha } from '@nucleo/rangos';
import { mensajeDeAuth } from '@nucleo/errores';
import type { Log, Perfil } from '@nucleo/tipos';
import { T } from '@nucleo/textos';

/**
 * INICIO — TANDA 2. La racha, la semana y el botón que registra el día.
 *
 * ES EL BUCLE ENTERO DE LA APP: abrir, ver el número, tocar una vez. Todo lo
 * demás —el motor visual, el cronómetro, las marcas— vive alrededor de esto.
 *
 * DE NUEVO, LO QUE NO HAY ACÁ ES LO QUE IMPORTA: ni una regla de racha, ni un
 * cálculo de qué día es descanso, ni un texto, ni el mensaje del bloqueo de
 * las 20 horas. Todo sale de `nucleo/`, los mismos archivos que usa la web. Lo
 * único propio es cómo se dibuja.
 *
 * LO QUE FALTA, Y ES DE OTRA TANDA:
 * - **El objeto de rango.** Es `src/motor/` con three.js y hay que portarlo a
 *   `expo-gl`; es una tanda entera y no un rato. Mientras tanto se nombra el
 *   rango en texto, que es lo que la app NUNCA hace en web (§7) — acá es
 *   andamio de migración, no diseño, y se va cuando entre el motor.
 * - **La foto y el peso** al registrar: son la hoja de registrar, que necesita
 *   cámara y otra pantalla.
 * - **El cronómetro de sesión**, que es lo que más depende de los puertos y va
 *   con la tanda 3.
 */

type Estado =
  | { tipo: 'cargando' }
  | { tipo: 'error'; que: string }
  | {
      tipo: 'listo';
      perfil: Perfil;
      logs: Log[];
      descansos: ConfigDescanso[];
      cubiertos: string[];
      vidas: { quedan: number; total: number } | null;
    };

export default function Inicio({ alSalir }: { alSalir: () => void }) {
  const [estado, setEstado] = useState<Estado>({ tipo: 'cargando' });
  const [registrando, setRegistrando] = useState(false);
  const [aviso, setAviso] = useState('');

  const cargar = useCallback(async () => {
    try {
      const { data: sesion } = await supabase.auth.getSession();
      const uid = sesion.session?.user?.id;
      if (!uid) return alSalir();

      // La pérdida se verifica ANTES de leer el perfil: es la llamada que
      // aplica las vidas, y si se leyera el perfil primero se mostraría por un
      // instante una racha que la base está por corregir.
      await supabase.rpc('verificar_perdida');

      const desde = restarDias(hoyISO(), 6);
      const [{ data: perfil, error }, { data: logs }, { data: descansos }, { data: vidas }] =
        await Promise.all([
          supabase.from('profiles').select('*').eq('id', uid).single(),
          supabase.from('logs').select('*').eq('user_id', uid).gte('fecha', desde).order('fecha'),
          supabase.from('descansos').select('desde, dias').order('desde', { ascending: false }),
          supabase.rpc('mis_vidas'),
        ]);

      if (error) return setEstado({ tipo: 'error', que: mensajeDeAuth(error) });
      if (!perfil) return setEstado({ tipo: 'error', que: T.general.noSePudo });

      setEstado({
        tipo: 'listo',
        perfil: perfil as Perfil,
        logs: (logs ?? []) as Log[],
        descansos: (descansos ?? []) as ConfigDescanso[],
        cubiertos: Array.isArray(vidas?.del_mes) ? (vidas.del_mes as string[]) : [],
        vidas: vidas ? { quedan: Number(vidas.quedan), total: Number(vidas.total) } : null,
      });
    } catch (e) {
      setEstado({ tipo: 'error', que: String((e as Error)?.message ?? e) });
    }
  }, [alSalir]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function registrar() {
    setRegistrando(true);
    setAviso('');
    const { data, error } = await supabase.rpc('registrar_dia', { p_origen: 'manual' });
    setRegistrando(false);
    if (error) {
      // 23505 = el día ya estaba. No es un error: es el caso de tocar dos
      // veces, y no tiene que ensuciar nada.
      if (error.code === '23505') return cargar();
      return setAviso(T.general.noSePudo);
    }
    // La guarda de las 20 horas por cambio de zona no es un error: el día
    // quedó anotado y entra solo. Se dice con todas las letras, porque un
    // rechazo mudo con la racha en juego se lee como que la app está rota.
    if (estaBloqueado(data)) return setAviso(textoDeBloqueo(data.hasta));
    await cargar();
  }

  if (estado.tipo === 'cargando') {
    return (
      <View style={estilos.centrado}>
        <ActivityIndicator color="#8a93a8" />
      </View>
    );
  }

  if (estado.tipo === 'error') {
    return (
      <View style={estilos.centrado}>
        <Text style={estilos.error}>{estado.que}</Text>
        <Pressable onPress={cargar}>
          <Text style={estilos.enlace}>{T.inicio.reintentar}</Text>
        </Pressable>
      </View>
    );
  }

  const { perfil, logs, descansos, cubiertos, vidas } = estado;

  // CUENTA RECIÉN CREADA, SIN NOMBRE. En web eso rebota a /onboarding; acá esa
  // pantalla todavía no existe, y lo que NO se puede hacer es dibujar Inicio
  // con un nombre vacío como si estuviera todo bien. Se dice qué falta y dónde
  // se arregla, que es más honesto que una pantalla a medias.
  if (!perfil.username) {
    return (
      <View style={estilos.centrado}>
        <Text style={estilos.error}>{T.entrar.elegiNombre}</Text>
        <Text style={estilos.enlace}>{T.entrar.elegiNombreSub}</Text>
      </View>
    );
  }

  const hoy = hoyISO();
  const registradoHoy = logs.some((l) => l.fecha === hoy && !l.es_descanso);

  // La semana arranca el LUNES y se alinea al calendario, igual que en web:
  // "los últimos siete días" es más exacto y se ve mal, porque las letras
  // salen corridas y eso se lee como un error.
  const diaDeSemana = (deISO(hoy).getDay() + 6) % 7;
  const lunes = restarDias(hoy, diaDeSemana);
  const semana = Array.from({ length: 7 }, (_, i) => {
    const fecha = restarDias(lunes, -i);
    const log = logs.find((l) => l.fecha === fecha);
    let estadoDia: 'lleno' | 'vacio' | 'descanso' | 'futuro' | 'cubierto' = 'vacio';
    if (fecha > hoy) estadoDia = 'futuro';
    else if (log && !log.es_descanso) estadoDia = 'lleno';
    else if ((log && log.es_descanso) || esDiaDeDescanso(descansos, fecha)) estadoDia = 'descanso';
    else if (cubiertos.includes(fecha)) estadoDia = 'cubierto';
    return { fecha, estadoDia, esHoy: fecha === hoy };
  });

  return (
    <ScrollView contentContainerStyle={estilos.pantalla}>
      <Text style={estilos.usuario}>{perfil.username}</Text>

      <Text style={estilos.etiqueta}>{T.inicio.racha}</Text>
      <Text style={estilos.racha}>{perfil.racha_actual}</Text>
      {/* Andamio de migración: en web el rango NO se nombra nunca (§7), lo
          dice el objeto. Hasta que el motor esté portado, esto es lo único que
          puede decir en qué te convertiste. */}
      <Text style={estilos.rango}>{rangoDeRacha(perfil.racha_actual).nombre}</Text>

      <View style={estilos.tira}>
        {semana.map((d) => (
          <View key={d.fecha} style={estilos.tiraDia}>
            <View
              style={[
                estilos.punto,
                d.estadoDia === 'lleno' && estilos.lleno,
                d.estadoDia === 'vacio' && estilos.vacio,
                d.estadoDia === 'futuro' && estilos.futuro,
                (d.estadoDia === 'descanso' || d.estadoDia === 'cubierto') && estilos.vacio,
                d.esHoy && estilos.puntoHoy,
              ]}
            >
              {/* El descanso es un guioncito y el cubierto un punto adentro:
                  ninguno de los dos puede parecer un día perdido, y el
                  cubierto tampoco puede parecer entrenado. */}
              {d.estadoDia === 'descanso' && <View style={estilos.guion} />}
              {d.estadoDia === 'cubierto' && <View style={estilos.cubierto} />}
            </View>
            <Text style={estilos.letra}>{DIAS_SEMANA[deISO(d.fecha).getDay()]}</Text>
          </View>
        ))}
      </View>

      {vidas && (
        <View style={estilos.vidas}>
          <Text style={estilos.vidasEt}>{T.vidas.titulo}</Text>
          {Array.from({ length: vidas.total }, (_, i) => (
            <View key={i} style={[estilos.vida, i < vidas.quedan && estilos.vidaViva]} />
          ))}
        </View>
      )}

      {aviso !== '' && <Text style={estilos.aviso}>{aviso}</Text>}

      {registradoHoy ? (
        <Text style={estilos.hecho}>{T.inicio.diaRegistrado}</Text>
      ) : (
        <Pressable
          style={[estilos.solido, registrando && estilos.apagado]}
          onPress={registrar}
          disabled={registrando}
        >
          {registrando ? (
            <ActivityIndicator color="#05060a" />
          ) : (
            <Text style={estilos.textoSolido}>{T.inicio.registrarDia}</Text>
          )}
        </Pressable>
      )}

      <Pressable
        style={estilos.salir}
        onPress={async () => {
          await supabase.auth.signOut();
          alSalir();
        }}
      >
        <Text style={estilos.enlace}>{T.ajustes.cerrarSesion}</Text>
      </Pressable>
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flexGrow: 1, backgroundColor: '#05060a', padding: 24, paddingTop: 64 },
  centrado: { flex: 1, backgroundColor: '#05060a', alignItems: 'center', justifyContent: 'center', gap: 16 },
  usuario: { color: '#e8ecf6', fontSize: 16, fontWeight: '600', marginBottom: 30 },
  etiqueta: { color: '#8a93a8', fontSize: 10, letterSpacing: 4, textTransform: 'uppercase' },
  racha: { color: '#c4c2ba', fontSize: 92, fontWeight: '300', lineHeight: 100 },
  rango: { color: '#8a93a8', fontSize: 12, letterSpacing: 3, textTransform: 'uppercase' },

  tira: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 34 },
  tiraDia: { alignItems: 'center', gap: 7 },
  punto: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  lleno: { backgroundColor: '#7e8ca8' },
  vacio: { borderWidth: 1, borderColor: '#2a3040' },
  futuro: { borderWidth: 1, borderColor: '#171c26' },
  puntoHoy: { borderWidth: 1, borderColor: '#c4c2ba' },
  guion: { width: 10, height: 2, borderRadius: 1, backgroundColor: '#4a5163' },
  cubierto: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#6b7488' },
  letra: { color: '#4a5163', fontSize: 11 },

  vidas: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 26 },
  vidasEt: {
    color: '#4a5163',
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginRight: 4,
  },
  vida: { width: 7, height: 7, borderRadius: 4, borderWidth: 1, borderColor: '#3a4152' },
  vidaViva: { backgroundColor: '#c4c2ba', borderColor: '#c4c2ba' },

  solido: {
    backgroundColor: '#c4c2ba',
    borderRadius: 2,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 34,
  },
  apagado: { opacity: 0.6 },
  textoSolido: { color: '#05060a', fontSize: 15, fontWeight: '600' },
  hecho: { color: '#8a93a8', fontSize: 14, marginTop: 34, textAlign: 'center' },
  aviso: { color: '#8a93a8', fontSize: 13, marginTop: 20, textAlign: 'center', lineHeight: 19 },
  error: { color: '#e8705f', fontSize: 13, textAlign: 'center' },
  enlace: { color: '#8a93a8', fontSize: 13 },
  salir: { marginTop: 40, alignItems: 'center' },
});
