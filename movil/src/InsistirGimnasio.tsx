import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  CLAVE_INSISTIR_GIMNASIO,
  despuesDeMostrar,
  hayQueInsistir,
  leerMemoria,
} from '@nucleo/insistirGimnasio';
import { T } from '@nucleo/textos';
import { plataforma } from '@plataforma';
import { C } from './colores';

/**
 * "ESTE DÍA LO ANOTASTE TÚ." El ofrecimiento del punto del gimnasio, en el
 * único momento en que se puede demostrar en vez de explicar: recién
 * registrado el día a mano.
 *
 * La regla —cuándo sí, cuántas veces, hasta cuándo— está en
 * `nucleo/insistirGimnasio.ts`, con sus porqués y sus tests. Acá está la
 * pantalla y nada más.
 *
 * ES UN OFRECIMIENTO, NO UN AVISO: se toca y lleva a marcarlo. Un cartel que
 * dice qué te estás perdiendo y no se puede tocar es peor que no decir nada.
 */
export default function InsistirGimnasio({ alMarcar }: { alMarcar: () => void }) {
  return (
    <Pressable style={estilos.tarjeta} onPress={alMarcar} accessibilityRole="button">
      <View style={estilos.texto}>
        <Text style={estilos.titulo}>{T.inicio.insistirGimnasioTitulo}</Text>
        <Text style={estilos.nota}>{T.inicio.insistirGimnasioNota}</Text>
      </View>
      <Text style={estilos.accion}>{T.inicio.insistirGimnasioAccion}</Text>
    </Pressable>
  );
}

/**
 * ¿Se insiste hoy? LA DECISIÓN VIVE ACÁ ARRIBA Y NO ADENTRO DEL CARTEL porque
 * Inicio también la necesita: el globo quieto de "marca tu gimnasio" y esto
 * dicen lo mismo, y los dos juntos serían dos carteles sobre lo mismo en la
 * misma pantalla. Cuando este aparece, aquel se calla.
 *
 * SE DECIDE UNA VEZ Y NO CAMBIA. Si se recalculara mientras está a la vista,
 * guardar la memoria lo haría desaparecer solo, a mitad de la lectura. Se
 * pregunta una vez; lo que se guarda es para la próxima.
 *
 * `listo` EXISTE PORQUE LOS HOOKS VAN ANTES DE LOS RETORNOS TEMPRANOS. Inicio
 * llama a esto arriba de todo, cuando el perfil y los días todavía pueden
 * estar cargando: sin esperarlos, la única decisión que se tomaría sería con
 * `registradoHoy` en falso, o sea "no insistir", para siempre. Así que la
 * pregunta se hace recién cuando hay datos, y una sola vez —`preguntado`—
 * aunque el perfil se recargue después.
 */
export function useInsistirGimnasio(
  listo: boolean,
  tienePunto: boolean,
  registradoHoy: boolean,
  hoy: string
): boolean {
  const [mostrar, setMostrar] = useState(false);
  const preguntado = useRef(false);

  useEffect(() => {
    if (!listo || preguntado.current) return;
    preguntado.current = true;
    let vivo = true;
    (async () => {
      const memoria = leerMemoria(await plataforma.almacenamiento.leer(CLAVE_INSISTIR_GIMNASIO));
      if (!vivo) return;
      if (!hayQueInsistir(tienePunto, registradoHoy, hoy, memoria)) return;
      setMostrar(true);
      // Se anota ENSEGUIDA y no al cerrarlo: no hay forma de cerrarlo, y si se
      // anotara al desmontar, cambiar de pestaña y volver lo contaría de nuevo.
      await plataforma.almacenamiento.guardar(
        CLAVE_INSISTIR_GIMNASIO,
        JSON.stringify(despuesDeMostrar(hoy, memoria))
      );
    })().catch(() => {
      // Sin almacenamiento no se insiste. El globo quieto de Inicio sigue
      // estando: la oferta no se pierde, solo el empujón.
      preguntado.current = false;
    });
    return () => {
      vivo = false;
    };
    // Solo `listo`: lo demás se lee una vez, cuando llega. Ver arriba.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listo]);

  return mostrar;
}

const estilos = StyleSheet.create({
  // Con borde y sin relleno: acompaña al día registrado, no compite con él.
  tarjeta: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.linea,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: 12,
    gap: 10,
  },
  texto: { gap: 4 },
  titulo: { color: C.tinta, fontSize: 14 },
  nota: { color: C.apagado, fontSize: 12, lineHeight: 17 },
  accion: { color: C.sub, fontSize: 12, letterSpacing: 1.6, textTransform: 'uppercase' },
});
