import { Alert } from 'react-native';
import { T } from '@nucleo/textos';
import { conDiaReemplazado, diaDeLaSesion, hayQuePreguntarPorLaRutina } from '@nucleo/rutina';
import { nombreNuevo } from '@nucleo/rutinas';
import { cargarMisRutinas, guardarRutina, rutinaActivaDelTelefono } from '@compartido/rutinas';
import { supabase } from './supabase';

type BloqueGuardado = { ejercicio?: string | null; series?: number | null; minutos?: number | null };

/**
 * AL TERMINAR, SI SE HIZO OTRO DÍA QUE EL DE LA RUTINA GUARDADA (16/10, a pedido): una
 * alerta del sistema, como la de batería baja. Reemplazar el día de la rutina que se está
 * usando —con un "¿Estás seguro?", porque pisa lo que había— o crear una rutina nueva
 * —copia de la activa con este día puesto, sin tocar la que estaba—, que se crea directo.
 * Sin rutina guardada, sin señal, o con los mismos ejercicios, no sale nada.
 */
export async function preguntarPorLaRutina(bloques: BloqueGuardado[]) {
  const dia = new Date().getDay();
  const hecho = diaDeLaSesion(bloques);
  // Primero la copia del teléfono, que no gasta red: casi siempre no hay nada que preguntar.
  const activa = await rutinaActivaDelTelefono();
  if (!activa || !hayQuePreguntarPorLaRutina(activa.dias[dia], hecho)) return;
  // El nombre va en la pregunta, y guardar pide señal: sin ella no se pregunta.
  const rutinas = await cargarMisRutinas(supabase);
  const actual = rutinas?.find((r) => r.activa);
  if (!rutinas || !actual || !hayQuePreguntarPorLaRutina(actual.dias[dia], hecho)) return;

  async function guardar(como: 'esta' | 'nueva') {
    if (!rutinas || !actual) return;
    const dias = conDiaReemplazado(actual.dias, dia, hecho);
    const id =
      como === 'esta'
        ? await guardarRutina(supabase, { id: actual.id, nombre: actual.nombre, dias, activa: true })
        : await guardarRutina(supabase, { id: null, nombre: nombreNuevo(rutinas.map((r) => r.nombre), T.rutina.nombreBase), dias });
    if (!id) Alert.alert(T.general.noSePudo);
  }

  Alert.alert(
    T.rutina.reemplazarDiaTitulo(actual.nombre),
    T.rutina.cambiarDiaTexto,
    [
      {
        text: T.rutina.reemplazar,
        onPress: () =>
          Alert.alert(T.rutina.estasSeguro, undefined, [
            { text: T.rutina.no, style: 'cancel' },
            { text: T.rutina.si, style: 'destructive', onPress: () => void guardar('esta') },
          ]),
      },
      { text: T.rutina.crearRutinaNueva, onPress: () => void guardar('nueva') },
    ],
    { cancelable: true }
  );
}
