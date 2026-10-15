import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { hayAlgo, tituloDelDia, type DiaDeSemana } from '@nucleo/rutinas';
import { T } from '@nucleo/textos';
import { eventos, EJERCICIOS_CAMBIO, RUTINA_CAMBIO } from '@compartido/eventos';
import { miId } from '@compartido/quienSoy';
import { cargarRutinaParaVer, catalogoDeRutina, type CatalogoDeRutina } from '@compartido/rutinas';
import { useRecargarAlVolver } from './irAPestana';
import { supabase } from './supabase';
import { C } from './colores';

/**
 * TU RUTINA, EN INICIO (15/10). Un renglón —"Hoy: pecho, hombro y brazo"— que
 * abre la rutina entera. Estaba al fondo de Stats y no la encontraba nadie; acá
 * está donde se mira antes de salir para el gimnasio. No sale mientras se
 * entrena: ahí la rutina ya está proponiendo el ejercicio siguiente.
 */
export default function FilaRutina() {
  const router = useRouter();
  const [dias, setDias] = useState<DiaDeSemana[] | null>(null);
  const [catalogo, setCatalogo] = useState<CatalogoDeRutina>(new Map());

  const cargar = useCallback(async () => {
    const yo = await miId(supabase);
    if (!yo) return;
    const [vista, cat] = await Promise.all([cargarRutinaParaVer(supabase, yo, true), catalogoDeRutina(supabase)]);
    if (vista) setDias(vista.dias);
    setCatalogo(cat);
  }, []);

  useEffect(() => {
    void cargar();
    const a = eventos.escuchar(RUTINA_CAMBIO, () => void cargar());
    const b = eventos.escuchar(EJERCICIOS_CAMBIO, () => void cargar());
    return () => {
      a();
      b();
    };
  }, [cargar]);
  useRecargarAlVolver('inicio', cargar);

  if (!dias) return null;
  const hoy = dias[new Date().getDay()];
  const titulo = hoy ? tituloDelDia(hoy, (id) => catalogo.get(id)?.grupo ?? null, T.rutina.descanso) : '';
  const texto = !hayAlgo(dias) ? T.rutina.armarSemana : T.rutina.hoy(titulo || T.rutina.sinCargar);

  return (
    <Pressable
      testID="inicio-rutina"
      style={({ pressed }) => [estilos.fila, pressed && estilos.tocada]}
      onPress={() => router.push('/rutina')}
      accessibilityRole="button"
    >
      <View style={estilos.textos}>
        <Text style={estilos.rotulo}>{T.rutina.titulo}</Text>
        <Text style={estilos.hoy} numberOfLines={1}>
          {texto}
        </Text>
      </View>
      <Text style={estilos.flecha}>›</Text>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.lineaFuerte,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 14,
  },
  tocada: { borderColor: C.sub },
  textos: { flex: 1, gap: 3 },
  rotulo: { color: C.sub, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase' },
  hoy: { color: C.tinta, fontSize: 15 },
  flecha: { color: C.sub, fontSize: 22, marginLeft: 12 },
});
