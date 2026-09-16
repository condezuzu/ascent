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
import { cronoLindo, duracionLinda, transcurrido } from '@nucleo/sesiones';
import { useSesion, type CierreDeSesion } from '@compartido/useSesion';
import Bloque from './Bloque';
import Descanso from './Descanso';
import RachaSalvada from './RachaSalvada';
import RegistrarDia from './RegistrarDia';
import { plataforma } from '@plataforma';
import { CLAVE_VIDA_VISTA, hastaDondeVisto, impulsosSinVer, rachaSiSeDevuelve } from '@nucleo/impulsos';
import SugerenciasDeMarca from './SugerenciasDeMarca';
import { cuentaAtras, restante } from '@compartido/descanso';

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
 *
 * LA SESIÓN (tanda 3, N1) NO ESTÁ ESCRITA ACÁ: es `useSesion`, el MISMO hook
 * que usa la web, desde `compartido/`. Iniciar, el cronómetro, terminar, el
 * cierre por inactividad y el aviso de "se cerró sola" son una sola lógica
 * para las dos apps. Esta pantalla solo la dibuja. El bloque —contar series,
 * el peso— es N2 y vive en `Bloque.tsx`; el descanso es N3 y vive en
 * `Descanso.tsx`, con el aviso del sistema programado en `compartido/descanso.ts`.
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
      impulsos: { quedan: number; total: number } | null;
    };

export default function Inicio({
  alSalir,
  alFaltarNombre,
}: {
  alSalir: () => void;
  /** Cuenta nueva sin nombre: la pantalla de elegirlo es de App. */
  alFaltarNombre: () => void;
}) {
  const [estado, setEstado] = useState<Estado>({ tipo: 'cargando' });
  // La hoja de registrar el día (con foto): la misma que la web.
  const [registrarAbierto, setRegistrarAbierto] = useState(false);
  // Terminar pregunta antes, en el mismo lugar: es el botón más fácil de tocar
  // sin querer, y lo que hace no se deshace.
  const [terminando, setTerminando] = useState(false);
  const [cierre, setCierre] = useState<CierreDeSesion | null>(null);
  // La pantalla del descanso se abre desde la píldora, igual que en la web: el
  // + arranca el descanso pero no tapa el bloque.
  const [descansoAbierto, setDescansoAbierto] = useState(false);
  // LA VENTANA DE LAS VIDAS: los días cubiertos que este aparato todavía no
  // anunció. Misma regla y misma marca que la web (`nucleo/impulsos.ts`).
  const [vidaUsada, setVidaUsada] = useState<{ dias: string[]; quedan: number; total: number } | null>(null);
  const [aviso, setAviso] = useState('');

  const cargar = useCallback(async () => {
    try {
      const { data: sesion } = await supabase.auth.getSession();
      const uid = sesion.session?.user?.id;
      if (!uid) return alSalir();

      // La pérdida se verifica ANTES de leer el perfil: es la llamada que
      // aplica los impulsos, y si se leyera el perfil primero se mostraría por un
      // instante una racha que la base está por corregir.
      await supabase.rpc('verificar_perdida');

      const desde = restarDias(hoyISO(), 6);
      const [{ data: perfil, error }, { data: logs }, { data: descansos }, { data: impulsos }] =
        await Promise.all([
          supabase.from('profiles').select('*').eq('id', uid).single(),
          supabase.from('logs').select('*').eq('user_id', uid).gte('fecha', desde).order('fecha'),
          supabase.from('descansos').select('desde, dias').order('desde', { ascending: false }),
          supabase.rpc('mis_impulsos'),
        ]);

      if (error) return setEstado({ tipo: 'error', que: mensajeDeAuth(error) });
      if (!perfil) return setEstado({ tipo: 'error', que: T.general.noSePudo });

      // CUENTA RECIÉN CREADA, SIN NOMBRE: no se dibuja Inicio a medias, se
      // manda a elegirlo. Es lo mismo que hace la web rebotando a /onboarding.
      //
      // Se avisa ACÁ y no al dibujar. Estaba en el render y React lo cantó:
      // "Cannot update a component while rendering a different component".
      // Cambiarle el estado al padre mientras el hijo se dibuja es pedirle a
      // React que rehaga un árbol que todavía no terminó; que hoy funcione no
      // lo hace correcto, y en modo concurrente deja de funcionar.
      if (!perfil.username) return alFaltarNombre();

      setEstado({
        tipo: 'listo',
        perfil: perfil as Perfil,
        logs: (logs ?? []) as Log[],
        descansos: (descansos ?? []) as ConfigDescanso[],
        cubiertos: Array.isArray(impulsos?.vigentes) ? (impulsos.vigentes as string[]) : [],
        impulsos: impulsos ? { quedan: Number(impulsos.quedan), total: Number(impulsos.total) } : null,
      });
      const ultimas = Array.isArray(impulsos?.ultimas) ? (impulsos.ultimas as string[]) : [];
      const sinVer = impulsosSinVer(ultimas, await plataforma.almacenamiento.leer(CLAVE_VIDA_VISTA));
      if (sinVer.length > 0) {
        setVidaUsada({ dias: sinVer, quedan: Number(impulsos?.quedan ?? 0), total: Number(impulsos?.total ?? 0) });
      }
    } catch (e) {
      setEstado({ tipo: 'error', que: String((e as Error)?.message ?? e) });
    }
  }, [alSalir, alFaltarNombre]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Iniciar una sesión registra el día: cuando la base avisa, se recarga la
  // racha y la semana. Va antes de cualquier `return`: es un hook.
  const sesion = useSesion(() => {
    cargar();
  });

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

  const { perfil, logs, descansos, cubiertos, impulsos } = estado;

  const hoy = hoyISO();
  // Igual que la web: un día marcado como descanso a mano TAMBIÉN está (bug del
  // 15/9). Contarlo como vacío ofrecía "Registrar día", la base lo rechazaba
  // por repetido y la hoja lo tomaba como hecho: la racha no subía y nadie
  // decía nada.
  const registradoHoy = logs.some((l) => l.fecha === hoy);

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
      <View style={estilos.cabecera}>
        <Text style={estilos.usuario}>{perfil.username}</Text>
        {/* El chip de la sesión, arriba a la derecha como en la web: sin
            sesión la inicia; con sesión, es el reloj. */}
        {sesion.estado.corriendo && sesion.estado.inicio ? (
          <View style={estilos.sesionViva}>
            <View style={estilos.chip}>
              <View style={estilos.latido} />
              <Text style={estilos.chipTexto}>
                {cronoLindo(transcurrido(sesion.estado.inicio, sesion.estado.desfasaje))}
              </Text>
            </View>
            {/* LA PÍLDORA DEL DESCANSO: sin descanso lo arranca; con uno
                andando muestra lo que falta y abre la pantalla grande. */}
            {sesion.estado.descanso ? (
              <Pressable
                style={[estilos.chip, restante(sesion.estado.descanso.fin) === 0 && estilos.chipListo]}
                onPress={() => setDescansoAbierto(true)}
                accessibilityRole="button"
              >
                <Text style={[estilos.chipTexto, restante(sesion.estado.descanso.fin) === 0 && estilos.chipTextoListo]}>
                  {restante(sesion.estado.descanso.fin) === 0 ? T.sesion.listo : cuentaAtras(restante(sesion.estado.descanso.fin))}
                </Text>
              </Pressable>
            ) : (
              <Pressable
                style={estilos.chip}
                onPress={() => {
                  void sesion.descansarSuelto();
                  setDescansoAbierto(true);
                }}
                accessibilityRole="button"
              >
                <Text style={estilos.chipTexto}>{T.sesion.descansar}</Text>
              </Pressable>
            )}
          </View>
        ) : (
          <Pressable
            style={[estilos.chip, sesion.estado.ocupado && estilos.apagado]}
            onPress={() => sesion.empezar()}
            disabled={sesion.estado.ocupado}
            accessibilityRole="button"
          >
            <Text style={estilos.chipTexto}>{sesion.estado.ocupado ? '…' : T.inicio.iniciarEntrenamiento}</Text>
          </Pressable>
        )}
      </View>

      <Text style={estilos.etiqueta}>{T.inicio.racha}</Text>
      <Text style={estilos.racha}>{perfil.racha_actual}</Text>
      {/* ANDAMIO andamio-rango-en-texto
          En web el rango NO se nombra NUNCA (§7): lo dice el objeto, y
          descubrir en qué te convertiste es la recompensa del juego. Acá se
          nombra porque el motor todavía no está portado y sin esto la pantalla
          no diría nada de eso.

          NO ES UNA DECISIÓN DE DISEÑO, ES UN ANDAMIO, y los andamios se
          quedan. Por eso está registrado en la sección 62 de `test:db`, que
          falla sola el día que el motor llegue a nativo o el 2026-12-10, lo
          que pase primero. Borrar estas tres líneas sin borrar la entrada del
          registro también falla. */}
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

      {impulsos && (
        <View style={estilos.impulsos}>
          <Text style={estilos.impulsosEt}>{T.impulso.titulo}</Text>
          {Array.from({ length: impulsos.total }, (_, i) => (
            <View key={i} style={[estilos.impulso, i < impulsos.quedan && estilos.impulsoVivo]} />
          ))}
        </View>
      )}

      {aviso !== '' && <Text style={estilos.aviso}>{aviso}</Text>}
      {sesion.estado.aviso !== '' && <Text style={estilos.aviso}>{sesion.estado.aviso}</Text>}

      {sesion.estado.corriendo && sesion.estado.inicio ? (
        <View style={estilos.sesion}>
          {/* El reloj ya está arriba, en el chip: acá manda el bloque, que es
              lo que se toca doce veces por sesión. */}
          <Bloque
            estado={sesion.estado.bloques}
            total={sesion.estado.series}
            unidad={perfil.unidad_peso === 'lb' ? 'lb' : 'kg'}
            cargaConsultada={sesion.estado.cargaConsultada}
            alSumar={sesion.serieHecha}
            alRestar={sesion.deshacerSerie}
            alSiguiente={sesion.bloqueSiguiente}
            alElegirEjercicio={sesion.elegirEjercicio}
            alMudarSeries={sesion.mudarSeries}
            alElegirMeta={sesion.elegirMeta}
            alTocarBloque={sesion.tocarBloque}
            alElegirPeso={sesion.elegirPeso}
            alCorregirPeso={sesion.corregirPesoDeSerie}
            alElegirCarga={sesion.elegirCarga}
            alCorregirCarga={sesion.corregirCargaDeBloque}
          />
          {sesion.estado.porUbicacion && <Text style={estilos.nota}>{T.inicio.sesionSola}</Text>}

          {terminando ? (
            <>
              <Text style={estilos.pregunta}>
                {T.sesion.terminarPregunta}{' '}
                <Text style={estilos.preguntaFuerte}>
                  {T.sesion.terminarLlevas(
                    sesion.estado.series,
                    duracionLinda(transcurrido(sesion.estado.inicio, sesion.estado.desfasaje))
                  )}
                </Text>
              </Text>
              {/* "Seguir" se queda con el botón sólido: el que llegó acá sin
                  querer toca donde ya estaba tocando y no pasa nada. */}
              <Pressable style={estilos.solido} onPress={() => setTerminando(false)}>
                <Text style={estilos.textoSolido}>{T.sesion.seguir}</Text>
              </Pressable>
              <Pressable
                style={estilos.secundario}
                disabled={sesion.estado.ocupado}
                onPress={async () => {
                  const c = await sesion.terminar();
                  setTerminando(false);
                  // Sin resumen si la base deshizo el día: no hubo
                  // entrenamiento, y festejar un toque sin querer es peor.
                  if (c && !c.deshizoElDia) setCierre(c);
                  cargar();
                }}
              >
                <Text style={estilos.enlace}>{sesion.estado.ocupado ? T.sesion.guardando : T.sesion.terminar}</Text>
              </Pressable>
            </>
          ) : (
            <Pressable style={estilos.solido} onPress={() => setTerminando(true)}>
              <Text style={estilos.textoSolido}>{T.sesion.terminar}</Text>
            </Pressable>
          )}
        </View>
      ) : cierre ? (
        // EL RESUMEN DEL FINAL: dos números y nada más. Se cierra tocando.
        <Pressable style={estilos.resumen} onPress={() => setCierre(null)}>
          <Text style={estilos.resumenTitulo}>{T.sesion.resumenTitulo}</Text>
          <View style={estilos.cifras}>
            <View style={estilos.cifra}>
              <Text style={estilos.cifraNumero}>{cierre.minutos}</Text>
              <Text style={estilos.etiqueta}>{T.sesion.resumenMinutos}</Text>
            </View>
            {cierre.series > 0 && (
              <View style={estilos.cifra}>
                <Text style={estilos.cifraNumero}>{cierre.series}</Text>
                <Text style={estilos.etiqueta}>{T.sesion.resumenSeries(cierre.series)}</Text>
              </View>
            )}
          </View>
          {cierre.porUbicacion && <Text style={estilos.nota}>{T.sesion.resumenSolo}</Text>}
          {/* Afuera del toque que cierra: elegir repeticiones no cierra nada. */}
          <SugerenciasDeMarca bloques={cierre.bloques} unidad={perfil.unidad_peso === 'lb' ? 'lb' : 'kg'} />
        </Pressable>
      ) : registradoHoy ? (
        // El día ya está —casi siempre lo registró la sesión—: lo que queda
        // es sumarle la foto, que antes en nativo no había cómo.
        <View style={estilos.diaListo}>
          <Text style={estilos.hecho}>{T.inicio.diaRegistrado}</Text>
          <Pressable style={estilos.secundario} onPress={() => setRegistrarAbierto(true)}>
            <Text style={estilos.enlace}>{T.registrar.agregarFoto}</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable style={estilos.solido} onPress={() => setRegistrarAbierto(true)}>
          <Text style={estilos.textoSolido}>{T.inicio.registrarDia}</Text>
        </Pressable>
      )}

      <RegistrarDia
        visible={registrarAbierto}
        racha={perfil.racha_actual}
        logId={logs.find((l) => l.fecha === hoy && !l.es_descanso)?.id ?? null}
        visibilidadDefault={perfil.visibilidad_default}
        alCerrar={() => setRegistrarAbierto(false)}
        alConfirmar={() => {
          setRegistrarAbierto(false);
          cargar();
        }}
      />

      {/* No sale con una sesión andando, igual que en la web: aparece al
          terminarla. Contestar la ventana en medio de una serie no es el
          momento. */}
      {vidaUsada && !sesion.estado.corriendo && (
        <RachaSalvada
          dias={vidaUsada.dias}
          quedan={vidaUsada.quedan}
          total={vidaUsada.total}
          rachaSiGuarda={rachaSiSeDevuelve(perfil.racha_actual)}
          alGuardar={async () => {
            // Devolver y volver a evaluar la pérdida van juntos en la base.
            const { data, error } = await supabase.rpc('devolver_impulsos', { p_fechas: vidaUsada.dias });
            if (error || !data) return false;
            await cargar();
            return true;
          }}
          alCerrar={async () => {
            // Cerrar es lo que ANOTA: hasta que no se cierra, el aviso vuelve.
            const dias = vidaUsada.dias;
            setVidaUsada(null);
            const hasta = hastaDondeVisto(dias, await plataforma.almacenamiento.leer(CLAVE_VIDA_VISTA));
            if (hasta) await plataforma.almacenamiento.guardar(CLAVE_VIDA_VISTA, hasta);
          }}
        />
      )}

      {sesion.estado.descanso && (
        <Descanso
          visible={descansoAbierto}
          vivo={sesion.estado.descanso}
          alReiniciar={sesion.reiniciarDescanso}
          alSaltar={() => {
            setDescansoAbierto(false);
            sesion.cerrarDescanso();
          }}
          alOcultar={() => setDescansoAbierto(false)}
          alSumar={sesion.serieHecha}
        />
      )}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flexGrow: 1, backgroundColor: '#05060a', padding: 24, paddingTop: 64 },
  centrado: { flex: 1, backgroundColor: '#05060a', alignItems: 'center', justifyContent: 'center', gap: 16 },
  cabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  usuario: { color: '#e8ecf6', fontSize: 16, fontWeight: '600' },
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

  impulsos: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 26 },
  impulsosEt: {
    color: '#4a5163',
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginRight: 4,
  },
  impulso: { width: 7, height: 7, borderRadius: 4, borderWidth: 1, borderColor: '#3a4152' },
  impulsoVivo: { backgroundColor: '#c4c2ba', borderColor: '#c4c2ba' },

  solido: {
    backgroundColor: '#c4c2ba',
    borderRadius: 2,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 34,
  },
  apagado: { opacity: 0.6 },
  textoSolido: { color: '#05060a', fontSize: 15, fontWeight: '600' },
  diaListo: { marginTop: 34, alignItems: 'center' },
  hecho: { color: '#8a93a8', fontSize: 14, marginTop: 34, textAlign: 'center' },
  aviso: { color: '#8a93a8', fontSize: 13, marginTop: 20, textAlign: 'center', lineHeight: 19 },
  error: { color: '#e8705f', fontSize: 13, textAlign: 'center' },
  enlace: { color: '#8a93a8', fontSize: 13 },

  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 1,
    borderColor: '#2a3040',
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 12,
    minHeight: 36,
  },
  chipTexto: { color: '#c4c2ba', fontSize: 13, fontVariant: ['tabular-nums'] },
  latido: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#7e8ca8' },
  sesionViva: { flexDirection: 'row', gap: 8 },
  chipListo: { backgroundColor: '#c4c2ba', borderColor: '#c4c2ba' },
  chipTextoListo: { color: '#05060a' },

  sesion: { marginTop: 16 },
  crono: { color: '#e8ecf6', fontSize: 44, fontWeight: '300', fontVariant: ['tabular-nums'], marginTop: 4 },
  nota: { color: '#4a5163', fontSize: 12, lineHeight: 17, marginTop: 8 },
  pregunta: { color: '#8a93a8', fontSize: 14, lineHeight: 20, marginTop: 24 },
  preguntaFuerte: { color: '#e8ecf6', fontWeight: '600' },
  secundario: { paddingVertical: 14, alignItems: 'center' },

  resumen: {
    marginTop: 34,
    paddingVertical: 22,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#1d2230',
  },
  resumenTitulo: { color: '#e8ecf6', fontSize: 18, fontWeight: '500' },
  cifras: { flexDirection: 'row', gap: 36, marginTop: 14 },
  cifra: { alignItems: 'flex-start' },
  cifraNumero: { color: '#c4c2ba', fontSize: 40, fontWeight: '300', fontVariant: ['tabular-nums'] },
});
