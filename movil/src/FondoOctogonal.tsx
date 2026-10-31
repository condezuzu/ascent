import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, G, LinearGradient, Polygon, Stop } from 'react-native-svg';
import { C } from './colores';

// Tres trazos anchos y tenues alrededor: es un difuminado barato, y se ve igual en el teléfono y en la web.
const ANILLOS = [[17, 0.025], [11, 0.04], [6, 0.06], [2, 0.09]] as const;
const MARGEN = 10;

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
  superficie,
  luz,
}: {
  relleno: string;
  borde?: string;
  corte?: number;
  /** Solo las dos esquinas de arriba: la hoja que sube desde abajo. */
  soloArriba?: boolean;
  /** Pinta las esquinas de ese color: una foto no se puede recortar en diagonal, se le tapan. */
  tapar?: string;
  /** En vez de un relleno liso, una luz que cae de arriba. */
  superficie?: boolean;
  /** El color que emite. Dibujado: una sombra no sigue la diagonal, y en la web sería un rectángulo. */
  luz?: string;
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
        <Svg
          width={tam.w + (luz ? MARGEN * 2 : 0)}
          height={tam.h + (luz ? MARGEN * 2 : 0)}
          style={luz ? { position: 'absolute', left: -MARGEN, top: -MARGEN } : undefined}
        >
          {superficie && (
            <Defs>
              <LinearGradient id="superficie" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={C.brillo} stopOpacity={0.075} />
                <Stop offset="1" stopColor={C.brillo} stopOpacity={0.015} />
              </LinearGradient>
            </Defs>
          )}
          <G x={luz ? MARGEN : 0} y={luz ? MARGEN : 0}>
          {luz && ANILLOS.map(([ancho, fuerza]) => (
            <Polygon key={ancho} points={puntos(tam.w, tam.h)} fill="none" stroke={luz} strokeWidth={ancho} strokeOpacity={fuerza} strokeLinejoin="round" />
          ))}
          {tapar && [[0, 0, corte, 0, 0, corte], [tam.w, 0, tam.w - corte, 0, tam.w, corte], [tam.w, tam.h, tam.w - corte, tam.h, tam.w, tam.h - corte], [0, tam.h, corte, tam.h, 0, tam.h - corte]].map((t, i) => (
            <Polygon key={i} points={`${t[0]},${t[1]} ${t[2]},${t[3]} ${t[4]},${t[5]}`} fill={tapar} />
          ))}
          <Polygon points={puntos(tam.w, tam.h)} fill={superficie ? 'url(#superficie)' : relleno} stroke={borde ?? 'none'} strokeWidth={borde ? 1 : 0} />
        </G>
        </Svg>
      )}
    </View>
  );
}
