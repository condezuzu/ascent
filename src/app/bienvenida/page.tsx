'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { crearCliente } from '@/lib/supabase/client';
import { marcarRecorridoVisto } from '@/lib/guia';
import FondoEspacial from '@/components/FondoEspacial';

/**
 * Recorrido de bienvenida: tres pantallas cortas, saltables, entre elegir el
 * nombre y la principal.
 *
 * REGLA DURA: la explicación es genérica. No se nombra ningún rango, ni
 * cuántos hay, ni dónde termina la escalera. Descubrir en qué te vas a
 * convertir es la recompensa del juego; contarlo acá la arruina. Por eso la
 * segunda pantalla MUESTRA que el objeto cambia en vez de decir en qué se
 * convierte, y solo recorre el principio de la escalera.
 *
 * Se puede volver a ver desde Ajustes.
 */

const PASOS = [
  {
    titulo: 'Registrás el día',
    texto: 'Cada vez que vas al gimnasio, lo marcás acá. Un día atrás del otro, eso es tu racha.',
  },
  {
    titulo: 'Y algo se va formando',
    texto: 'Eso que se mueve atrás cambia con tu racha. Hasta dónde llega, lo vas a ver vos.',
  },
  {
    titulo: 'Los descansos no te cortan',
    texto: 'Elegís tus días libres una vez, en Ajustes. Y si igual se te corta, no volvés a cero.',
  },
];

// Solo el principio de la escalera: alcanza para que se entienda que esto
// evoluciona, y no delata ni cuántos escalones hay ni cómo termina.
const ASOMO = [1, 2, 3];

export default function Bienvenida() {
  const router = useRouter();
  const [supabase] = useState(() => crearCliente());
  const [uid, setUid] = useState('');
  const [paso, setPaso] = useState(0);
  const [asomo, setAsomo] = useState(0);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return router.replace('/login');
      setUid(user.id);
    })();
  }, [supabase, router]);

  // En la segunda pantalla el objeto se transforma solo: es la única forma de
  // explicar que evoluciona sin decir en qué se convierte.
  useEffect(() => {
    if (paso !== 1) return;
    const t = setInterval(() => setAsomo((a) => (a + 1) % ASOMO.length), 3400);
    return () => clearInterval(t);
  }, [paso]);

  function terminar() {
    if (uid) marcarRecorridoVisto(uid);
    router.replace('/');
    router.refresh();
  }

  function siguiente() {
    if (paso === PASOS.length - 1) return terminar();
    setPaso((p) => p + 1);
  }

  const actual = PASOS[paso];

  return (
    <>
      <FondoEspacial
        rango={paso === 1 ? ASOMO[asomo] : paso === 2 ? 3 : 1}
        vacio={paso === 0}
        reposo={paso === 2}
        esquina="centro"
        velo={0.5}
      />

      <div className="guia">
        <button className="guia-saltar" onClick={terminar}>
          Saltar
        </button>

        {/* El paso no se cuenta con puntitos centrados: es una regla fina
            pegada al borde izquierdo, como la palabra RACHA en la principal. */}
        <div className="guia-regla" aria-hidden>
          {PASOS.map((_, i) => (
            <span key={i} className={i <= paso ? 'hecho' : ''} />
          ))}
        </div>

        <div className="guia-texto" key={paso}>
          <span className="guia-paso">{String(paso + 1).padStart(2, '0')}</span>
          <h1>{actual.titulo}</h1>
          <p>{actual.texto}</p>
        </div>

        <button className="boton-solido" onClick={siguiente}>
          {paso === PASOS.length - 1 ? 'Entendido' : 'Seguir'}
        </button>
      </div>
    </>
  );
}
