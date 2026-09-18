import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { supabase } from './supabase';
import type { Senal } from '@nucleo/estancamiento';
import type { Ejercicio } from '@nucleo/tipos';
import { T } from '@nucleo/textos';
import { cargarEstancamiento, descartarSenal } from '@compartido/estancamiento';
import { C, conAlfa } from './colores';

/**
 * EL AVISO DE ESTANCAMIENTO, en la app nativa. Uno, o ninguno. El mismo que
 * la web (`src/components/Estancamiento.tsx`), con lo que se pide y lo ya visto
 * en `compartido/estancamiento.ts`.
 *
 * DÓNDE VIVE: en Stats, nunca en Inicio ni durante una sesión ni el día que se
 * registra. Quien abrió Stats pidió que lo evalúen. CÓMO SE DICE: describe, no
 * juzga y no receta; y para la sesión que se achica no hay frase, dos filas de
 * números y la conclusión la saca quien mira. LA RACHA NO SE NOMBRA NUNCA ACÁ.
 *
 * LO QUE NO ESTÁ: en la web la frase termina en "anotar una", que lleva a la
 * pantalla de marcas. Esa pantalla no está portada: el enlace no se muestra
 * hasta que exista, en vez de llevar a ningún lado.
 */
export default function Estancamiento({
  registradoHoy,
  paleta,
}: {
  registradoHoy: boolean;
  paleta: { principal: string; claro: string };
}) {
  const [senal, setSenal] = useState<Senal | null>(null);
  const [ejercicios, setEjercicios] = useState<Ejercicio[]>([]);
  const [silenciadas, setSilenciadas] = useState<Record<string, string>>({});

  useEffect(() => {
    let vivo = true;
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const uid = session?.user?.id;
      if (!uid) return;
      const datos = await cargarEstancamiento(supabase, uid);
      if (!vivo || !datos) return;
      setEjercicios(datos.ejercicios);
      setSilenciadas(datos.silenciadas);
      setSenal(datos.senal);
    })();
    return () => {
      vivo = false;
    };
  }, []);

  // Nunca el día que se registra: en Stats no hay sesión corriendo, pero sí se
  // puede entrar diez minutos después de haber entrenado.
  if (!senal || registradoHoy) return null;

  async function descartar() {
    if (!senal) return;
    setSenal(null);
    setSilenciadas(await descartarSenal(silenciadas, senal));
  }

  const nombre = (id: string) => ejercicios.find((e) => e.id === id)?.nombre ?? id;

  return (
    <View style={[estilos.aviso, { borderColor: conAlfa(paleta.principal, 0.45) }]}>
      {senal.tipo === 'sesion_mas_corta' ? (
        <View>
          <View style={estilos.fila}>
            <Text style={estilos.cuando}>{T.estancamiento.ultimas4}</Text>
            <Text style={[estilos.dato, { color: paleta.claro }]}>{T.estancamiento.dias(senal.ahora.dias)}</Text>
            <Text style={[estilos.dato, { color: paleta.claro }]}>{T.estancamiento.minutos(senal.ahora.minutos)}</Text>
          </View>
          <View style={estilos.fila}>
            <Text style={estilos.cuando}>{T.estancamiento.anteriores4}</Text>
            <Text style={estilos.dato}>{T.estancamiento.dias(senal.antes.dias)}</Text>
            <Text style={estilos.dato}>{T.estancamiento.minutos(senal.antes.minutos)}</Text>
          </View>
        </View>
      ) : (
        <Text style={estilos.texto}>
          {senal.tipo === 'marca_quieta'
            ? T.estancamiento.marcaQuieta(nombre(senal.ejercicio), senal.semanas)
            : T.estancamiento.ejercicioDejado(nombre(senal.ejercicio), senal.semanas)}
        </Text>
      )}
      <Pressable onPress={descartar} hitSlop={8}>
        <Text style={estilos.descartar}>{T.estancamiento.descartar}</Text>
      </Pressable>
    </View>
  );
}

const estilos = StyleSheet.create({
  // El aire de abajo es el de una `.seccion` de la web: sin él, "No mostrar
  // esto" quedaba pegado a VIDAS (visto el 18/9, con un aviso fabricado).
  aviso: { borderLeftWidth: 2, paddingLeft: 14, marginTop: 24, marginBottom: 26 },
  texto: { color: C.sub, fontSize: 14, lineHeight: 22 },
  // Cifras tabulares para que las dos columnas caigan en la misma vertical:
  // si no se alinean, no se comparan.
  fila: { flexDirection: 'row', alignItems: 'baseline', gap: 12, paddingVertical: 5 },
  cuando: { flex: 1, color: C.apagado, fontSize: 13 },
  dato: { color: C.sub, fontSize: 14, minWidth: 62, textAlign: 'right', fontVariant: ['tabular-nums'] },
  descartar: { color: C.apagado, fontSize: 12, paddingTop: 8 },
});
