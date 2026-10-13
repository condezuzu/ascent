'use client';

// Propuesta: el gráfico de peso no desaparece cuando la ventana queda vacía.
//
// EL BUG QUE MUESTRA: quien se pesó varias veces hace dos meses y una sola vez
// ahora toca "1 mes" y el gráfico se borra ENTERO, botones incluidos. No hay
// cómo volver a "Todo" sin recargar la página. (La ventana se cuenta hacia
// atrás desde la ÚLTIMA anotación, no desde hoy: ver `ultimosDias`.)

import FondoEspacial from '@/components/FondoEspacial';
import GraficoPeso from '@/components/GraficoPeso';
import { hoyISO, restarDias } from '@nucleo/fechas';
import { T } from '@nucleo/textos';
import { Banco, Comparar, Lado } from '../Banco';
import GraficoPesoPropuesto from './GraficoPesoPropuesto';

// Cuatro anotaciones de hace unas ocho semanas y una de ayer: en "3 meses" y en
// "Todo" hay cinco, y en "1 mes" queda una sola.
const hoy = hoyISO();
const PESOS = [
  { fecha: restarDias(hoy, 57), valor: 78.1 },
  { fecha: restarDias(hoy, 56), valor: 78.3 },
  { fecha: restarDias(hoy, 55), valor: 78.5 },
  { fecha: restarDias(hoy, 47), valor: 78.5 },
  { fecha: restarDias(hoy, 1), valor: 79.4 },
];

export default function PropuestaGraficoPeso() {
  return (
    <>
      <FondoEspacial rango={1} esquina="arriba-derecha" velo={0.74} />
      <Banco
        titulo="El gráfico de peso, cuando la ventana queda vacía"
        queEs="El peso de Stats, con cuatro anotaciones de hace dos meses y una de ayer. Toca «1 mes» en los dos: hoy el gráfico se va entero y no hay cómo volver; la propuesta deja los botones y dice por qué no hay dibujo."
      >
        <Comparar>
          <Lado rotulo="Hoy" nota="Después de tocar «1 mes» no queda nada: ni el gráfico ni los botones. Solo se recupera recargando.">
            <div className="seccion" style={{ marginBottom: 0, minHeight: 190 }}>
              <h3>{T.stats.pesoTendencia}</h3>
              <GraficoPeso pesos={PESOS} unidad="kg" />
            </div>
          </Lado>
          <Lado rotulo="Propuesta" nota="Los botones quedan en su lugar y a la misma altura. El gráfico vuelve tocando «3 meses» o «Todo».">
            <div className="seccion" style={{ marginBottom: 0, minHeight: 190 }}>
              <h3>{T.stats.pesoTendencia}</h3>
              <GraficoPesoPropuesto pesos={PESOS} unidad="kg" />
            </div>
          </Lado>
        </Comparar>
      </Banco>
    </>
  );
}
