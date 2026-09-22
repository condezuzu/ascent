'use client';

import { useState } from 'react';
import { crearCliente } from '@/lib/supabase/client';
import { borrarPeso, corregirPeso } from '@compartido/peso';
import { useVersion } from '@/lib/version';
import { disponible } from '@nucleo/esquema';
import { fechaCorta } from '@nucleo/fechas';
import { aKilos, conComa, deKilos, limites, type Unidad } from '@nucleo/peso';
import { T } from '@nucleo/textos';

/**
 * LO QUE ANOTASTE, con forma de arreglarlo.
 *
 * POR QUÉ APARECIÓ ESTO (22/9). El peso se podía anotar y nada más: un 82,4
 * donde iba 84,2 se quedaba para siempre torciendo la tendencia, que es lo
 * único que ese dato hace. La tabla solo tiene lectura para el cliente, así
 * que hasta la migración 45 no había forma — ni para el dueño de la cuenta.
 *
 * SE MUESTRAN POCOS. La tendencia está arriba, en el gráfico; esto es para
 * arreglar lo de estos días, no para leer el historial. Seis entran en una
 * pantalla sin empujar nada.
 *
 * BORRAR PREGUNTA, y no por costumbre: anotar solo escribe HOY, así que borrar
 * el peso de un día viejo no se puede deshacer. Corregir no pregunta: se
 * escribe encima y se vuelve a corregir.
 */
const CUANTOS = 6;

export default function ListaDePesos({ pesos, unidad, alCambiar }: { pesos: { fecha: string; valor: number }[]; unidad: Unidad; alCambiar: () => void }) {
  const [supabase] = useState(() => crearCliente());
  const version = useVersion();
  const [corrigiendo, setCorrigiendo] = useState<string | null>(null);
  const [borrando, setBorrando] = useState<string | null>(null);
  const [valor, setValor] = useState('');
  const [error, setError] = useState('');

  // Sin la migración no hay dónde escribir: la lista no aparece, en vez de
  // aparecer con dos botones que darían error.
  if (!disponible('corregirPeso', version) || pesos.length === 0) return null;

  async function guardar(fecha: string) {
    setError('');
    const escrito = Number(valor.replace(',', '.'));
    const tope = limites(unidad);
    if (!valor || isNaN(escrito) || escrito < tope.min || escrito > tope.max) return setError(T.peso.noDa);
    const r = await corregirPeso(supabase, version, fecha, Math.round(aKilos(escrito, unidad) * 100) / 100);
    if (r === false) return setError(T.general.noSePudo);
    if (r === null) return setError(T.peso.noSeCorrigio);
    setCorrigiendo(null);
    setValor('');
    alCambiar();
  }

  async function borrar(fecha: string) {
    setError('');
    const r = await borrarPeso(supabase, version, fecha);
    if (!r) return setError(T.general.noSePudo);
    setBorrando(null);
    alCambiar();
  }

  return (
    <div className="lista-pesos">
      <p className="rotulo">{T.peso.anotados}</p>
      {[...pesos]
        .sort((a, b) => b.fecha.localeCompare(a.fecha))
        .slice(0, CUANTOS)
        .map((p) => (
          <div className="fila" key={p.fecha}>
            <span className="cuando">{fechaCorta(p.fecha)}</span>

            {corrigiendo === p.fecha ? (
              <>
                <input
                  type="text"
                  inputMode="decimal"
                  autoFocus
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  placeholder={T.peso.placeholder(unidad)}
                />
                <button className="boton-texto" onClick={() => guardar(p.fecha)}>
                  {T.general.guardar}
                </button>
                <button className="boton-texto" onClick={() => setCorrigiendo(null)}>
                  {T.general.cancelar}
                </button>
              </>
            ) : borrando === p.fecha ? (
              <>
                <span className="pregunta">{T.peso.borrarSeguro}</span>
                <button className="boton-texto peligro" onClick={() => borrar(p.fecha)}>
                  {T.peso.borrarSi}
                </button>
                <button className="boton-texto" onClick={() => setBorrando(null)}>
                  {T.general.cancelar}
                </button>
              </>
            ) : (
              <>
                <span className="valor">
                  {conComa(deKilos(p.valor, unidad).toFixed(1))} {unidad}
                </span>
                <button
                  className="boton-texto"
                  onClick={() => {
                    setBorrando(null);
                    setCorrigiendo(p.fecha);
                    setValor(conComa(deKilos(p.valor, unidad).toFixed(1)));
                  }}
                >
                  {T.peso.corregir}
                </button>
                <button
                  className="boton-texto"
                  onClick={() => {
                    setCorrigiendo(null);
                    setBorrando(p.fecha);
                  }}
                >
                  {T.peso.borrar}
                </button>
              </>
            )}
          </div>
        ))}
      {error && <p className="error-msg">{error}</p>}
    </div>
  );
}
