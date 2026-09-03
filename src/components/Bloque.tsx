'use client';

import { useEffect, useState } from 'react';
import { crearCliente } from '@/lib/supabase/client';
import { METAS, metaCumplida, type EstadoBloques } from '@nucleo/bloques';
import type { Ejercicio } from '@nucleo/tipos';
import { T } from '@nucleo/textos';
import ListaDeBloques from './ListaDeBloques';

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
  alTocarBloque,
}: {
  estado: EstadoBloques;
  total: number;
  alSumar: () => void;
  alRestar: () => void;
  alSiguiente: () => void;
  alElegirEjercicio: (id: string | null) => void;
  alElegirMeta: (meta: number) => void;
  alTocarBloque: (indice: number, delta: number | 'quitar') => void;
}) {
  const [ejercicios, setEjercicios] = useState<Ejercicio[]>([]);
  const [lista, setLista] = useState(false);

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
  // EL GRUPO AL LADO DEL NOMBRE, aunque arriba ya este el titulo del grupo.
  // Dos razones, y ninguna es la de siempre —"por las dudas"—:
  // 1. Un <select> cerrado muestra SOLO el texto de la opcion elegida, sin su
  //    titulo. Sin esto, en la pantalla se lee "Press Arnold" a secas.
  // 2. Con cien opciones, la rueda del telefono se come el titulo del grupo a
  //    los pocos renglones. La lista larga es justo donde el encabezado deja
  //    de servir, que es lo contrario de lo que uno supone.
  const conGrupo = (e: Ejercicio) => `${e.nombre} · ${e.grupo}`;
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
                {conGrupo(e)}
              </option>
            ))}
          </optgroup>
          {grupos.map((g) => (
            <optgroup key={g} label={g}>
              {resto
                .filter((e) => e.grupo === g)
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {conGrupo(e)}
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

      <div className="bloque-cuenta" aria-live="polite">
        <span className="numero">{T.sesion.deMeta(estado.hechas, estado.meta)}</span>
        <span className="palabra">{T.sesion.totalHoy(total)}</span>
      </div>

      {/* EL + OCUPA MEDIA PANTALLA. Era un botón de 44 px que había que
          apuntar, con el teléfono en una mano, transpirado y sin aire — o sea
          en las peores condiciones posibles para apuntar. Es el botón que más
          se toca de toda la app y era el más chico de la pantalla.

          Es un botón enorme y no una capa invisible encima: una capa taparía
          la barra de abajo y el resto de los controles, y el día que algo
          quede debajo nadie va a entender por qué no responde. */}
      <button className="bloque-mas" onClick={alSumar} aria-label={T.inicio.sumarSerie}>
        <span>+</span>
      </button>

      {/* Quitar una es secundario y va chico: corregir pasa una vez cada
          tantas, sumar pasa doce veces por sesión. */}
      <button
        className="boton-texto bloque-menos"
        onClick={alRestar}
        disabled={estado.hechas === 0}
      >
        {T.inicio.sacarSerie}
      </button>

      {/* Aparece recién con la meta cumplida: antes no tendría qué cerrar, y un
          botón que no hace nada enseña a ignorar ese lugar de la pantalla. */}
      {cumplida && (
        <button className="boton-texto bloque-siguiente" onClick={alSiguiente}>
          {T.sesion.siguienteBloque}
        </button>
      )}

      {/* Corregir hacia atrás vive DETRÁS de un botón, no a la vista: sumar
          pasa doce veces por sesión y corregir una vez cada tantas. Lo que se
          usa siempre manda en la pantalla. */}
      {(estado.cerrados.length > 0 || estado.hechas > 0) && (
        <button className="boton-texto bloque-lista" onClick={() => setLista(true)}>
          {T.sesion.verLista}
        </button>
      )}

      {lista && (
        <ListaDeBloques
          estado={estado}
          ejercicios={ejercicios}
          alTocar={alTocarBloque}
          alCerrar={() => setLista(false)}
        />
      )}
    </div>
  );
}
