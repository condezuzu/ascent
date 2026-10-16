import { useCallback, useEffect, useState, memo } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
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
 * TU RUTINA, EN INICIO (15/10). Un renglón —"HOY  Pecho, hombro y brazo"— que
 * abre la rutina entera. Estaba al fondo de Stats y no la encontraba nadie; acá
 * está donde se mira antes de salir para el gimnasio. No sale mientras se
 * entrena: ahí la rutina ya está proponiendo el ejercicio siguiente.
 */
function FilaRutina() {
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
  const texto = !hayAlgo(dias) ? T.rutina.armarSemana : hoy?.descanso ? T.rutina.descanso : titulo || T.rutina.sinCargar;

  // UNA LÍNEA SIN CAJA (15/10, la A de tres): la caja le competía al botón de empezar.
  return (
    <Pressable
      testID="inicio-rutina"
      style={({ pressed }) => [estilos.fila, pressed && estilos.tocada]}
      onPress={() => router.push('/rutina')}
      accessibilityRole="button"
      accessibilityLabel={`${T.rutina.titulo}: ${texto}`}
    >
      <Text style={estilos.rotulo}>{T.rutina.hoyRotulo}</Text>
      <Text style={estilos.texto} numberOfLines={1}>
        {texto}
      </Text>
      <Text style={estilos.flecha}>›</Text>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, marginTop: 6 },
  tocada: { opacity: 0.6 },
  rotulo: { color: C.sub, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase' },
  texto: { flex: 1, color: C.tinta, fontSize: 15 },
  flecha: { color: C.sub, fontSize: 22 },
});

// Con los mismos props no se redibuja: el + de la sesión redibuja Inicio y esto no cambió (15/10).
export default memo(FilaRutina);
