'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { crearCliente } from '@/lib/supabase/client';
import { miUsuario } from '@/lib/supabase/quienSoy';
import { leerPasoDelRecorrido, marcarRecorridoVisto, guardarPasoDelRecorrido } from '@compartido/guia';
import { PASOS_DEL_RECORRIDO } from '@nucleo/recorrido';
import { T } from '@nucleo/textos';

/**
 * EL RECORRIDO: una tarjeta chica arriba de la barra, con una línea sobre la
 * pantalla que se está mirando. "Siguiente" lleva a la próxima pantalla.
 *
 * Vive en la barra de abajo porque la barra está en todas las pantallas del
 * recorrido: así no hay que acordarse de ponerlo en cada una.
 *
 * Si la persona se va a otra pantalla por su cuenta, la tarjeta no la persigue:
 * dice el paso y ofrece llevarla. Un recorrido que arrastra de vuelta cada vez
 * que tocás otra cosa es una trampa.
 */
export default function Recorrido() {
  const ruta = usePathname();
  const router = useRouter();
  const [uid, setUid] = useState('');
  const [paso, setPaso] = useState<number | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const user = await miUsuario(crearCliente());
      if (!vivo || !user) return;
      setUid(user.id);
      setPaso(await leerPasoDelRecorrido(user.id));
    })();
    return () => {
      vivo = false;
    };
  }, []);

  const actual = paso === null ? null : PASOS_DEL_RECORRIDO[paso];
  const aca = actual !== null && ruta === actual.ruta;

  // Lleva la vista a la sección de la que habla el paso, y la resalta.
  useEffect(() => {
    if (!aca || !actual?.ancla) return;
    const t = setTimeout(() => {
      const el = document.getElementById(actual.ancla!);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el?.classList.add('resaltada');
    }, 400);
    return () => {
      clearTimeout(t);
      document.getElementById(actual.ancla!)?.classList.remove('resaltada');
    };
  }, [aca, actual]);

  if (paso === null || !actual) return null;
  const ultimo = paso === PASOS_DEL_RECORRIDO.length - 1;

  async function terminar() {
    setPaso(null);
    if (uid) await marcarRecorridoVisto(uid);
    if (ruta !== '/') router.push('/');
  }

  async function siguiente() {
    if (ultimo) return terminar();
    const n = (paso ?? 0) + 1;
    setPaso(n);
    if (uid) await guardarPasoDelRecorrido(uid, n);
    router.push(PASOS_DEL_RECORRIDO[n].ruta);
  }

  return (
    <div className="recorrido" role="dialog" aria-label={T.recorrido.titulo}>
      <span className="recorrido-paso">
        {paso + 1}/{PASOS_DEL_RECORRIDO.length}
      </span>
      <p>{actual.texto}</p>
      <div className="recorrido-botones">
        <button className="boton-texto" onClick={terminar}>
          {T.recorrido.saltar}
        </button>
        {aca ? (
          <button className="boton-solido" onClick={siguiente}>
            {ultimo ? T.recorrido.listo : T.recorrido.siguiente}
          </button>
        ) : (
          <button className="boton-solido" onClick={() => router.push(actual.ruta)}>
            {T.recorrido.ir}
          </button>
        )}
      </div>
    </div>
  );
}
