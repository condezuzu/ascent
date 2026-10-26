import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useEnVuelo } from '@compartido/useEnVuelo';
import { T } from '@nucleo/textos';
import { estaVinculada } from '@nucleo/vinculoConMoss';
import { supabase } from '../supabase';
import { useRecargarAlVolver } from '../irAPestana';
import HojaDeMoss from './HojaDeMoss';
import { C } from '../colores';

/**
 * MOSS EN AJUSTES › PERFIL (D27 de la spec de Moss, «Vincular en menos de 10 segundos»).
 *
 * VINCULAR ES DAR PERMISO, no unir cuentas: cada app lee lo de la otra, y Apple pide ese
 * consentimiento para los datos de salud. Desde acá son dos toques: «Vincular con Moss» abre la
 * hoja (`HojaDeMoss`) y su «Vincular» es el segundo. Vinculada, la fila lo dice y ofrece
 * desvincular, que borra el vínculo de las dos apps y deja los datos en cada una.
 *
 * SIN EL ESQUEMA `moss` EXPUESTO (o sin red la primera vez) el estado no se puede preguntar y la
 * fila queda en «sin vincular»: no rompe nada, y vincular lo contesta el servidor igual.
 */
export default function Moss() {
  // `null` mientras se pregunta: sin eso la fila salta de «Vincular» a «Vinculada».
  const [vinculada, setVinculada] = useState<boolean | null>(null);
  const [abierta, setAbierta] = useState(false);
  const [aviso, setAviso] = useState('');

  const mirarVinculo = useCallback(async () => {
    try {
      const { data, error } = await supabase.schema('moss').rpc('estado_del_vinculo');
      // Una pregunta que falla no tapa lo que ya se sabía.
      setVinculada((antes) => (error ? (antes ?? false) : estaVinculada(data)));
    } catch {
      setVinculada((antes) => antes ?? false);
    }
  }, []);

  useEffect(() => {
    void mirarVinculo();
  }, [mirarVinculo]);
  // Se pudo vincular o desvincular desde Moss mientras Ascent estaba atrás.
  useRecargarAlVolver('ajustes', mirarVinculo);

  const desvincular = useEnVuelo(async () => {
    setAviso('');
    try {
      const { error } = await supabase.schema('moss').rpc('desvincular');
      if (error) return setAviso(T.moss.sigueVinculada);
      setVinculada(false);
    } catch {
      setAviso(T.moss.sigueVinculada);
    }
  });

  return (
    <View style={estilos.seccion}>
      <Text style={estilos.titulo}>{T.moss.titulo}</Text>

      {vinculada !== null && (
        <View style={estilos.tarjeta}>
          {vinculada ? (
            <>
              <View style={estilos.fila}>
                <Text style={estilos.estado}>{T.moss.vinculada}</Text>
              </View>
              <Pressable style={[estilos.fila, estilos.conLinea]} onPress={() => desvincular()} accessibilityRole="button" testID="moss-desvincular">
                <Text style={estilos.enlace}>{T.moss.desvincular}</Text>
                <Text style={estilos.flecha}>›</Text>
              </Pressable>
            </>
          ) : (
            <Pressable
              style={estilos.fila}
              onPress={() => {
                setAviso('');
                setAbierta(true);
              }}
              accessibilityRole="button"
              testID="moss-vincular"
            >
              <Text style={estilos.enlace}>{T.moss.vincularConMoss}</Text>
              <Text style={estilos.flecha}>›</Text>
            </Pressable>
          )}
        </View>
      )}
      {aviso !== '' && <Text style={estilos.error}>{aviso}</Text>}

      <HojaDeMoss
        visible={abierta}
        alCerrar={() => setAbierta(false)}
        alVincular={() => {
          setVinculada(true);
          setAbierta(false);
        }}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  seccion: { marginTop: 30 },
  // El mismo rótulo que Salud, justo arriba.
  titulo: { color: C.sub, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 },
  // La tarjeta con filas de Cuenta.
  tarjeta: { borderWidth: StyleSheet.hairlineWidth, borderColor: C.lineaFuerte, borderRadius: 14, overflow: 'hidden' },
  fila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 16 },
  conLinea: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.linea },
  estado: { color: C.tinta, fontSize: 15 },
  enlace: { color: C.sub, fontSize: 15 },
  flecha: { color: C.apagado, fontSize: 18 },
  error: { color: C.error, fontSize: 13, marginTop: 10, lineHeight: 19 },
});
