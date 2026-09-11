import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { supabase } from './supabase';
import { DIAS_SEMANA } from '@nucleo/fechas';
import { UMBRALES, umbralValido, type Umbral } from '@nucleo/estancamiento';
import type { Perfil, UnidadPeso } from '@nucleo/tipos';
import { T } from '@nucleo/textos';

/**
 * AJUSTES — lo que se puede cambiar, en la app nativa.
 *
 * SON TODAS PREFERENCIAS DEL DUEÑO y por eso comparten forma: se pinta el
 * cambio YA y se guarda de fondo. Esperar el viaje de red deja el botón medio
 * segundo sin responder, que se siente roto para algo que es un interruptor.
 * Si la base lo rechaza, vuelve solo y se dice — volver atrás en silencio es
 * peor que no volver, porque el interruptor se mueve solo y parece que la app
 * hace lo que quiere.
 *
 * LOS DÍAS DE DESCANSO no se escriben directo: van por `fijar_descansos`, que
 * los guarda CON FECHA. El cambio rige desde hoy hacia adelante y el pasado
 * queda con la configuración que estaba vigente entonces — cambiar de rutina
 * nunca puede hacer perder una racha ya ganada.
 *
 * LO QUE FALTA, Y ESTÁ EN LA TANDA 3: el punto del gimnasio. Necesita el GPS y
 * el diálogo de permisos, o sea el teléfono de verdad, y va junto con el resto
 * de lo que depende de los puertos. El sexo para el DOTS y el descanso entre
 * series llegan con sus pantallas.
 */
export default function Ajustes({
  perfil,
  alCambiar,
  alVolver,
  alSalir,
}: {
  perfil: Perfil;
  alCambiar: (parcial: Partial<Perfil>) => void;
  alVolver: () => void;
  alSalir: () => void;
}) {
  const [fallo, setFallo] = useState('');

  /** Pinta el cambio, guarda, y vuelve atrás si la base dice que no. */
  async function guardar(parcial: Partial<Perfil>, aviso: string) {
    const antes: Partial<Perfil> = {};
    for (const k of Object.keys(parcial) as (keyof Perfil)[]) {
      (antes as Record<string, unknown>)[k] = perfil[k];
    }
    setFallo('');
    alCambiar(parcial);
    const { error } = await supabase.from('profiles').update(parcial).eq('id', perfil.id);
    if (error) {
      alCambiar(antes);
      setFallo(aviso);
    }
  }

  async function alternarDia(dia: number) {
    const nuevos = perfil.dias_descanso.includes(dia)
      ? perfil.dias_descanso.filter((d) => d !== dia)
      : [...perfil.dias_descanso, dia];
    const antes = perfil.dias_descanso;
    setFallo('');
    alCambiar({ dias_descanso: nuevos });
    const { error } = await supabase.rpc('fijar_descansos', { p_dias: nuevos });
    if (error) {
      alCambiar({ dias_descanso: antes });
      setFallo(T.general.falloDescansos);
    }
  }

  const umbral = umbralValido(perfil.umbral_estancamiento);
  const avisos = perfil.avisos_estancamiento !== false;

  return (
    <ScrollView contentContainerStyle={estilos.pantalla}>
      <Pressable onPress={alVolver} style={estilos.volver}>
        <Text style={estilos.enlace}>{T.general.volver}</Text>
      </Pressable>

      <Text style={estilos.titulo}>{T.ajustes.titulo}</Text>

      <Text style={estilos.seccion}>{T.ajustes.diasDescanso}</Text>
      <View style={estilos.fila}>
        {DIAS_SEMANA.map((d, i) => (
          <Pressable
            key={i}
            onPress={() => alternarDia(i)}
            style={[estilos.pastilla, perfil.dias_descanso.includes(i) && estilos.prendida]}
          >
            <Text
              style={[
                estilos.textoPastilla,
                perfil.dias_descanso.includes(i) && estilos.textoPrendido,
              ]}
            >
              {d}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={estilos.nota}>{T.ajustes.diasDescansoNota}</Text>

      <Text style={estilos.seccion}>{T.ajustes.peso}</Text>
      <View style={estilos.fila}>
        {(['kg', 'lb'] as UnidadPeso[]).map((u) => (
          <Pressable
            key={u}
            onPress={() => guardar({ unidad_peso: u }, T.general.falloPreferencia)}
            style={[estilos.ancha, (perfil.unidad_peso ?? 'kg') === u && estilos.prendida]}
          >
            <Text
              style={[
                estilos.textoPastilla,
                (perfil.unidad_peso ?? 'kg') === u && estilos.textoPrendido,
              ]}
            >
              {u === 'kg' ? T.ajustes.kilos : T.ajustes.libras}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={estilos.seccion}>{T.ajustes.estancamiento}</Text>
      <View style={estilos.fila}>
        {[true, false].map((v) => (
          <Pressable
            key={String(v)}
            onPress={() => guardar({ avisos_estancamiento: v }, T.general.falloPreferencia)}
            style={[estilos.ancha, avisos === v && estilos.prendida]}
          >
            <Text style={[estilos.textoPastilla, avisos === v && estilos.textoPrendido]}>
              {v ? T.ajustes.estancamientoSi : T.ajustes.estancamientoNo}
            </Text>
          </Pressable>
        ))}
      </View>
      {avisos && (
        <>
          <View style={[estilos.fila, { marginTop: 10 }]}>
            {UMBRALES.map((u: Umbral) => (
              <Pressable
                key={u}
                onPress={() => guardar({ umbral_estancamiento: u }, T.general.falloPreferencia)}
                style={[estilos.ancha, u === umbral && estilos.prendida]}
              >
                <Text style={[estilos.textoPastilla, u === umbral && estilos.textoPrendido]}>
                  {T.ajustes.semanas(u)}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={estilos.nota}>{T.ajustes.estancamientoNota(umbral)}</Text>
        </>
      )}

      {fallo !== '' && <Text style={estilos.error}>{fallo}</Text>}

      <Pressable
        style={estilos.salir}
        onPress={async () => {
          await supabase.auth.signOut();
          alSalir();
        }}
      >
        <Text style={estilos.enlace}>{T.ajustes.cerrarSesion}</Text>
      </Pressable>
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flexGrow: 1, backgroundColor: '#05060a', padding: 24, paddingTop: 60 },
  volver: { marginBottom: 18 },
  titulo: {
    color: '#8a93a8',
    fontSize: 11,
    letterSpacing: 4,
    textTransform: 'uppercase',
    marginBottom: 26,
  },
  seccion: {
    color: '#8a93a8',
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: 26,
    marginBottom: 10,
  },
  fila: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  pastilla: {
    width: 40,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#2a3040',
    alignItems: 'center',
  },
  ancha: {
    flex: 1,
    minWidth: 84,
    paddingVertical: 11,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#2a3040',
    alignItems: 'center',
  },
  prendida: { borderColor: '#7e8ca8' },
  textoPastilla: { color: '#8a93a8', fontSize: 13 },
  textoPrendido: { color: '#c4c2ba' },
  nota: { color: '#4a5163', fontSize: 12, marginTop: 8, lineHeight: 18 },
  error: { color: '#e8705f', fontSize: 13, marginTop: 18, lineHeight: 19 },
  enlace: { color: '#8a93a8', fontSize: 13 },
  salir: { marginTop: 48, alignItems: 'center' },
});
