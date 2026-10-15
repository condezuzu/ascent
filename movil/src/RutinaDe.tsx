import { useEffect, useState, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { hayAlgo, type DiaDeSemana } from '@nucleo/rutinas';
import { T } from '@nucleo/textos';
import {
  activarRutina,
  cargarMisRutinas,
  cargarRutinaParaVer,
  catalogoDeRutina,
  copiarRutina,
  hayRutinasGuardadas,
  type CatalogoDeRutina,
  type RutinaParaVer,
} from '@compartido/rutinas';
import { supabase } from './supabase';
import RutinaPlegada from './RutinaPlegada';
import { C } from './colores';

/**
 * LA RUTINA DE ALGUIEN, PARA MIRARLA (14/10): la tuya en tu perfil, la de un
 * amigo en el suyo. Plegada por día. La de un amigo se puede copiar: queda como
 * una rutina tuya, libre, sin atadura con la de él.
 *
 * Antes tu propia rutina no se veía en ningún lado: la función te la devolvía,
 * pero tu perfil es otra pantalla y nunca la pedía.
 */
export default function RutinaDe({ quien, esYo = false, nombre }: { quien: string; esYo?: boolean; nombre?: string }) {
  const [rutina, setRutina] = useState<RutinaParaVer | null>(null);
  const [catalogo, setCatalogo] = useState<CatalogoDeRutina>(new Map());
  const [sePuedeCopiar, setSePuedeCopiar] = useState(false);
  const [aviso, setAviso] = useState('');
  // La que estaba activa antes de copiar: "Volver a «…»" la reactiva con un toque.
  const [anterior, setAnterior] = useState<{ id: string; nombre: string; dias: DiaDeSemana[] } | null>(null);

  useEffect(() => {
    let vivo = true;
    void Promise.all([cargarRutinaParaVer(supabase, quien, esYo), catalogoDeRutina(supabase), hayRutinasGuardadas(supabase)]).then(([r, c, hay]) => {
      if (!vivo) return;
      setRutina(r);
      setCatalogo(c);
      setSePuedeCopiar(hay && !esYo);
    });
    return () => {
      vivo = false;
    };
  }, [quien, esYo]);

  const copiando = useRef(false);

  async function copiar() {
    // De a un toque (cacería del 15/10): con señal lenta, el segundo creaba otra copia.
    if (!rutina || copiando.current) return;
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
    // Copiar es para seguir la semana con esa: queda activa.
    const r = await copiarRutina(supabase, nombreNuevo, rutina.dias);
    if (!r) return setAviso(T.general.noSePudo);
    setAnterior(r.anterior);
    setAviso(T.rutina.copiada(nombreNuevo));
  }

  async function volver() {
    if (!anterior) return;
    if (!(await activarRutina(supabase, anterior.id, anterior.dias))) return setAviso(T.general.noSePudo);
    void cargarMisRutinas(supabase);
    setAviso(T.rutina.otraVezActiva(anterior.nombre));
    setAnterior(null);
  }

  if (!rutina || rutina.escondida) return null;
  const hay = hayAlgo(rutina.dias);

  return (
    <View testID={esYo ? 'mi-rutina-en-perfil' : 'rutina-de-amigo'} style={estilos.caja}>
      <Text style={estilos.seccion}>{esYo ? T.rutina.titulo : T.social.suRutina}</Text>
      {!hay ? (
        <Text style={estilos.nota}>{esYo ? T.rutina.vacia : T.social.rutinaVacia}</Text>
      ) : (
        <>
          {rutina.nombre && <Text style={estilos.nombre}>{rutina.nombre}</Text>}
          <RutinaPlegada dias={rutina.dias} catalogo={catalogo} soloConAlgo={rutina.deducida} />
          {sePuedeCopiar && (
            <Pressable testID="rutina-copiar" style={estilos.boton} onPress={() => void copiar()}>
              <Text style={estilos.botonTexto}>{T.rutina.copiar}</Text>
            </Pressable>
          )}
        </>
      )}
      {!!aviso && <Text style={estilos.nota}>{aviso}</Text>}
      {anterior && (
        <Pressable testID="rutina-volver" style={estilos.boton} onPress={() => void volver()}>
          <Text style={estilos.botonTexto}>{T.rutina.volverA(anterior.nombre)}</Text>
        </Pressable>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  caja: { marginTop: 8 },
  seccion: { color: C.sub, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', marginTop: 26, marginBottom: 10 },
  nombre: { color: C.apagado, fontSize: 12, marginBottom: 4 },
  nota: { color: C.apagado, fontSize: 12, lineHeight: 17, marginTop: 6 },
  boton: { alignSelf: 'flex-start', borderWidth: StyleSheet.hairlineWidth, borderColor: C.lineaFuerte, borderRadius: 8, paddingVertical: 7, paddingHorizontal: 12, marginTop: 10 },
  botonTexto: { color: C.tinta, fontSize: 13 },
});
