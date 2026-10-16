import { useEffect, useState } from 'react';
import Segmentado from '../Segmentado';
import { StyleSheet, Text, View } from 'react-native';
import { CAMBIO_FONDO, esPreferenciaFondo, type PreferenciaFondo } from '@nucleo/fondo';
import { eventos } from '@compartido/eventos';
import { T } from '@nucleo/textos';
import { plataforma } from '@plataforma';
import { C } from '../colores';
import { CALIDAD_CAMBIO, type PreferenciaDeCalidad } from '@nucleo/calidad';
import { fijarCalidad, leerCalidad, preferenciaAhora } from '../calidad';

/**
 * EL FONDO: automático, siempre, o nunca.
 *
 * LA APP YA RESPETABA ESTO Y NO HABÍA CÓMO CAMBIARLO. `FondoRaiz` lee esta
 * misma llave desde el primer día del motor nativo; lo que faltaba era la
 * pantalla, así que en el teléfono la preferencia existía y era inalcanzable.
 *
 * ES DE ESTE APARATO, no de la cuenta: el mismo usuario puede tener un teléfono
 * viejo y una computadora buena, y no quiere la misma respuesta en los dos. Por
 * eso vive en el almacenamiento y no en `profiles`.
 *
 * NO HAY DETECCIÓN AUTOMÁTICA ACÁ, y por eso la nota siempre es la genérica: en
 * web se miran los núcleos y la memoria que informa el navegador, y en el
 * teléfono no hay de dónde leer eso. La regla de `nucleo/fondo.ts` es que no
 * saber NO es "flojo", así que en automático el motor se prende.
 *
 * EL CAMBIO SE VE AL VOLVER A ABRIR LA APP: el motor se monta una vez, al
 * arranque, y no se tumba a mitad de sesión. Apagarlo y quedarse mirando la
 * misma pantalla sin que pase nada sería confuso, y por eso se dice.
 */

const CLAVE = 'ascent:fondo';

export default function Fondo() {
  const [pref, setPref] = useState<PreferenciaFondo | null>(null);

  useEffect(() => {
    plataforma.almacenamiento
      .leer(CLAVE)
      .then((v) => setPref(esPreferenciaFondo(v) ? v : 'auto'))
      .catch(() => setPref('auto'));
  }, []);

  // LA CALIDAD (8/10): un punto medio entre "siempre" y "nunca". Por omisión la
  // decide la app midiendo; acá se la puede fijar a mano.
  const [calidad, setCalidad] = useState<PreferenciaDeCalidad | null>(null);
  useEffect(() => {
    const leer = () => setCalidad(preferenciaAhora());
    void leerCalidad().then(leer);
    return eventos.escuchar(CALIDAD_CAMBIO, leer);
  }, []);

  async function elegir(p: PreferenciaFondo) {
    setPref(p);
    await plataforma.almacenamiento.guardar(CLAVE, p);
    // Que se vea AL INSTANTE, sin reabrir: la raíz del fondo lo escucha y
    // re-aplica la preferencia (motor y capas del espacio).
    eventos.emitir(CAMBIO_FONDO, p);
  }

  return (
    <View style={estilos.seccion}>
      <Text style={estilos.titulo}>{T.ajustes.fondo}</Text>
      {/* SE DIBUJA SIEMPRE, aunque todavía no sepamos qué está elegido: si la
          sección apareciera al terminar de leer, empujaría lo de abajo y se
          tocaría el botón equivocado. Mientras no se sabe, ninguno queda
          marcado — mostrar "automático" y corregirlo un cuadro después es
          decir algo falso. */}
      <Segmentado<PreferenciaFondo | null>
        opciones={[
          { valor: 'auto', texto: T.ajustes.fondoAuto },
          { valor: 'siempre', texto: T.ajustes.fondoSiempre },
          { valor: 'nunca', texto: T.ajustes.fondoNunca },
        ]}
        valor={pref}
        alElegir={(v) => v && void elegir(v)}
      />

      <Text style={[estilos.titulo, { marginTop: 22 }]}>{T.ajustes.calidad}</Text>
      <Segmentado<PreferenciaDeCalidad | null>
        opciones={[
          { valor: 'auto', texto: T.ajustes.calidadAuto },
          { valor: 'alta', texto: T.ajustes.calidadAlta },
          { valor: 'baja', texto: T.ajustes.calidadBaja },
        ]}
        valor={calidad}
        alElegir={(v) => {
          if (!v) return;
          setCalidad(v);
          void fijarCalidad(v);
        }}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  seccion: { marginTop: 30 },
  titulo: { color: C.sub, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 },
  nota: { color: C.apagado, fontSize: 12, lineHeight: 17, marginTop: 8 },
});
