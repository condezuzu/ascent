'use client';

import { useState } from 'react';
import { Outfit, Rubik, Urbanist } from 'next/font/google';

// Candidatas a la tipografía definitiva. Se cargan SOLO en esta página, que
// es de comparación: no entran al bundle de la app.
const outfit = Outfit({ subsets: ['latin'], variable: '--c-outfit', display: 'swap' });
const rubik = Rubik({ subsets: ['latin'], variable: '--c-rubik', display: 'swap' });
const urbanist = Urbanist({ subsets: ['latin'], variable: '--c-urbanist', display: 'swap' });

type Opcion = {
  clave: string;
  nombre: string;
  variable: string;
  claseFuente: string;
  porQue: string;
  contra: string;
};

const OPCIONES: Opcion[] = [
  {
    clave: 'outfit',
    nombre: 'Outfit',
    variable: '--c-outfit',
    claseFuente: outfit.variable,
    porQue:
      'La más geométrica de las tres y la más ancha. Trazo perfectamente parejo, ceros y oes casi circulares. Es la que más se parece a tu referencia.',
    contra:
      'Justamente por geométrica, en textos largos se vuelve un poco fría. Para esta app no es problema: casi no hay párrafos.',
  },
  {
    clave: 'rubik',
    nombre: 'Rubik',
    variable: '--c-rubik',
    claseFuente: rubik.variable,
    porQue:
      'Su marca son las esquinas apenas redondeadas: es literalmente "terminaciones suaves". Geométrica pero con algo de carácter, menos neutra que Outfit.',
    contra:
      'Un poco más angosta que la referencia. En números grandes eso se nota: pesa menos en pantalla.',
  },
  {
    clave: 'urbanist',
    nombre: 'Urbanist',
    variable: '--c-urbanist',
    claseFuente: urbanist.variable,
    porQue:
      'Geométrica de bajo contraste, limpia y bastante ancha. La más neutra de las tres, la que menos se hace notar.',
    contra:
      'Esa misma neutralidad la vuelve la más segura y la menos memorable. Cumple sin decir nada.',
  },
];

const CITA = 'Empezá donde estás. Usá lo que tenés. Hacé lo que puedas.';

export default function Tipografias() {
  const [racha, setRacha] = useState(47);

  return (
    <div className={`${outfit.variable} ${rubik.variable} ${urbanist.variable} comparador`}>
      <p className="comp-intro">
        Tres candidatas para reemplazar a Instrument Serif. Cada bloque muestra el número
        de racha al tamaño real, con la misma composición de la pantalla principal.
      </p>

      <div className="comp-control">
        <span>Probá con otro número:</span>
        {[7, 47, 128].map((n) => (
          <button key={n} className={racha === n ? 'activo' : ''} onClick={() => setRacha(n)}>
            {n}
          </button>
        ))}
      </div>

      {OPCIONES.map((o) => (
        <section key={o.clave} className="comp-bloque" style={{ ['--f-muestra' as string]: `var(${o.variable})` }}>
          <h2>{o.nombre}</h2>

          {/* misma composición que la pantalla principal */}
          <div className="comp-racha">
            <span className="comp-label">Racha</span>
            <span className="comp-numero">{racha}</span>
          </div>
          <div className="comp-barra">
            <div />
          </div>

          <p className="comp-cita">{CITA}</p>
          <div className="comp-datos">
            <span>MEJOR RACHA 128</span>
            <span>ÚLTIMOS 30 · 24/30</span>
          </div>

          <p className="comp-nota">{o.porQue}</p>
          <p className="comp-nota contra">{o.contra}</p>
        </section>
      ))}

      <p className="comp-intro">
        Las tres son una sola familia para todo: número y texto. Con una geométrica de
        números buenos, la jerarquía la dan el tamaño y el peso, y la app queda más
        coherente que mezclando dos familias.
      </p>
    </div>
  );
}
