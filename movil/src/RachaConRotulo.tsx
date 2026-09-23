import { StyleSheet, Text, View } from 'react-native';
import { progresoEnRango, siguienteRango } from '@nucleo/rangos';
import { paletaDe } from '@nucleo/paletas';
import { T } from '@nucleo/textos';
import NumeroQueCuenta from './NumeroQueCuenta';
import { conAlfa } from './colores';

/**
 * EL NÚMERO DE RACHA, CON LA PALABRA AL COSTADO Y LA BARRA DEBAJO.
 *
 * LAS DOS COSAS QUE ESTO PORTA, encontradas por el humano USANDO la app el
 * 22/9 — o sea, cosas que el inventario por pantallas no vio porque no son
 * funciones que falten sino formas que quedaron distintas:
 *
 * 1. **RACHA va al COSTADO del número, no encima.** En la web es la única
 *    decisión de composición deliberada de la app: el número se sale del
 *    margen izquierdo y la palabra se para en vertical contra su costado,
 *    leyéndose de abajo hacia arriba. Deliberadamente incómodo. En la nativa
 *    era un `Text` arriba, y el humano prefiere el de la web con razón: el
 *    número es lo único grande de esa pantalla y un rótulo encima le roba el
 *    arranque.
 * 2. **Faltaba la barra al rango siguiente.** El cálculo ya estaba en
 *    `nucleo/rangos.ts` desde siempre; lo que no estaba era la barra.
 *
 * CÓMO SE HACE LO VERTICAL, que en React Native no es una propiedad:
 * `writing-mode: vertical-rl` NO EXISTE acá. §13x dejó anotados tres caminos
 * —rotar el contenedor, una letra por fila, o un SVG— y esto es **el segundo**,
 * que era la apuesta. Rotar el contenedor pone las letras de costado, que no
 * es lo mismo que apilarlas; el SVG deja de ser texto para el sistema, o sea
 * que el lector de pantalla pierde la palabra. Una letra por fila se lee igual
 * que en la web y sigue siendo texto: el `letter-spacing: 0.42em` del CSS pasa
 * a ser la separación ENTRE FILAS.
 *
 * Y SE LEE DE ABAJO HACIA ARRIBA, como en la web (`rotate(180deg)` sobre el
 * `vertical-rl`): por eso las letras van al revés. Si se apilaran en orden
 * normal sería otra composición, no la misma.
 *
 * LA BARRA NO OCUPA EL ANCHO COMPLETO y no lleva etiqueta: arranca donde el
 * número y termina antes del borde, para que no todo cierre en la misma
 * línea. Sin texto porque decir "faltan 4 días para el rango 5" nombraría el
 * rango, y los rangos no se nombran nunca (§7): descubrir en qué te vas a
 * convertir es la recompensa.
 */
export default function RachaConRotulo({
  racha,
  rango,
}: {
  racha: number;
  /** El rango actual, para el color. Es una de las tres cosas que lo llevan. */
  rango: number | null;
}) {
  const pal = paletaDe(rango ?? 1, null);
  const prox = siguienteRango(racha);
  const progreso = progresoEnRango(racha);
  // Al revés: la palabra se lee de abajo hacia arriba.
  const letras = [...T.inicio.racha].reverse();

  return (
    <View>
      <View style={estilos.fila}>
        <View style={estilos.rotulo} accessibilityLabel={T.inicio.racha}>
          {letras.map((l, i) => (
            // `importantForAccessibility` en las letras sueltas: sin esto, el
            // lector de pantalla dictaría "A H C A R", que no es una palabra.
            // La etiqueta de la columna ya dice RACHA entera.
            <Text
              key={i}
              style={estilos.letra}
              importantForAccessibility="no"
              accessibilityElementsHidden
            >
              {l}
            </Text>
          ))}
        </View>
        {/* VIAJA HASTA EL NÚMERO NUEVO en vez de reemplazarse. La primera vez
            no cuenta —abrir la app no es haber subido 47 hoy— y con "reducir
            movimiento" salta. Ver `NumeroQueCuenta.tsx`. */}
        <NumeroQueCuenta valor={racha} style={[estilos.numero, { color: pal.claro }]} />
      </View>

      {prox && (
        <View style={[estilos.barra, { backgroundColor: conAlfa(pal.principal, 0.14) }]}>
          <View
            style={[
              estilos.llena,
              { width: `${Math.round(progreso * 100)}%`, backgroundColor: pal.claro },
            ]}
          />
        </View>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  // `flex-end`: la palabra se apoya en la base del número, no en su tope.
  fila: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  // El equivalente del `padding-bottom: 12px` de la web: la columna de letras
  // no llega hasta la línea de base del número, se queda un poco antes.
  rotulo: { paddingBottom: 14, alignItems: 'center' },
  // `lineHeight` chico y `letterSpacing` en cero: acá la separación entre
  // letras es la separación entre FILAS, que es lo que hace el efecto.
  letra: { color: '#8a93a8', fontSize: 10, lineHeight: 14, textTransform: 'uppercase' },
  numero: { fontSize: 92, fontWeight: '300', lineHeight: 100 },
  barra: { height: 3, width: '62%', borderRadius: 2, overflow: 'hidden', marginTop: 20, marginBottom: 8 },
  llena: { height: '100%', borderRadius: 2 },
});
