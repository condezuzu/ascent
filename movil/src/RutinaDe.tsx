import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { hayAlgo } from '@nucleo/rutinas';
import { T } from '@nucleo/textos';
import {
  activarRutina,
  cargarMisRutinas,
  cargarRutinaParaVer,
  catalogoDeRutina,
  guardarRutina,
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

  async function copiar() {
    if (!rutina) return;
    setAviso('');
    const id = await guardarRutina(supabase, { id: null, nombre: T.rutina.deAlguien(nombre ?? ''), dias: rutina.dias });
    // Copiar es para seguir la semana con esa: queda activa.
    if (!id || !(await activarRutina(supabase, id))) return setAviso(T.general.noSePudo);
    void cargarMisRutinas(supabase);
    setAviso(T.rutina.copiada);
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
