import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { hoyISO, deISO, MESES } from '@nucleo/fechas';
import { aKilos, deKilos, type Unidad } from '@nucleo/peso';
import { redondear, unRM } from '@nucleo/fuerza';
import type { Ejercicio } from '@nucleo/tipos';
import { T } from '@nucleo/textos';
import { supabase } from './supabase';
import Hoja from './Hoja';
import SelectorEjercicio from './SelectorEjercicio';
import CampoPeso from './CampoPeso';
import { C } from './colores';

/**
 * ANOTAR UNA MARCA (§16.4), la hoja del teléfono.
 *
 * SE GUARDA LO QUE LEVANTASTE, NO EL 1RM. El máximo de una repetición lo
 * deriva la base a partir del peso y las veces; guardarlo ya calculado sería
 * guardar una opinión en vez de un hecho, y el día que cambie la fórmula
 * —Epley, Brzycki, la que sea— los datos viejos quedarían con la vieja para
 * siempre, mezclados con los nuevos y sin forma de distinguirlos.
 *
 * LAS DOS FORMAS DE CARGAR SON UN SELECTOR, no un campo de veces más una
 * casilla de "es real". Un 1RM de verdad ES una repetición: con las dos cosas
 * sueltas, el mismo dato se pediría dos veces y podrían contradecirse —"de
 * una" tildado y 5 veces escrito—, y ahí no hay respuesta correcta.
 *
 * EL EJERCICIO SE ELIGE CON EL MISMO SELECTOR QUE EL CONTADOR DE SERIES. Es la
 * misma pregunta hecha en dos pantallas, y no puede verse distinta en cada
 * una.
 */
export default function CargarMarca({
  visible,
  ejercicios,
  unidad,
  inicial,
  alCerrar,
  alGuardar,
}: {
  visible: boolean;
  ejercicios: Ejercicio[];
  unidad: Unidad;
  /** Si se abrió desde una marca concreta, viene ya elegida. */
  inicial?: string;
  alCerrar: () => void;
  alGuardar: () => void;
}) {
  const [ejercicio, setEjercicio] = useState(inicial ?? ejercicios[0]?.id ?? '');
  const [unaVez, setUnaVez] = useState(true);
  const [kg, setKg] = useState<number | null>(null);
  const [reps, setReps] = useState('5');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [eligiendo, setEligiendo] = useState(false);

  const elegido = ejercicios.find((e) => e.id === ejercicio) ?? null;
  const veces = unaVez ? 1 : Number(reps);

  async function guardar() {
    setError('');
    if (kg === null || kg <= 0) return setError(T.peso.noDa);
    if (!Number.isInteger(veces) || veces < 1 || veces > 20) return setError(T.marca.vecesFuera);

    setGuardando(true);
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      setGuardando(false);
      return setError(T.marca.sesionCerrada);
    }
    // A LA BASE VA SIEMPRE EN KILOS. La unidad es solo cómo se escribe y se
    // lee, igual que el peso corporal: si se guardara en libras, comparar dos
    // cuentas con unidades distintas sería comparar números de cosas
    // distintas, y el ranking de fuerza no tendría sentido.
    const { error: err } = await supabase.from('prs').insert({
      user_id: data.user.id,
      ejercicio,
      peso: Math.round(kg * 100) / 100,
      reps: veces,
      es_real: unaVez,
      // La fecha es hoy y no se elige: en la web hay un campo, pero un
      // selector de fecha en el teléfono es una pantalla entera para el caso
      // raro. Se anota cuando se anota, y corregirla es borrar y cargar.
      fecha: hoyISO(),
    });
    setGuardando(false);
    if (err) return setError(T.general.noSePudo);
    alGuardar();
  }

  const hoy = deISO(hoyISO());

  return (
    <>
      <Hoja visible={visible} alCerrar={guardando ? () => {} : alCerrar}>
        <Text style={estilos.titulo}>{T.marca.titulo}</Text>
        <Text style={estilos.sub}>{T.marca.sub}</Text>

        <Text style={estilos.etiqueta}>{T.marca.ejercicio}</Text>
        <Pressable style={estilos.selector} onPress={() => setEligiendo(true)}>
          <Text style={estilos.selectorTexto}>
            {elegido ? `${elegido.nombre} · ${elegido.grupo}` : ''}
          </Text>
        </Pressable>

        <Text style={estilos.etiqueta}>{T.marca.cuantasVeces}</Text>
        <View style={estilos.pastillas}>
          {[true, false].map((una) => (
            <Pressable
              key={String(una)}
              style={[estilos.pastilla, unaVez === una && estilos.prendida]}
              onPress={() => setUnaVez(una)}
            >
              <Text style={[estilos.pastillaTexto, unaVez === una && estilos.prendidaTexto]}>
                {una ? T.marca.deUna : T.marca.variasVeces}
              </Text>
            </Pressable>
          ))}
        </View>

        <CampoPeso kg={kg} unidad={unidad} alCambiar={setKg} etiqueta={T.marca.peso} />

        {!unaVez && (
          <>
            <Text style={estilos.etiqueta}>{T.marca.veces}</Text>
            <TextInput
              style={estilos.campo}
              value={reps}
              onChangeText={(t) => setReps(t.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              maxLength={2}
              placeholderTextColor={C.apagado}
            />
          </>
        )}

        {/* EL MÁXIMO CALCULADO SE DICE EN VOZ BAJA: es un derivado, no el
            dato. Puesto en grande competiría con el peso que la persona
            levantó de verdad, que es lo único que acá es un hecho. */}
        <Text style={estilos.nota}>
          {unaVez
            ? T.marca.sacamosDeUna + T.marca.unaVezNoSaca
            : kg !== null && veces >= 1 && veces <= 20
              ? T.marca.comoMaximo(redondear(deKilos(unRM(kg, veces, unaVez), unidad)), unidad) +
                (veces >= 12 ? T.marca.muchasFloja : '')
              : T.marca.sacamosDeUna}
        </Text>

        <Text style={estilos.nota}>
          {T.marca.cuando}: {T.marca.fechaLarga(hoy.getDate(), MESES[hoy.getMonth()], hoy.getFullYear())}
        </Text>

        {error !== '' && <Text style={estilos.error}>{error}</Text>}

        <Pressable style={estilos.solido} onPress={guardar} disabled={guardando}>
          <Text style={estilos.solidoTexto}>{guardando ? T.sesion.guardando : T.marca.anotar}</Text>
        </Pressable>
        <Pressable style={estilos.texto} onPress={alCerrar} disabled={guardando}>
          <Text style={estilos.enlace}>{T.general.cancelar}</Text>
        </Pressable>
      </Hoja>

      <SelectorEjercicio
        visible={eligiendo}
        ejercicios={ejercicios}
        valor={ejercicio}
        alElegir={(id) => {
          if (id) setEjercicio(id);
          setEligiendo(false);
        }}
        alCerrar={() => setEligiendo(false)}
      />
    </>
  );
}

const estilos = StyleSheet.create({
  titulo: { color: C.tinta, fontSize: 19, marginBottom: 4 },
  sub: { color: C.sub, fontSize: 13, lineHeight: 18, marginBottom: 18 },
  etiqueta: { color: C.sub, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', marginTop: 16, marginBottom: 8 },
  selector: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.lineaFuerte,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  selectorTexto: { color: C.tinta, fontSize: 15 },
  pastillas: { flexDirection: 'row', gap: 8 },
  pastilla: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.lineaFuerte,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  prendida: { backgroundColor: C.tinta, borderColor: C.tinta },
  pastillaTexto: { color: C.tinta, fontSize: 14 },
  prendidaTexto: { color: C.fondo, fontWeight: '600' },
  campo: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.lineaFuerte,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: C.tinta,
    fontSize: 16,
  },
  nota: { color: C.apagado, fontSize: 12, lineHeight: 17, marginTop: 12 },
  error: { color: C.error, fontSize: 13, marginTop: 12 },
  solido: { backgroundColor: C.tinta, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  solidoTexto: { color: C.fondo, fontSize: 15, fontWeight: '600' },
  texto: { paddingVertical: 12, alignItems: 'center' },
  enlace: { color: C.sub, fontSize: 14 },
});
