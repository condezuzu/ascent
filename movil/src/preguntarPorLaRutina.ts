import { Alert } from 'react-native';
import { T } from '@nucleo/textos';
import { diaDeLaSesion, hayQuePreguntarPorLaRutina } from '@nucleo/rutina';
import { nombreNuevo } from '@nucleo/rutinas';
import { cargarMisRutinas, guardarRutina, rutinaActivaDelTelefono } from '@compartido/rutinas';
import { supabase } from './supabase';

type BloqueGuardado = { ejercicio?: string | null; series?: number | null; minutos?: number | null };

/**
 * AL TERMINAR, SI SE HIZO OTRO DÍA QUE EL DE LA RUTINA GUARDADA (16/10, a pedido): una
 * alerta del sistema, como la de batería baja, con dos salidas. Cambiar el día de la
 * rutina activa, o crear una rutina nueva —copia de la activa— con este día puesto, sin
 * tocar la que estaba. Sin rutina guardada, o con los mismos ejercicios, no sale nada.
 */
export async function preguntarPorLaRutina(bloques: BloqueGuardado[]) {
  const dia = new Date().getDay();
  const hecho = diaDeLaSesion(bloques);
  // La copia del teléfono: anda sin señal, que es como suele terminar un entrenamiento.
  const activa = await rutinaActivaDelTelefono();
  if (!activa || !hayQuePreguntarPorLaRutina(activa.dias[dia], hecho)) return;

  async function guardar(como: 'esta' | 'nueva') {
    const rutinas = await cargarMisRutinas(supabase);
    const actual = rutinas?.find((r) => r.activa);
    if (!rutinas || !actual) return Alert.alert(T.general.noSePudo);
    const dias = actual.dias.map((d, i) => (i === dia ? hecho : d));
    const id =
      como === 'esta'
        ? await guardarRutina(supabase, { id: actual.id, nombre: actual.nombre, dias, activa: true })
        : await guardarRutina(supabase, { id: null, nombre: nombreNuevo(rutinas.map((r) => r.nombre), T.rutina.nombreBase), dias });
    if (!id) Alert.alert(T.general.noSePudo);
  }

  Alert.alert(
    T.rutina.cambiarDiaTitulo,
    T.rutina.cambiarDiaTexto,
    [
      { text: T.rutina.cambiarEsteDia, onPress: () => void guardar('esta') },
      { text: T.rutina.crearConEsteDia, onPress: () => void guardar('nueva') },
    ],
    { cancelable: true }
  );
}
