import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';

/**
 * EL FONDO DE LOS BOTONES DE INICIO, CON LAS ESQUINAS CORTADAS EN DIAGONAL (21/10, a pedido:
 * "se ven viejos y muy cuadrados"). React Native no recorta en diagonal, así que el botón queda
 * sin fondo ni borde y esto se dibuja detrás, del tamaño que tenga el botón.
 */
export default function FondoOctogonal({
  relleno,
  borde,
  corte = 10,
  soloArriba,
  tapar,
}: {
  relleno: string;
  borde?: string;
  corte?: number;
  /** Solo las dos esquinas de arriba: la hoja que sube desde abajo. */
  soloArriba?: boolean;
  /** Pinta las esquinas de ese color: una foto no se puede recortar en diagonal, se le tapan. */
  tapar?: string;
}) {
  const [tam, setTam] = useState<{ w: number; h: number } | null>(null);
  const puntos = (w: number, h: number) => {
    // Medio trazo adentro, para que el borde no se corte contra el rectángulo.
    const m = borde ? 0.5 : 0;
    const c = Math.min(corte, w / 2, h / 2);
    const abajo = soloArriba ? [[w - m, h], [m, h]] : [[w - m, h - c], [w - c, h - m], [c, h - m], [m, h - c]];
    return [[c, m], [w - c, m], [w - m, c], ...abajo, [m, c]].map(([x, y]) => `${x},${y}`).join(' ');
  };
  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={(e) => setTam({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      testID="fondo-octogonal"
    >
      {tam && tam.w > 0 && tam.h > 0 && (
        <Svg width={tam.w} height={tam.h}>
          {tapar && [[0, 0, corte, 0, 0, corte], [tam.w, 0, tam.w - corte, 0, tam.w, corte], [tam.w, tam.h, tam.w - corte, tam.h, tam.w, tam.h - corte], [0, tam.h, corte, tam.h, 0, tam.h - corte]].map((t, i) => (
            <Polygon key={i} points={`${t[0]},${t[1]} ${t[2]},${t[3]} ${t[4]},${t[5]}`} fill={tapar} />
          ))}
          <Polygon points={puntos(tam.w, tam.h)} fill={relleno} stroke={borde ?? 'none'} strokeWidth={borde ? 1 : 0} />
        </Svg>
      )}
    </View>
  );
}
