import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';

/**
 * LA MEDALLA DE LA RACHA MÁS LARGA (item 5): SATURNO, el planeta de anillos.
 *
 * Va AL LADO DEL NOMBRE, como una medalla más (junto a las de fuerza), no como
 * una tarjeta aparte. El dibujo es solo el ícono; el texto —"Tu racha más larga
 * fue de N días"— lo dice el globo de `Medallas` al tocarla, igual que las otras.
 *
 * El anillo cruza POR DETRÁS y por DELANTE del cuerpo (arco de atrás, planeta,
 * arco de adelante): sin eso es un aro al lado de una bola, no un planeta.
 */
export default function MedallaSaturno({ tam = 24 }: { tam?: number }) {
  return (
    <Svg width={tam} height={tam} viewBox="0 0 100 100">
      <Defs>
        <RadialGradient id="cuerpoSat" cx="40%" cy="35%" r="75%">
          <Stop offset="0%" stopColor="#e8cf9a" />
          <Stop offset="55%" stopColor="#c9a86a" />
          <Stop offset="100%" stopColor="#7a5c34" />
        </RadialGradient>
        <LinearGradient id="anilloSat" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0%" stopColor="#d8c08a" stopOpacity="0.15" />
          <Stop offset="50%" stopColor="#f0dcae" stopOpacity="0.95" />
          <Stop offset="100%" stopColor="#d8c08a" stopOpacity="0.15" />
        </LinearGradient>
      </Defs>
      <G transform="rotate(-20 50 50)">
        {/* El anillo entero, detrás del cuerpo. */}
        <Ellipse cx="50" cy="50" rx="46" ry="15" fill="none" stroke="url(#anilloSat)" strokeWidth="6" />
        {/* El cuerpo, encima del arco de atrás. */}
        <Circle cx="50" cy="50" r="27" fill="url(#cuerpoSat)" />
        {/* Dos bandas tenues, para que no sea una bola lisa. */}
        <Path d="M25 46 Q50 40 75 46" fill="none" stroke="#7a5c34" strokeWidth="2.5" strokeOpacity="0.35" />
        <Path d="M26 58 Q50 64 74 58" fill="none" stroke="#7a5c34" strokeWidth="3" strokeOpacity="0.3" />
        {/* El arco de ADELANTE del anillo: la mitad inferior, sobre el cuerpo. */}
        <Path d="M4 50 A46 15 0 0 0 96 50" fill="none" stroke="url(#anilloSat)" strokeWidth="6" />
      </G>
    </Svg>
  );
}
