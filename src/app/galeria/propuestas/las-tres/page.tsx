'use client';

// Propuesta: en "Las tres que cuentan", decir CUÁL falta.
//
// Hoy la lista muestra solo las que están y abajo dice "Con 2 de 3 todavía no
// hay número". Quien lo lee tiene que saber de memoria cuáles son las tres para
// deducir la que le falta. La propuesta la pone en la lista, en su lugar, con
// el toque que la carga.

import FondoEspacial from '@/components/FondoEspacial';
import { fechaDeMarca, pesoLindo } from '@nucleo/fuerza';
import { T } from '@nucleo/textos';
import { Banco, Comparar, Lado } from '../Banco';

type Cargada = { ejercicio: string; nombre: string; kg: number; fecha: string };
type Falta = { ejercicio: string; nombre: string; kg: null };

// El caso de la cuenta de prueba, tal cual sale hoy en /fuerza.
const LAS_TRES: (Cargada | Falta)[] = [
  { ejercicio: 'sentadilla', nombre: 'Sentadilla', kg: null },
  { ejercicio: 'press_banca', nombre: 'Press de banca', kg: 100, fecha: '2026-08-18' },
  { ejercicio: 'peso_muerto', nombre: 'Peso muerto', kg: 165, fecha: '2026-08-18' },
];

const cargadas = LAS_TRES.filter((m): m is Cargada => m.kg !== null);
const faltan = LAS_TRES.filter((m): m is Falta => m.kg === null);

function Fila({ nombre, kg, fecha }: { nombre: string; kg: number; fecha: string }) {
  return (
    <div className="marca">
      <div className="marca-fila">
        <span className="marca-nombre">{nombre}</span>
        <span className="marca-kg">{pesoLindo(kg, 'kg')}</span>
        <span className="marca-fecha">{fechaDeMarca(fecha)}</span>
      </div>
    </div>
  );
}

export default function PropuestaLasTres() {
  return (
    <>
      <FondoEspacial rango={1} esquina="arriba-derecha" velo={0.74} />
      <Banco
        titulo="Las tres que cuentan: decir cuál falta"
        queEs="Mis marcas, con dos de las tres cargadas. Hoy la pantalla dice cuántas hay; la propuesta dice cuál falta y deja cargarla desde ahí."
      >
        <Comparar>
          <Lado rotulo="Hoy" nota="Para saber qué falta hay que acordarse de cuáles son las tres.">
            <div className="seccion" style={{ marginBottom: 0 }}>
              <h3>{T.fuerza.lasTresQueCuentan}</h3>
              <div className="tarjeta" style={{ padding: 4 }}>
                {cargadas.map((m) => (
                  <Fila key={m.ejercicio} nombre={m.nombre} kg={m.kg} fecha={m.fecha} />
                ))}
              </div>
              <p className="nota-privada">
                {T.fuerza.faltanMarcas(cargadas.length)} <span className="enlace">{T.fuerza.verEnAjustes}</span>
              </p>
            </div>
          </Lado>

          <Lado
            rotulo="Propuesta"
            nota="Las tres van siempre, en el mismo orden: la que falta ocupa su lugar y se carga con un toque. La línea de abajo la nombra."
          >
            <div className="seccion" style={{ marginBottom: 0 }}>
              <h3>{T.fuerza.lasTresQueCuentan}</h3>
              <div className="tarjeta" style={{ padding: 4 }}>
                {LAS_TRES.map((m) =>
                  m.kg !== null ? (
                    <Fila key={m.ejercicio} nombre={m.nombre} kg={m.kg} fecha={m.fecha} />
                  ) : (
                    <div key={m.ejercicio} className="marca">
                      <div className="marca-fila">
                        <span className="marca-nombre apagado">{m.nombre}</span>
                        <span className="enlace" style={{ fontSize: 14 }}>
                          Anotarla
                        </span>
                      </div>
                    </div>
                  )
                )}
              </div>
              <p className="nota-privada">
                Falta {faltan.map((m) => m.nombre.toLowerCase()).join(' y ')} para tu número.{' '}
                <span className="enlace">{T.fuerza.verEnAjustes}</span>
              </p>
            </div>
          </Lado>
        </Comparar>
      </Banco>
    </>
  );
}
