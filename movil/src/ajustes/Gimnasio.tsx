import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { marcarPunto } from '@compartido/gimnasio';
import type { Perfil } from '@nucleo/tipos';
import { T } from '@nucleo/textos';
import { supabase } from '../supabase';
import { C } from '../colores';

/**
 * EL PUNTO DEL GIMNASIO, para que el día se registre solo (§13). La misma
 * pantalla que la web (`components/ajustes/Gimnasio.tsx`), con la misma
 * función de marcar (`compartido/gimnasio.ts`).
 *
 * ES LO QUE DIFERENCIA A LA APP y hasta hoy en nativo no estaba, que era el
 * agujero más raro del inventario: acá el permiso de ubicación EXISTE de
 * verdad y el sistema puede despertar a la app al llegar, que es justo lo que
 * en web no se podía hacer.
 *
 * DOS REGLAS DE §13 que se ven en el diseño:
 *  - **Solo se marca ESTANDO en el gimnasio.** Un punto puesto desde el sillón
 *    de casa es peor que no tener punto: registra días que no ocurrieron. Por
 *    eso el botón dice dónde hay que estar y no hay forma de escribir
 *    coordenadas a mano.
 *  - **El registro a mano nunca desaparece.** Esto es un atajo, no el camino.
 *
 * LO QUE TODAVÍA NO HACE, y hay que decirlo cada vez: registrar con la app
 * CERRADA. Eso necesita `UIBackgroundModes: location`, que es lo que Apple
 * revisa con lupa, y va cuando la app esté en TestFlight. Mientras tanto hace
 * lo mismo que la web: si abrís la app estando ahí, el día entra solo.
 */
export default function Gimnasio({
  perfil,
  alCambiar,
}: {
  perfil: Perfil;
  alCambiar: (parcial: Partial<Perfil>) => void;
}) {
  const [estado, setEstado] = useState<'' | 'buscando' | 'listo' | 'error'>('');
  const [detalle, setDetalle] = useState('');

  const puesto = perfil.gimnasio_lat !== null && perfil.gimnasio_lat !== undefined;

  async function marcar() {
    setEstado('buscando');
    setDetalle('');
    const r = await marcarPunto(supabase, perfil.id);
    if (!r.ok) {
      setEstado('error');
      return setDetalle(
        r.motivo === 'sin-gps'
          ? T.ajustes.gimnasioSinGps
          : r.motivo === 'sin-permiso'
            ? T.ajustes.gimnasioSinPermiso
            : r.motivo === 'impreciso'
              ? T.ajustes.gimnasioImpreciso(r.precision)
              : T.general.noSePudo
      );
    }
    alCambiar({ gimnasio_lat: r.lat, gimnasio_lon: r.lon });
    setEstado('listo');
    // La precisión se muestra porque cambia lo que se puede esperar: con 200
    // metros de error el atajo va a fallar, y es mejor saberlo ahora.
    setDetalle(T.ajustes.gimnasioListo(Math.round(r.precision)));
  }

  async function borrar() {
    const { error } = await supabase
      .from('profiles')
      .update({ gimnasio_lat: null, gimnasio_lon: null })
      .eq('id', perfil.id);
    if (error) return setDetalle(T.general.falloPunto);
    alCambiar({ gimnasio_lat: null, gimnasio_lon: null });
    setEstado('');
    setDetalle('');
  }

  return (
    <View style={estilos.seccion}>
      <Text style={estilos.titulo}>{T.ajustes.gimnasio}</Text>

      <Pressable style={estilos.boton} onPress={marcar} disabled={estado === 'buscando'}>
        <Text style={estilos.botonTexto}>
          {estado === 'buscando' ? T.ajustes.gimnasioBuscando : puesto ? T.ajustes.gimnasioRemarcar : T.ajustes.gimnasioMarcar}
        </Text>
      </Pressable>

      <Text style={estilos.nota}>
        <Text style={estilos.fuerte}>{T.ajustes.gimnasioComo}</Text> {T.ajustes.gimnasioParaQue}
      </Text>
      <Text style={estilos.nota}>{T.ajustes.gimnasioTechoNativo}</Text>

      {detalle !== '' && <Text style={[estilos.nota, estado === 'error' && estilos.error]}>{detalle}</Text>}

      {puesto && (
        <>
          <Text style={estilos.nota}>{T.ajustes.gimnasioPuesto}</Text>
          <Pressable style={estilos.boton} onPress={borrar}>
            <Text style={estilos.botonTexto}>{T.ajustes.gimnasioBorrar}</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  seccion: { marginTop: 30 },
  // EL MISMO RÓTULO QUE EL RESTO DE AJUSTES: chico, en versalitas y apagado.
  // Estas secciones nacieron con título grande y quedaban como pegadas de otra
  // pantalla — dos estilos de título en una lista se leen como un error.
  titulo: { color: C.sub, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 },
  boton: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.lineaFuerte,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 10,
  },
  botonTexto: { color: C.tinta, fontSize: 14 },
  nota: { color: C.apagado, fontSize: 12, lineHeight: 17, marginTop: 8 },
  fuerte: { color: C.sub },
  error: { color: C.error },
});
