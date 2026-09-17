'use client';

import { useEffect, useState } from 'react';
import EnElBody from '@/components/EnElBody';
import { crearCliente } from '@/lib/supabase/client';
import type { Ejercicio } from '@nucleo/tipos';
import { ORDEN_ZONAS, gruposDeZona, zonaDeGrupo, type Zona } from '@nucleo/ejercicios';
import { tuyos, type Usado } from '@nucleo/tuyos';
import { disponible } from '@nucleo/esquema';
import { useVersionDelEsquema } from '@compartido/esquema';
import { ejerciciosUsados, usadosEnCache } from '@compartido/usados';
import { T } from '@nucleo/textos';

/**
 * ELEGIR ENTRE CIEN EJERCICIOS, NAVEGANDO.
 *
 * Era un `<select>` nativo con las cien opciones adentro. Con 31 se defendía
 * —el selector del sistema es grande y conocido—, pero con cien la rueda se
 * vuelve un rollo de nombres que hay que leer entero, y el encabezado del
 * grupo se va de pantalla a los pocos renglones. Se elegía lo primero que se
 * pareciera, o no se elegía.
 *
 * Ahora son dos toques: zona y músculo, y ahí la lista. Ver
 * `nucleo/ejercicios.ts` para por qué ese árbol y no otro.
 *
 * ATAJOS ARRIBA. Los tres que cuentan para el DOTS van primero y sueltos: son
 * los que más se anotan y los únicos que mueven el número de fuerza. Que
 * estén a un toque no es un privilegio de diseño, es la frecuencia real.
 *
 * UNA ZONA CON UN SOLO MÚSCULO NO PREGUNTA DOS VECES: tren inferior y core
 * llevan directo a la lista. Un paso intermedio con una sola opción es un
 * toque que no decide nada.
 *
 * "TUYOS", ARRIBA DE TODO. Los que esta persona repite de verdad, sacados de
 * sus sesiones (migración 44). El árbol de abajo NO se reordena: esto agrega un
 * atajo, no acomoda el menú. Un menú que se acomoda solo obliga a leerlo entero
 * cada vez, porque ya no se sabe dónde estaba lo de ayer.
 *
 * Sin `userId`, sin migración 44 corrida o sin historial, la sección no
 * aparece y el selector queda exactamente como era. Ver `compartido/usados.ts`.
 */
export default function SelectorEjercicio({
  ejercicios,
  valor,
  userId,
  permiteNinguno = false,
  alElegir,
  alCerrar,
}: {
  ejercicios: Ejercicio[];
  valor: string | null;
  /** Para el atajo "Tuyos". Sin esto el selector funciona igual, sin atajo. */
  userId?: string;
  /** El contador de series admite "cualquier cosa"; las marcas no. */
  permiteNinguno?: boolean;
  alElegir: (id: string | null) => void;
  alCerrar: () => void;
}) {
  const [cerrando, setCerrando] = useState(false);
  // Dónde estamos: sin zona es la primera pantalla; con zona y grupo, la
  // lista. Arranca donde está lo que ya tenías elegido, para que "cambiar de
  // press inclinado a press declinado" no obligue a bajar todo el árbol.
  const actual = ejercicios.find((e) => e.id === valor) ?? null;
  const [zona, setZona] = useState<Zona | null>(
    actual && !actual.cuenta_dots ? zonaDeGrupo(actual.grupo) : null
  );
  const [grupo, setGrupo] = useState<string | null>(
    actual && !actual.cuenta_dots ? actual.grupo : null
  );

  const grupos = [...new Set(ejercicios.map((e) => e.grupo))];
  const delDots = ejercicios.filter((e) => e.cuenta_dots);

  // ARRANCA CON LO QUE YA ESTÁ EN MEMORIA, si está: de la segunda apertura en
  // adelante la hoja sale entera. La primera vez llega un instante después y
  // "Tuyos" aparece arriba — que empuje una vez por carga de la app es el
  // precio de no pedirlo diez veces en un entrenamiento.
  const [usados, setUsados] = useState<Usado[]>(() => (userId ? usadosEnCache(userId) ?? [] : []));
  // SE PREGUNTA LA VERSIÓN ANTES DE LLAMAR, al revés que `pantalla_inicio`.
  // Ahí se llama a ciegas porque es el primer pedido de la app y esperar la
  // versión costaría una ida y vuelta para ahorrar tres. Acá no: la versión ya
  // está pedida hace rato cuando alguien abre el selector, y llamar a ciegas
  // deja un 404 por apertura mientras la 44 no esté corrida. Un 404 esperado
  // en la consola es el que después tapa al que importa.
  const version = useVersionDelEsquema();
  const hayAtajo = disponible('tusEjercicios', version);
  useEffect(() => {
    if (!userId || !hayAtajo || usadosEnCache(userId)) return;
    let vivo = true;
    ejerciciosUsados(crearCliente(), userId).then((filas) => {
      if (vivo) setUsados(filas);
    });
    return () => {
      vivo = false;
    };
  }, [userId, hayAtajo]);
  const mios = tuyos(usados, ejercicios);

  function cerrar() {
    setCerrando(true);
    setTimeout(alCerrar, 200);
  }

  function elegir(id: string | null) {
    alElegir(id);
    cerrar();
  }

  function abrirZona(z: Zona) {
    const suyos = gruposDeZona(z, grupos);
    setZona(z);
    setGrupo(suyos.length === 1 ? suyos[0] : null);
  }

  function volver() {
    if (grupo && gruposDeZona(zona as Zona, grupos).length > 1) setGrupo(null);
    else {
      setZona(null);
      setGrupo(null);
    }
  }

  const lista = grupo ? ejercicios.filter((e) => e.grupo === grupo && !e.cuenta_dots) : [];

  // Al final del body: ver `EnElBody`, que nació de este mismo bug.
  return (
    <EnElBody>
      <div className={`hoja-fondo ${cerrando ? 'cerrando' : ''}`} onClick={cerrar} />
      <div className={`hoja selector-ejercicio ${cerrando ? 'cerrando' : ''}`} role="dialog" aria-modal>
        <div className="selector-cabecera">
          {zona && (
            <button className="selector-volver" onClick={volver} aria-label={T.general.volver}>
              ←
            </button>
          )}
          {/* El nombre del músculo va con inicial mayúscula —viene en
              minúscula de la base— pero el título de la primera pantalla no:
              con `capitalize` a secas quedaba "En Qué Estás". */}
          <h2 className={grupo ? 'capitalizado' : ''}>
            {grupo ?? (zona ? T.ejercicios[zona] : T.sesion.queEstasHaciendo)}
          </h2>
        </div>

        {!zona && (
          <>
            {permiteNinguno && (
              <button className="selector-fila" onClick={() => elegir(null)}>
                {T.sesion.sinEjercicio}
              </button>
            )}
            {/* LOS TUYOS, arriba de todo. No se dibuja el rótulo solo: una
                sección vacía con título es peor que ninguna sección. */}
            {mios.length > 0 && (
              <>
                <div className="selector-rotulo">{T.sesion.tuyos}</div>
                {mios.map((e) => (
                  <button
                    key={`tuyo-${e.id}`}
                    className={`selector-fila ${e.id === valor ? 'elegido' : ''}`}
                    onClick={() => elegir(e.id)}
                  >
                    {e.nombre}
                  </button>
                ))}
              </>
            )}
            {/* Los tres del DOTS, sueltos y arriba, con UN rótulo para los
                tres: repetir "cuentan para el DOTS" en cada fila era decir
                tres veces lo mismo en tres renglones seguidos. */}
            <div className="selector-rotulo">{T.marca.cuentanDots}</div>
            {delDots.map((e) => (
              <button
                key={e.id}
                className={`selector-fila ${e.id === valor ? 'elegido' : ''}`}
                onClick={() => elegir(e.id)}
              >
                {e.nombre}
              </button>
            ))}
            {ORDEN_ZONAS.filter((z) => gruposDeZona(z, grupos).length > 0).map((z) => (
              <button key={z} className="selector-fila zona" onClick={() => abrirZona(z)}>
                {T.ejercicios[z]}
                <span className="apagado">›</span>
              </button>
            ))}
          </>
        )}

        {zona && !grupo && (
          <>
            {gruposDeZona(zona, grupos).map((g) => (
              <button key={g} className="selector-fila zona" onClick={() => setGrupo(g)}>
                {g}
                <span className="apagado">
                  {ejercicios.filter((e) => e.grupo === g && !e.cuenta_dots).length}
                </span>
              </button>
            ))}
          </>
        )}

        {grupo && (
          <div className="selector-lista">
            {lista.map((e) => (
              <button
                key={e.id}
                className={`selector-fila ${e.id === valor ? 'elegido' : ''}`}
                onClick={() => elegir(e.id)}
              >
                {e.nombre}
              </button>
            ))}
          </div>
        )}

        <button className="boton-texto" style={{ marginTop: 14 }} onClick={cerrar}>
          {T.general.cancelar}
        </button>
      </div>
    </EnElBody>
  );
}
