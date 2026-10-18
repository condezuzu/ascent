import { StyleSheet, View } from 'react-native';

export type EstadoDelDia = 'lleno' | 'vacio' | 'descanso' | 'futuro' | 'cubierto' | 'sinDato';

/**
 * EL CÍRCULO DE UN DÍA DE LA TIRA. Vive aparte desde el 18/10 porque lo dibujan dos: la
 * semana de Inicio y el aviso de la vida, que apunta al día que faltaste en la misma tira.
 * `sinDato` es un día que la pantalla no trae (más viejo que la semana cargada): se ve
 * como uno que no pasó, para no inventarle un estado.
 */
export default function PuntoDelDia({ estado, esHoy }: { estado: EstadoDelDia; esHoy: boolean }) {
  return (
    <View
      style={[
        estilos.punto,
        estado === 'lleno' && estilos.lleno,
        estado === 'vacio' && estilos.vacio,
        (estado === 'futuro' || estado === 'sinDato') && estilos.futuro,
        (estado === 'descanso' || estado === 'cubierto') && estilos.vacio,
        esHoy && estilos.puntoHoy,
      ]}
    >
      {/* El descanso es un guioncito y el cubierto un punto adentro: ninguno de los dos
          puede parecer un día perdido, y el cubierto tampoco puede parecer entrenado. */}
      {estado === 'descanso' && <View style={estilos.guion} />}
      {estado === 'cubierto' && <View style={estilos.cubierto} />}
    </View>
  );
}

const estilos = StyleSheet.create({
  punto: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  lleno: { backgroundColor: '#7e8ca8' },
  vacio: { borderWidth: 1, borderColor: '#2a3040' },
  futuro: { borderWidth: 1, borderColor: '#171c26' },
  puntoHoy: { borderWidth: 1, borderColor: '#c4c2ba' },
  guion: { width: 10, height: 2, borderRadius: 1, backgroundColor: '#4a5163' },
  cubierto: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#6b7488' },
});
