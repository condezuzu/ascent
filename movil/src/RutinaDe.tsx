import { useEffect, useState, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { hayAlgo, ORDEN_SEMANA, soloLosDias } from '@nucleo/rutinas';
import { T } from '@nucleo/textos';
import { nombreVisible } from '@nucleo/propios';
import { cargarRutinaParaVer, catalogoDeRutina, copiarRutina, type CatalogoDeRutina, type RutinaParaVer } from '@compartido/rutinas';
import { supabase } from './supabase';
import RutinaPlegada from './RutinaPlegada';
import { C } from './colores';

/**
 * LA RUTINA DE ALGUIEN, PARA MIRARLA (14/10): la tuya en tu perfil, la de un
 * amigo en el suyo. La de un amigo se puede copiar: queda como una rutina tuya,
 * libre, sin atadura con la de él.
 *
 * Antes tu propia rutina no se veía en ningún lado: la función te la devolvía,
 * pero tu perfil es otra pantalla y nunca la pedía.
 *
 * DESDE EL 19/10 (bugs del gimnasio): la de otra persona se ve con todos los días abiertos
 * —la lista completa, no un botón por día en lugar de la lista— y «Copiar esta rutina» está
 * siempre, no solo si ya tenías rutinas guardadas. Copiar abre la elección por días: un
 * círculo por día, y se copian los marcados.
 */
export default function RutinaDe({ quien, esYo = false, nombre }: { quien: string; esYo?: boolean; nombre?: string }) {
  const [rutina, setRutina] = useState<RutinaParaVer | null>(null);
  const [catalogo, setCatalogo] = useState<CatalogoDeRutina>(new Map());
  const [aviso, setAviso] = useState('');
  const [eligiendo, setEligiendo] = useState(false);
  const [elegidos, setElegidos] = useState<number[]>([]);

  useEffect(() => {
    let vivo = true;
    void Promise.all([cargarRutinaParaVer(supabase, quien, esYo), catalogoDeRutina(supabase)]).then(([r, c]) => {
      if (!vivo) return;
      setRutina(r);
      setCatalogo(c);
    });
    return () => {
      vivo = false;
    };
  }, [quien, esYo]);

  const copiando = useRef(false);

  async function copiar() {
    // De a un toque (cacería del 15/10): con señal lenta, el segundo creaba otra copia.
    if (!rutina || copiando.current || elegidos.length === 0) return;
    copiando.current = true;
    try {
      await copiarUnaVez();
    } finally {
      copiando.current = false;
    }
  }

  async function copiarUnaVez() {
    if (!rutina) return;
    setAviso('');
    const nombreNuevo = T.rutina.deAlguien(nombre ?? '');
    // Una rutina más: la tuya sigue activa (ver `copiarRutina`). Solo los días marcados.
    const r = await copiarRutina(supabase, nombreNuevo, soloLosDias(rutina.dias, elegidos));
    if (!r) return setAviso(T.general.noSePudo);
    setEligiendo(false);
    setElegidos([]);
    setAviso(r.activa ? T.rutina.copiadaActiva(nombreNuevo) : T.rutina.copiada(nombreNuevo));
  }

  if (!rutina || rutina.escondida) return null;
  const hay = hayAlgo(rutina.dias);
  const conAlgo = ORDEN_SEMANA.filter((d) => rutina.dias[d].descanso || rutina.dias[d].ejercicios.length > 0);
  const tocar = (d: number) => setElegidos((e) => (e.includes(d) ? e.filter((x) => x !== d) : [...e, d]));

  return (
    <View testID={esYo ? 'mi-rutina-en-perfil' : 'rutina-de-amigo'} style={estilos.caja}>
      <Text style={estilos.seccion}>{esYo ? T.rutina.titulo : T.social.suRutina}</Text>
      {!hay ? (
        <Text style={estilos.nota}>{esYo ? T.rutina.vacia : T.social.rutinaVacia}</Text>
      ) : eligiendo ? (
        <View testID="copiar-por-dias">
          <Text style={estilos.indicacion}>{T.rutina.eligeDias}</Text>
          {conAlgo.map((d) => {
            const dia = rutina.dias[d];
            const marcado = elegidos.includes(d);
            return (
              <Pressable
                key={d}
                testID={`copiar-dia-${d}`}
                style={({ pressed }) => [estilos.diaElegible, pressed && estilos.tocado]}
                onPress={() => tocar(d)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: marcado }}
              >
                <View style={[estilos.circulo, marcado && estilos.circuloMarcado]}>{marcado && <View style={estilos.tilde} />}</View>
                <View style={estilos.diaCuerpo}>
                  <Text style={estilos.diaNombre}>{T.fechas.diasLargos[d]}</Text>
                  {dia.descanso ? (
                    <Text style={estilos.ejercicio}>{T.rutina.descanso}</Text>
                  ) : (
                    dia.ejercicios.map((e, i) => (
                      <View key={`${e.ejercicio}-${i}`} style={estilos.fila}>
                        <Text style={estilos.ejercicio} numberOfLines={1}>
                          {nombreVisible(e.ejercicio, catalogo.get(e.ejercicio)?.nombre)}
                        </Text>
                        <Text style={estilos.cantidad}>{e.minutos !== undefined ? T.rutina.minutos(e.minutos) : e.series > 0 ? T.rutina.series(e.series) : ''}</Text>
                      </View>
                    ))
                  )}
                </View>
              </Pressable>
            );
          })}
          <View style={estilos.botones}>
            <Pressable style={[estilos.pildora, estilos.pildoraBorde]} onPress={() => { setEligiendo(false); setElegidos([]); }} accessibilityRole="button">
              <Text style={estilos.pildoraBordeTexto}>{T.rutina.cancelar}</Text>
            </Pressable>
            <Pressable
              testID="copiar-elegidos"
              style={[estilos.pildora, estilos.pildoraCrema, elegidos.length === 0 && estilos.apagada]}
              onPress={() => void copiar()}
              disabled={elegidos.length === 0}
              accessibilityRole="button"
            >
              <Text style={estilos.pildoraCremaTexto}>{T.rutina.copiarDias(elegidos.length)}</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <>
          {rutina.nombre && <Text style={estilos.nombre}>{rutina.nombre}</Text>}
          <RutinaPlegada dias={rutina.dias} catalogo={catalogo} soloConAlgo={rutina.deducida} abiertos={!esYo} />
          {!esYo && (
            <Pressable testID="rutina-copiar" style={[estilos.pildora, estilos.pildoraBorde, estilos.copiar]} onPress={() => setEligiendo(true)} accessibilityRole="button">
              <Text style={estilos.pildoraBordeTexto}>{T.rutina.copiar}</Text>
            </Pressable>
          )}
        </>
      )}
      {!!aviso && <Text style={estilos.nota}>{aviso}</Text>}
    </View>
  );
}

const estilos = StyleSheet.create({
  caja: { marginTop: 8 },
  seccion: { color: C.sub, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', marginTop: 26, marginBottom: 10 },
  nombre: { color: C.apagado, fontSize: 12, marginBottom: 4 },
  nota: { color: C.apagado, fontSize: 12, lineHeight: 17, marginTop: 6 },
  indicacion: { color: C.sub, fontSize: 13, marginBottom: 6 },
  diaElegible: { flexDirection: 'row', gap: 12, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.linea },
  tocado: { opacity: 0.6 },
  circulo: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: '#626b80', alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  circuloMarcado: { backgroundColor: C.claro, borderColor: C.claro },
  tilde: { width: 9, height: 5, borderLeftWidth: 2, borderBottomWidth: 2, borderColor: C.fondo, transform: [{ rotate: '-45deg' }, { translateY: -1 }] },
  diaCuerpo: { flex: 1, minWidth: 0 },
  diaNombre: { color: C.tinta, fontSize: 15, marginBottom: 4 },
  fila: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 3 },
  ejercicio: { color: C.sub, fontSize: 14, flexShrink: 1 },
  cantidad: { color: C.apagado, fontSize: 13, fontVariant: ['tabular-nums'] },
  botones: { flexDirection: 'row', gap: 10, marginTop: 14 },
  pildora: { flex: 1, borderRadius: 999, paddingVertical: 12, alignItems: 'center' },
  pildoraBorde: { borderWidth: 1, borderColor: '#626b80' },
  pildoraBordeTexto: { color: C.tinta, fontSize: 14 },
  pildoraCrema: { backgroundColor: C.claro },
  pildoraCremaTexto: { color: C.fondo, fontSize: 14, fontWeight: '600' },
  apagada: { opacity: 0.4 },
  copiar: { flex: 0, alignSelf: 'stretch', marginTop: 14 },
});
