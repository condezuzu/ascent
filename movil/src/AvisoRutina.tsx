import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { plataforma } from '@plataforma';
import { leerPasoDelRecorrido } from '@compartido/guia';
import { miId } from '@compartido/quienSoy';
import { versionDelEsquema } from '@compartido/esquema';
import { disponible } from '@nucleo/esquema';
import { CLAVE_AVISO_RUTINA, conEsteVisto, quienesLoVieron, tocaAvisarDeLaRutina } from '@nucleo/avisoRutina';
import { T } from '@nucleo/textos';
import { supabase } from './supabase';
import { irAPestana } from './irAPestana';
import { C, conAlfa } from './colores';

/**
 * "TUS AMIGOS AHORA VEN TU RUTINA", una sola vez. Ver `nucleo/avisoRutina.ts`.
 *
 * Va encima de la barra, donde va el recorrido, y por eso espera a que el
 * recorrido no esté. Los dos botones lo dan por visto: es un aviso, no una
 * pregunta que haya que contestar bien.
 */
export default function AvisoRutina() {
  const [uid, setUid] = useState('');

  const mirar = useCallback(async () => {
    const yo = await miId(supabase);
    if (!yo) return;
    // Lo barato primero: si ya lo vio, no se le pregunta nada a la base.
    const vistoPor = quienesLoVieron(await plataforma.almacenamiento.leer(CLAVE_AVISO_RUTINA).catch(() => null));
    if (vistoPor.includes(yo)) return;
    if (!disponible('rutinaDeAmigo', await versionDelEsquema(supabase).catch(() => null))) return;
    const { data, error } = await supabase.from('profiles').select('comparte_rutina').eq('id', yo).maybeSingle();
    const comparte = error || !data ? null : (data as { comparte_rutina: boolean }).comparte_rutina === true;
    const recorridoAndando = (await leerPasoDelRecorrido(yo)) !== null;
    setUid(tocaAvisarDeLaRutina({ uid: yo, vistoPor, recorridoAndando, comparte }) ? yo : '');
  }, []);

  // Al abrir y cada vez que la app vuelve adelante: el que saltó el recorrido
  // lo ve la próxima vez que mira el teléfono, no recién al reiniciar.
  useEffect(() => {
    void mirar();
    return plataforma.ciclo.alCambiar((visible) => {
      if (visible) void mirar();
    });
  }, [mirar]);

  if (!uid) return null;

  async function visto(irAAjustes: boolean) {
    const yo = uid;
    setUid('');
    if (irAAjustes) irAPestana('ajustes');
    const crudo = await plataforma.almacenamiento.leer(CLAVE_AVISO_RUTINA).catch(() => null);
    await plataforma.almacenamiento.guardar(CLAVE_AVISO_RUTINA, conEsteVisto(crudo, yo)).catch(() => undefined);
  }

  return (
    <View testID="aviso-rutina" style={estilos.tarjeta} accessibilityRole="alert">
      <Text style={estilos.texto}>{T.social.avisoRutina}</Text>
      <View style={estilos.botones}>
        <Pressable testID="aviso-rutina-entendido" style={estilos.borde} onPress={() => void visto(false)} hitSlop={10}>
          <Text style={estilos.bordeTexto}>{T.social.avisoRutinaEntendido}</Text>
        </Pressable>
        <Pressable testID="aviso-rutina-ajustes" style={estilos.solido} onPress={() => void visto(true)}>
          <Text style={estilos.solidoTexto}>{T.social.avisoRutinaAjustes}</Text>
        </Pressable>
      </View>
    </View>
  );
}

// La misma tarjeta que el recorrido: es el mismo lugar y la misma voz.
const estilos = StyleSheet.create({
  tarjeta: {
    marginHorizontal: 12,
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.lineaFuerte,
    backgroundColor: conAlfa(C.hoja, 0.96),
  },
  texto: { color: C.tinta, fontSize: 15, lineHeight: 21 },
  botones: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
  borde: { borderWidth: StyleSheet.hairlineWidth, borderColor: C.lineaFuerte, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 18 },
  bordeTexto: { color: C.tinta, fontSize: 14 },
  solido: { backgroundColor: C.tinta, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 18 },
  solidoTexto: { color: C.fondo, fontSize: 14, fontWeight: '600' },
});
