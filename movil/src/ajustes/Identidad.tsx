import { useState } from 'react';
import Segmentado from '../Segmentado';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { borrarPerfilCache } from '@compartido/cache';
import type { Perfil, Sexo as SexoValor } from '@nucleo/tipos';
import { nombreValido } from '@nucleo/usuario';
import { T } from '@nucleo/textos';
import { supabase } from '../supabase';
import { C } from '../colores';

/**
 * LOS TRES DATOS DE LA CUENTA que faltaban en nativo: el nombre de usuario,
 * con qué visibilidad nacen las fotos, y el sexo.
 *
 * VAN JUNTOS EN UN ARCHIVO y separados en la pantalla: los tres son "quién
 * sos" y ninguno llega a media pantalla solo. En la web son tres componentes
 * porque ahí cada uno creció por su lado.
 *
 * EL SEXO NO ES UN DATO DE PERFIL, es un coeficiente. DOTS usa dos juegos de
 * coeficientes (§16.7) y quien no lo carga no tiene DOTS ni ranking de fuerza.
 * No se asume ninguno: calcularlo con la fórmula equivocada da un número que
 * parece razonable, ordena mal el ranking, y nadie lo notaría.
 *
 * Y EL AVISO DEBAJO NO SE ACORTA (§16.7c): activar el DOTS deja que tus amigos
 * deduzcan aproximadamente tu peso corporal. Eso se dice ANTES de guardar.
 */
export default function Identidad({
  perfil,
  alCambiar,
}: {
  perfil: Perfil;
  alCambiar: (parcial: Partial<Perfil>) => void;
}) {
  const [nombre, setNombre] = useState(perfil.username ?? '');
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState('');
  const [error, setError] = useState('');

  // El nombre es único e insensible a mayúsculas: la unicidad la garantiza el
  // índice de la base, no una consulta previa. Preguntar "¿está libre?" y
  // después escribir deja una ventana en el medio donde otro se lo lleva.
  async function guardarNombre() {
    const limpio = nombre.trim();
    setAviso('');
    setError('');
    if (limpio === perfil.username) return;
    if (!nombreValido(limpio)) return setError(T.ajustes.nombreFormato);
    setGuardando(true);
    const { error: err } = await supabase.from('profiles').update({ username: limpio }).eq('id', perfil.id);
    setGuardando(false);
    if (err) {
      if (err.code === '23505') return setError(T.ajustes.nombreTomado);
      return setError(T.general.noSePudo);
    }
    alCambiar({ username: limpio });
    await borrarPerfilCache(); // la caché tiene el nombre viejo
    setAviso(T.ajustes.nombreListo);
    setTimeout(() => setAviso(''), 3000);
  }

  /** Se pinta el cambio ya y se guarda de fondo; si la base lo rechaza, vuelve. */
  async function guardar<K extends keyof Perfil>(campo: K, valor: Perfil[K]) {
    const antes = perfil[campo];
    alCambiar({ [campo]: valor } as Partial<Perfil>);
    const { error: err } = await supabase.from('profiles').update({ [campo]: valor }).eq('id', perfil.id);
    if (err) {
      alCambiar({ [campo]: antes } as Partial<Perfil>);
      setError(T.general.noSePudo);
    }
  }

  // `?? null` y no `=== null` a secas: si el código llega antes que la
  // migración, la columna no existe y el valor es `undefined`, que no es "sin
  // cargar" para una comparación estricta y dejaría los tres botones apagados.
  const sexo = perfil.sexo ?? null;

  return (
    <>
      <View style={estilos.seccion}>
        <Text style={estilos.titulo}>{T.ajustes.nombreUsuario}</Text>
        <View style={estilos.fila}>
          <TextInput
            style={estilos.campo}
            value={nombre}
            onChangeText={setNombre}
            placeholder={T.ajustes.nombrePlaceholder}
            placeholderTextColor={C.apagado}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={20}
          />
          <Pressable
            style={[estilos.boton, nombre.trim() === perfil.username && estilos.apagado]}
            onPress={guardarNombre}
            disabled={guardando || nombre.trim() === perfil.username}
          >
            <Text style={estilos.botonTexto}>{guardando ? '…' : T.general.guardar}</Text>
          </Pressable>
        </View>
        {aviso !== '' && <Text style={estilos.ok}>{aviso}</Text>}
        {error !== '' && <Text style={estilos.error}>{error}</Text>}
      </View>

      <View style={estilos.seccion}>
        <Text style={estilos.titulo}>{T.ajustes.fotosNuevas}</Text>
        {/* `!== 'amigos'` y no `=== 'privada'`: si algún día aparece un
            tercer valor, el botón seguro es el que menos comparte. */}
        <Segmentado<'privada' | 'amigos'>
          opciones={[
            { valor: 'privada', texto: T.ajustes.soloYo },
            { valor: 'amigos', texto: T.ajustes.amigos },
          ]}
          valor={perfil.visibilidad_default === 'amigos' ? 'amigos' : 'privada'}
          alElegir={(v) => guardar('visibilidad_default', v)}
        />
      </View>

      <View style={estilos.seccion}>
        <Text style={estilos.titulo}>{T.ajustes.sexo}</Text>
        <Segmentado<SexoValor>
          opciones={[
            { valor: null as SexoValor, texto: T.ajustes.sinCargar },
            { valor: 'f' as SexoValor, texto: T.ajustes.mujer },
            { valor: 'm' as SexoValor, texto: T.ajustes.hombre },
          ]}
          valor={sexo as SexoValor}
          alElegir={(v) => guardar('sexo', v)}
        />
        {/* §16.7c: este aviso no se saca (activar el DOTS deja deducir el peso). */}
        <Text style={estilos.nota}>{T.ajustes.sexoAviso}</Text>
      </View>
    </>
  );
}


const estilos = StyleSheet.create({
  seccion: { marginTop: 30 },
  // EL MISMO RÓTULO QUE EL RESTO DE AJUSTES: chico, en versalitas y apagado.
  // Estas secciones nacieron con título grande y quedaban como pegadas de otra
  // pantalla — dos estilos de título en una lista se leen como un error.
  titulo: { color: C.sub, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 },
  fila: { flexDirection: 'row', gap: 8 },
  campo: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.lineaFuerte,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: C.tinta,
    fontSize: 15,
  },
  boton: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.lineaFuerte,
    borderRadius: 10,
    paddingHorizontal: 18,
    justifyContent: 'center',
  },
  apagado: { opacity: 0.45 },
  botonTexto: { color: C.tinta, fontSize: 14 },
  nota: { color: C.apagado, fontSize: 12, lineHeight: 17, marginTop: 8 },
  ok: { color: C.sub, fontSize: 13, marginTop: 8 },
  error: { color: C.error, fontSize: 13, marginTop: 8 },
});
