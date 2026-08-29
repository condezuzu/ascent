'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { crearCliente } from '@/lib/supabase/client';
import { miUsuario } from '@/lib/supabase/quienSoy';
import { marcarRecorridoVisto } from '@/lib/guia';
import FondoEspacial from '@/components/FondoEspacial';
import { T } from '@/textos';

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

const PASOS = T.guia.pasos;

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
      const user = await miUsuario(supabase);
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

  async function terminar() {
    // Se espera la escritura ANTES de navegar. En web resuelve en el mismo
    // tick; en nativo es asíncrona de verdad y salir sin esperarla es como no
    // haberla hecho si la app se cierra justo ahí.
    if (uid) await marcarRecorridoVisto(uid);
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
        rango={paso === 1 ? ASOMO[asomo] : paso === 2 ? 3 : paso === 3 ? 4 : 1}
        vacio={paso === 0}
        reposo={paso === 2}
        esquina="centro"
        velo={0.5}
      />

      <div className="guia">
        <button className="guia-saltar" onClick={terminar}>
          {T.guia.saltar}
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
          {paso === PASOS.length - 1 ? T.guia.entendido : T.guia.seguir}
        </button>
      </div>
    </>
  );
}
