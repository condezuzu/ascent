'use client';

import { useEffect, useState } from 'react';
import { crearCliente } from '@/lib/supabase/client';
import { METAS, metaCumplida, type EstadoBloques } from '@/lib/bloques';
import type { Ejercicio } from '@/lib/tipos';
import { T } from '@/textos';

/**
 * QUÉ ESTÁS HACIENDO, CUÁNTAS TE PROPUSISTE, CUÁNTAS VAN.
 *
 * Antes acá había un número grande con un `+` y un `−` al lado. Eso dice
 * cuántas series llevás en toda la sesión y nada más, así que obliga a llevar
 * de memoria cuántas van de cada ejercicio — justo cuando estás transpirado y
 * sin aire.
 *
 * No son dos funciones pegadas: el ejercicio y la meta viven en la MISMA fila
 * porque son la misma decisión, "voy a hacer tres de esto".
 *
 * LOS PUNTOS REEMPLAZAN LA CUENTA MENTAL. No hay que leer un número y
 * compararlo con otro: se ve cuántas faltan. Pasada la meta los puntos extra
 * se dibujan igual, más chicos, porque pasarse es normal y esconderlo sería
 * decirle a alguien que lo que hizo no cuenta.
 *
 * LLEGAR A LA META NO CIERRA NADA. Aparece "Siguiente" y ya. Que la app decida
 * por vos que terminaste es exactamente lo que no se quiere.
 */
export default function Bloque({
  estado,
  total,
  alSumar,
  alRestar,
  alSiguiente,
  alElegirEjercicio,
  alElegirMeta,
}: {
  estado: EstadoBloques;
  total: number;
  alSumar: () => void;
  alRestar: () => void;
  alSiguiente: () => void;
  alElegirEjercicio: (id: string | null) => void;
  alElegirMeta: (meta: number) => void;
}) {
  const [ejercicios, setEjercicios] = useState<Ejercicio[]>([]);

  // El catálogo se pide una vez y no bloquea nada: sin él el selector queda
  // con la opción vacía y el contador anda igual, que es la regla de que esto
  // funcione aunque nunca elijas ejercicio.
  useEffect(() => {
    const supabase = crearCliente();
    let vivo = true;
    (async () => {
      const { data } = await supabase.from('ejercicios').select('*').order('orden');
      if (vivo && data) setEjercicios(data as Ejercicio[]);
    })();
    return () => {
      vivo = false;
    };
  }, []);

  const cumplida = metaCumplida(estado);
  // Tantos puntos como la meta, más los que te pasaste.
  const puntos = Math.max(estado.meta, estado.hechas);
  const delDots = ejercicios.filter((e) => e.cuenta_dots);
  const resto = ejercicios.filter((e) => !e.cuenta_dots);
  const grupos = [...new Set(resto.map((e) => e.grupo))];

  return (
    <div className="bloque">
      <div className="bloque-fila">
        {/* Un <select> nativo y no una hoja propia: el selector del sistema es
            grande, conocido y se resuelve de un toque. En un gimnasio eso vale
            más que cualquier control hecho a mano. */}
        <select
          className="bloque-ejercicio"
          value={estado.ejercicio ?? ''}
          onChange={(e) => alElegirEjercicio(e.target.value || null)}
          aria-label={T.sesion.queEstasHaciendo}
        >
          <option value="">{T.sesion.sinEjercicio}</option>
          <optgroup label={T.marca.cuentanDots}>
            {delDots.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre}
              </option>
            ))}
          </optgroup>
          {grupos.map((g) => (
            <optgroup key={g} label={g}>
              {resto
                .filter((e) => e.grupo === g)
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nombre}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>

        <div className="bloque-metas" role="group" aria-label={T.sesion.cuantasVasAHacer}>
          {METAS.map((m) => (
            <button
              key={m}
              className={`pastilla ${estado.meta === m ? 'prendida' : ''}`}
              onClick={() => alElegirMeta(m)}
              aria-pressed={estado.meta === m}
            >
              ×{m}
            </button>
          ))}
        </div>
      </div>

      <div className="bloque-puntos" aria-hidden>
        {Array.from({ length: puntos }).map((_, i) => (
          <span
            key={i}
            className={`punto ${i < estado.hechas ? 'lleno' : ''} ${i >= estado.meta ? 'extra' : ''}`}
          />
        ))}
      </div>

      <div className="contador-series">
        <button
          className="paso"
          onClick={alRestar}
          disabled={estado.hechas === 0}
          aria-label={T.inicio.sacarSerie}
        >
          −
        </button>
        <div className="cuenta" aria-live="polite">
          <span className="numero">{T.sesion.deMeta(estado.hechas, estado.meta)}</span>
          <span className="palabra">{T.sesion.totalHoy(total)}</span>
        </div>
        <button className="paso mas" onClick={alSumar} aria-label={T.inicio.sumarSerie}>
          +
        </button>
      </div>

      {/* Aparece recién con la meta cumplida: antes no tendría qué cerrar, y un
          botón que no hace nada enseña a ignorar ese lugar de la pantalla. */}
      {cumplida && (
        <button className="boton-texto bloque-siguiente" onClick={alSiguiente}>
          {T.sesion.siguienteBloque}
        </button>
      )}
    </div>
  );
}
