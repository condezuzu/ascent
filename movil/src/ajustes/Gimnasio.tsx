import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { marcarPunto, PUNTO_CAMBIO } from '@compartido/gimnasio';
import { eventos } from '@compartido/eventos';
import { plataforma } from '@plataforma';
import type { Perfil } from '@nucleo/tipos';
import { T } from '@nucleo/textos';
import { supabase } from '../supabase';
import { C, conAlfa } from '../colores';
import PinGimnasio from '../PinGimnasio';

/**
 * LLEVAR A MARCAR EL GIMNASIO (15/10): "Deja que se marque solo" en Inicio cambia
 * de pestaña y emite esto; la caja de los botones se ilumina dos veces para que se
 * encuentre. Ajustes, de paso, vuelve arriba.
 */
export const RESALTAR_GIMNASIO = 'ascent:resaltar-gimnasio';

// Ajustes se monta recién la primera vez que se abre: un aviso emitido antes se
// perdería. Queda anotado y Mi gimnasio lo lee al montarse.
let pedidoEn = 0;
export function pedirResaltarGimnasio() {
  pedidoEn = Date.now();
  eventos.emitir(RESALTAR_GIMNASIO);
}

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
 * LO QUE ANTES NO HACÍA Y AHORA SÍ (24/9): registrar con la app CERRADA. Se
 * registra una zona en el sistema operativo y es el teléfono el que levanta a
 * la app al llegar. Hasta acá esta pantalla decía lo contrario, y con razón:
 * el puerto sabía hacerlo desde la migración pero no lo llamaba nadie.
 *
 * EL TECHO QUE QUEDA, y por eso el texto no promete: hace falta el permiso de
 * ubicación **siempre**, que iOS pide aparte y se puede negar. Sin él la app
 * vuelve sola a lo que hace la web —entra si la abrís estando ahí—, que es el
 * piso con el que esto se diseñó (§13).
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
  const luz = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const resaltar = () => {
      pedidoEn = 0;
      luz.setValue(0);
      // Con una pausa: que se vea DESPUÉS de cambiar de pestaña, no durante.
      const subir = Animated.timing(luz, { toValue: 1, duration: 260, useNativeDriver: true });
      const bajar = Animated.timing(luz, { toValue: 0, duration: 420, useNativeDriver: true });
      Animated.sequence([Animated.delay(320), subir, bajar, subir, bajar]).start();
    };
    if (Date.now() - pedidoEn < 3000) resaltar();
    return eventos.escuchar(RESALTAR_GIMNASIO, resaltar);
  }, [luz]);

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
    // QUE EL VIGILANTE SE ENTERE AHORA y no en el próximo arranque: él leyó el
    // perfil al montarse, o sea antes de que este punto existiera. Sin este
    // aviso, el estreno de la función —marcar el punto y después ir— era el
    // caso que no andaba.
    eventos.emitir(PUNTO_CAMBIO);
    setEstado('listo');
    // La precisión se muestra porque cambia lo que se puede esperar: con 200
    // metros de error el atajo va a fallar, y es mejor saberlo ahora.
    setDetalle(T.ajustes.gimnasioListoNativo(Math.round(r.precision)));
  }

  async function borrar() {
    const { error } = await supabase
      .from('profiles')
      .update({ gimnasio_lat: null, gimnasio_lon: null })
      .eq('id', perfil.id);
    if (error) return setDetalle(T.general.falloPunto);
    // SIN PUNTO NO HAY ZONA. La del sistema sobrevive a cerrar la app —para
    // eso existe—, así que borrar el punto sin soltarla dejaría al teléfono
    // despertando a la app en un lugar que ya no es el gimnasio de nadie.
    await plataforma.ubicacion.dejarDeVigilar();
    alCambiar({ gimnasio_lat: null, gimnasio_lon: null });
    eventos.emitir(PUNTO_CAMBIO);
    setEstado('');
    setDetalle('');
  }

  return (
    <View style={estilos.seccion}>
      <Text style={estilos.titulo}>{T.ajustes.gimnasio}</Text>

      {/* UNA SOLA CAJA, como los controles de Ajustes (Kilos | Libras): radio 12,
          borde fino, y el borrar debajo del marcar con un separador (15/10). */}
      <View style={estilos.caja}>
        <Pressable testID="gimnasio-marcar" style={estilos.renglon} onPress={marcar} disabled={estado === 'buscando'}>
          <PinGimnasio tam={16} color={C.tinta} />
          <Text style={estilos.botonTexto}>
            {estado === 'buscando' ? T.ajustes.gimnasioBuscando : puesto ? T.ajustes.gimnasioRemarcar : T.ajustes.gimnasioMarcar}
          </Text>
        </Pressable>
        {puesto && (
          <Pressable style={[estilos.renglon, estilos.separado]} onPress={borrar}>
            <Text style={estilos.botonTexto}>{T.ajustes.gimnasioBorrar}</Text>
          </Pressable>
        )}
        <Animated.View testID="gimnasio-luz" pointerEvents="none" style={[estilos.luz, { opacity: luz }]} />
      </View>
      {/* Que se sepa que hay que estar AHÍ: un punto marcado desde casa registra días que no ocurrieron. */}
      <Text style={estilos.estandoAhi}>{T.ajustes.gimnasioEstandoAhi}</Text>


      {detalle !== '' && <Text style={[estilos.nota, estado === 'error' && estilos.error]}>{detalle}</Text>}
    </View>
  );
}

const estilos = StyleSheet.create({
  seccion: { marginTop: 30 },
  // EL MISMO RÓTULO QUE EL RESTO DE AJUSTES: chico, en versalitas y apagado.
  // Estas secciones nacieron con título grande y quedaban como pegadas de otra
  // pantalla — dos estilos de título en una lista se leen como un error.
  titulo: { color: C.sub, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 },
  caja: { borderWidth: StyleSheet.hairlineWidth, borderColor: C.lineaFuerte, borderRadius: 12, overflow: 'hidden', marginTop: 10 },
  renglon: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, paddingVertical: 11, paddingHorizontal: 6 },
  separado: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.lineaFuerte },
  luz: { ...StyleSheet.absoluteFillObject, borderRadius: 12, borderWidth: 1, borderColor: C.claro, backgroundColor: conAlfa(C.claro, 0.08) },
  botonTexto: { color: C.tinta, fontSize: 14 },
  estandoAhi: { color: C.apagado, fontSize: 12, marginTop: 6 },
  nota: { color: C.apagado, fontSize: 12, lineHeight: 17, marginTop: 8 },
  error: { color: C.error },
});
