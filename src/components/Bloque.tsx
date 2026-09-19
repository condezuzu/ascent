'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { crearCliente } from '@/lib/supabase/client';
import { METAS, metaCumplida, type EstadoBloques } from '@nucleo/bloques';
import type { Ejercicio } from '@nucleo/tipos';
import { T } from '@nucleo/textos';
import ListaDeBloques from '@/components/ListaDeBloques';
import SelectorEjercicio from '@/components/SelectorEjercicio';
import CampoPeso from '@/components/CampoPeso';
import { leerAnotarPeso } from '@compartido/anotarPeso';
import { useVersionDelEsquema } from '@compartido/esquema';
import { disponible } from '@nucleo/esquema';
import { pesoCorto, type Unidad } from '@nucleo/peso';
import EtiquetaDeCarga from '@/components/EtiquetaDeCarga';
import {
  OPCIONES_DE_LA_PREGUNTA,
  cargaVigente,
  hayQuePreguntar,
  kilosMovidos,
  muestraTotal,
  type Carga,
} from '@nucleo/carga';

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
  debajoDelMas,
  alRestar,
  alSiguiente,
  alElegirEjercicio,
  alMudarSeries,
  alElegirMeta,
  alTocarBloque,
  unidad,
  alElegirPeso,
  alCorregirPeso,
  cargaConsultada,
  alElegirCarga,
  alCorregirCarga,
  alCorregirEjercicio,
}: {
  estado: EstadoBloques;
  total: number;
  alSumar: () => void;
  /**
   * Lo que va pegado al `+`: la pregunta "¿lo guardo como marca?" de la serie
   * que se acaba de confirmar. Debajo de la lista quedaba tapada por
   * "Terminar" y había que bajar para contestarla (visto el 18/9).
   */
  debajoDelMas?: ReactNode;
  alRestar: () => void;
  alSiguiente: () => void;
  alElegirEjercicio: (id: string | null) => void;
  /** El mismo cambio, pero llevándose las series ya contadas. */
  alMudarSeries: (id: string | null, cargaQueSeVeia?: Carga) => void;
  alElegirMeta: (meta: number) => void;
  alTocarBloque: (indice: number, delta: number | 'quitar') => void;
  unidad: Unidad;
  /** El peso vigente del bloque, en kilos. */
  alElegirPeso: (kg: number | null) => void;
  /** El peso de una serie ya hecha. `indice` -1 es el bloque en curso. */
  alCorregirPeso: (indice: number, serie: number, kg: number | null) => void;
  /** El ejercicio del que ya se sabe con qué se hace. Ver `useSesion`. */
  cargaConsultada: string | null;
  /** Qué significa el número en el bloque en curso. */
  alElegirCarga: (c: Carga) => void;
  /** Lo mismo en un bloque de la lista. `indice` -1 es el bloque en curso. */
  alCorregirCarga: (indice: number, c: Carga) => void;
  alCorregirEjercicio: (indice: number, id: string, cargaQueSeVeia?: Carga) => void;
}) {
  const [ejercicios, setEjercicios] = useState<Ejercicio[]>([]);
  const [lista, setLista] = useState(false);
  // El ejercicio que se eligió mientras había series sin cerrar. Mientras
  // esto no es `undefined` hay una pregunta abierta y el selector ya muestra
  // el nuevo: se responde qué pasa con las series, no si el cambio se hace.
  const [aDonde, setADonde] = useState<string | null | undefined>(undefined);
  const [abriendo, setAbriendo] = useState(false);
  // Prendido por omisión y desde el primer cuadro: el que lo apagó en Ajustes
  // lo ve un instante al entrar, y eso es mejor que un campo que aparece
  // tarde y empuja el `+` para abajo justo cuando alguien va a tocarlo.
  const [prefierePeso, setPrefierePeso] = useState(true);
  // SIN LA MIGRACIÓN 36 NO HAY CAMPO. La función vieja de guardar bloques
  // tiraba los pesos sin dar error: se veían, se escribían y no se guardaba
  // nada. Ver `nucleo/esquema.ts`.
  const version = useVersionDelEsquema();
  const anotarPeso = prefierePeso && disponible('pesoPorSerie', version);
  // QUÉ SIGNIFICA EL NÚMERO (migración 38). Sin ella, el campo es el de antes:
  // una etiqueta que la base no puede guardar mentiría igual que el campo de
  // peso sin la 36.
  const conCarga = anotarPeso && disponible('cargaDelPeso', version);
  useEffect(() => {
    leerAnotarPeso().then(setPrefierePeso);
  }, []);

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
  const conGrupo = (e: Ejercicio | null) => (e ? `${e.nombre} · ${e.grupo}` : '');
  const actual = ejercicios.find((e) => e.id === estado.ejercicio) ?? null;
  const nombreDe = (id: string | null) =>
    id ? (ejercicios.find((e) => e.id === id)?.nombre ?? id) : T.sesion.sinEjercicio;
  const delDots = ejercicios.filter((e) => e.cuenta_dots);
  const resto = ejercicios.filter((e) => !e.cuenta_dots);
  const cargaVista = cargaVigente(estado.carga, actual?.carga);
  const admitePeso = !!estado.ejercicio && actual?.admite_peso !== false;
  const preguntar =
    conCarga &&
    admitePeso &&
    hayQuePreguntar({
      ambigua: actual?.carga_ambigua,
      cargaDelBloque: estado.carga,
      yaSeConsulto: cargaConsultada === estado.ejercicio,
    });
  const grupos = [...new Set(resto.map((e) => e.grupo))];

  return (
    <div className="bloque">
      <div className="bloque-fila">
        {/* UNA HOJA PROPIA Y NO EL <select> NATIVO. Con 31 ejercicios el
            selector del sistema ganaba: grande, conocido, de un toque. Con
            100 pierde — la rueda se vuelve un rollo que hay que leer entero y
            el encabezado del grupo se va de pantalla a los pocos renglones.
            Ver `SelectorEjercicio`. */}
        <button className="bloque-ejercicio" onClick={() => setAbriendo(true)}>
          {estado.ejercicio ? conGrupo(actual) : T.sesion.sinEjercicio}
        </button>

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

      {/* EL PESO, AL LADO DE LO QUE SE ESTÁ HACIENDO. Solo con un ejercicio
          elegido —un peso de "cualquier cosa" no dice nada— y solo si el
          ejercicio admite peso: una marca en kilos de plancha no significa
          nada (migración 31). */}
      {anotarPeso && admitePeso && (
        <div className="bloque-peso">
          <CampoPeso kg={estado.peso} unidad={unidad} alCambiar={alElegirPeso} />
          {conCarga && !preguntar && (
            <EtiquetaDeCarga carga={cargaVista} ejercicio={estado.ejercicio} alElegir={alElegirCarga} />
          )}
          {/* LA LÍNEA DEL TOTAL, solo cuando lo escrito no es el total. Además
              de informar, delata al que escribió la suma: "120 kg en total" en
              un curl se ve raro enseguida. */}
          {conCarga && !preguntar && estado.peso && muestraTotal(cargaVista) && (
            <p className="carga-total">
              {T.sesion.enTotal(pesoCorto(kilosMovidos(estado.peso, cargaVista), unidad), unidad)}
            </p>
          )}
        </div>
      )}

      {/* CON QUÉ LO HACÉS, la primera vez. Solo para los ejercicios cuyo nombre
          no lo dice, y en el mismo lugar que la etiqueta: contestar ES elegir
          la etiqueta. No bloquea nada — el + anda con el modo por omisión
          mientras tanto. */}
      {preguntar && actual && (
        <div className="mudanza carga-pregunta" role="group" aria-label={T.sesion.conQueLoHaces(actual.nombre)}>
          <p>{T.sesion.conQueLoHaces(actual.nombre)}</p>
          <div className="mudanza-opciones">
            {OPCIONES_DE_LA_PREGUNTA.map((c) => (
              <button key={c} onClick={() => alElegirCarga(c)}>
                {T.sesion.respuestaCarga[c as 'par' | 'total' | 'una']}
              </button>
            ))}
          </div>
          <p className="nota-privada carga-nota">{T.sesion.conQueNota}</p>
        </div>
      )}

        {aDonde !== undefined && (
          <div className="mudanza" role="group" aria-label={T.sesion.deCual(estado.hechas)}>
            <p>{T.sesion.deCual(estado.hechas)}</p>
            <div className="mudanza-opciones">
              {/* El de antes primero: es lo que la app hacía sola hasta hoy,
                  y el orden dice cuál es la respuesta normal. */}
              <button
                onClick={() => {
                  alElegirEjercicio(aDonde);
                  setADonde(undefined);
                }}
              >
                {T.sesion.eranDe(nombreDe(estado.ejercicio))}
              </button>
              <button
                onClick={() => {
                  // El modo que se veía viaja con las series: los números se
                  // escribieron leyendo esa etiqueta.
                  alMudarSeries(aDonde, conCarga ? cargaVista : undefined);
                  setADonde(undefined);
                }}
              >
                {T.sesion.eranDe(nombreDe(aDonde))}
              </button>
            </div>
          </div>
        )}

      {/* UNA SOLA CUENTA DEL BLOQUE: los circulitos (19/9, decisión del
          humano). El "1 de 3" grande decía lo mismo con otra forma, y dos
          lecturas de lo mismo son las que hicieron creer que se habían
          perdido series. El total de la sesión va chico, al lado, y el
          "1 de 3" sigue para quien no ve los puntos. */}
      <div className="bloque-cuenta" aria-live="polite">
        <span className="bloque-puntos" role="img" aria-label={T.sesion.deMeta(estado.hechas, estado.meta)}>
          {Array.from({ length: puntos }).map((_, i) => (
            <span
              key={i}
              className={`punto ${i < estado.hechas ? 'lleno' : ''} ${i >= estado.meta ? 'extra' : ''}`}
            />
          ))}
        </span>
        <span className="palabra">{T.sesion.totalHoy(total)}</span>
      </div>

      {/* EL + OCUPA MEDIA PANTALLA. Era un botón de 44 px que había que
          apuntar, con el teléfono en una mano, transpirado y sin aire — o sea
          en las peores condiciones posibles para apuntar. Es el botón que más
          se toca de toda la app y era el más chico de la pantalla.

          Es un botón enorme y no una capa invisible encima: una capa taparía
          la barra de abajo y el resto de los controles, y el día que algo
          quede debajo nadie va a entender por qué no responde. */}
      {/* CON LA META CUMPLIDA CAMBIA DE TRABAJO. Cerrar el bloque estaba en un
          botón de texto que no se veía, y el botón grande seguía ofreciendo
          sumar cuando ya no era lo que venía. Ahora el lugar más fácil de
          tocar es el paso que sigue, y lleva derecho a la lista.

          SUMAR NO SE PIERDE: pasa al lugar secundario. Pasarse de la meta es
          normal —los puntos extra se dibujan a propósito— y el botón no puede
          dejar de permitirlo solo porque cambió de nombre. */}
      {cumplida ? (
        <button
          className="bloque-mas cerrar"
          onClick={() => {
            alSiguiente();
            setLista(true);
          }}
        >
          <span>{T.sesion.terminarSerie}</span>
        </button>
      ) : (
        <button className="bloque-mas" onClick={alSumar} aria-label={T.inicio.sumarSerie}>
          <span>+</span>
        </button>
      )}

      {debajoDelMas}

      {cumplida && (
        <button className="boton-texto bloque-otra" onClick={alSumar}>
          {T.sesion.sumarOtra}
        </button>
      )}

      {/* LOS DOS SECUNDARIOS EN UN RENGLÓN (19/9): uno debajo del otro eran la
          altura que hacía que Inicio no entrara en una pantalla. */}
      <div className="bloque-pie">
        {/* Quitar una es secundario y va chico: corregir pasa una vez cada
            tantas, sumar pasa doce veces por sesión. */}
        <button
          className="boton-texto bloque-menos"
          onClick={alRestar}
          disabled={estado.hechas === 0}
        >
          {T.inicio.sacarSerie}
        </button>

        {/* Corregir hacia atrás vive DETRÁS de un botón, no a la vista: sumar
            pasa doce veces por sesión y corregir una vez cada tantas. Lo que
            se usa siempre manda en la pantalla. */}
        {(estado.cerrados.length > 0 || estado.hechas > 0) && (
          <button className="boton-texto bloque-lista" onClick={() => setLista(true)}>
            {T.sesion.verLista}
          </button>
        )}
      </div>

      {abriendo && (
        <SelectorEjercicio
          ejercicios={ejercicios}
          valor={estado.ejercicio}
          permiteNinguno
          alElegir={(id) => {
            // La misma regla de antes: con series sin cerrar, se pregunta de
            // cuál eran en vez de decidir por el usuario.
            if (estado.hechas > 0 && id !== estado.ejercicio) setADonde(id);
            else alElegirEjercicio(id);
          }}
          alCerrar={() => setAbriendo(false)}
        />
      )}

      {lista && (
        <ListaDeBloques
          estado={estado}
          ejercicios={ejercicios}
          unidad={unidad}
          anotarPeso={anotarPeso}
          conCarga={conCarga}
          alCorregirPeso={alCorregirPeso}
          alCorregirCarga={alCorregirCarga}
          alCorregirEjercicio={alCorregirEjercicio}
          alTocar={alTocarBloque}
          alCerrar={() => setLista(false)}
        />
      )}
    </div>
  );
}
