'use client';

import { useState } from 'react';
import { crearCliente } from '@/lib/supabase/client';
import { miUsuario } from '@/lib/supabase/quienSoy';
import { hoyISO } from '@nucleo/fechas';
import { aKilos, deKilos, type Unidad } from '@nucleo/peso';
import { redondear, unRM } from '@nucleo/fuerza';
import type { Ejercicio } from '@nucleo/tipos';
import { T } from '@nucleo/textos';

/**
 * Hoja para cargar una marca. Se guarda lo que el usuario LEVANTÓ, no el 1RM:
 * el 1RM lo deriva la base (§16.4).
 *
 * Las dos formas de cargar son un solo selector arriba, y no un campo de
 * repeticiones más una casilla de "es real": un 1RM real ES una repetición,
 * así que las dos cosas serían el mismo dato pidiéndose dos veces —y podrían
 * contradecirse—.
 */
export default function CargarMarca({
  ejercicios,
  unidad,
  inicial,
  alCerrar,
  alGuardar,
}: {
  ejercicios: Ejercicio[];
  unidad: Unidad;
  inicial?: string;
  alCerrar: () => void;
  alGuardar: () => void;
}) {
  const [supabase] = useState(() => crearCliente());
  const [ejercicio, setEjercicio] = useState(inicial ?? ejercicios[0]?.id ?? '');
  const [unaVez, setUnaVez] = useState(true);
  const [peso, setPeso] = useState('');
  const [reps, setReps] = useState('5');
  const [fecha, setFecha] = useState(hoyISO());
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [cerrando, setCerrando] = useState(false);

  const tope = { min: deKilos(1, unidad), max: deKilos(600, unidad) };

  function cerrar() {
    if (guardando) return;
    setCerrando(true);
    setTimeout(alCerrar, 200);
  }

  async function guardar() {
    setError('');
    const escrito = Number(peso.replace(',', '.'));
    if (!peso || isNaN(escrito) || escrito < tope.min || escrito > tope.max) {
      return setError(T.peso.noDa);
    }
    const r = unaVez ? 1 : Number(reps);
    if (!Number.isInteger(r) || r < 1 || r > 20) {
      return setError(T.marca.vecesFuera);
    }
    if (fecha > hoyISO()) return setError(T.marca.todaviaNo);

    setGuardando(true);
    const user = await miUsuario(supabase);
    if (!user) {
      setGuardando(false);
      return setError(T.marca.sesionCerrada);
    }
    // a la base va siempre en kilos: la unidad es solo cómo lo escribe y lo
    // lee el usuario, igual que el peso corporal
    const { error: err } = await supabase.from('prs').insert({
      user_id: user.id,
      ejercicio,
      peso: Math.round(aKilos(escrito, unidad) * 100) / 100,
      reps: r,
      es_real: unaVez,
      fecha,
    });
    setGuardando(false);
    if (err) return setError(T.general.noSePudo);
    alGuardar();
  }

  // los tres del DOTS primero y aparte: son los únicos que cuentan para el
  // número, y mezclarlos con los otros treinta hace que nadie los distinga
  const delDots = ejercicios.filter((e) => e.cuenta_dots);
  const resto = ejercicios.filter((e) => !e.cuenta_dots);
  const grupos = [...new Set(resto.map((e) => e.grupo))];

  return (
    <>
      <div className={`hoja-fondo ${cerrando ? 'cerrando' : ''}`} onClick={cerrar} />
      <div className={`hoja ${cerrando ? 'cerrando' : ''}`} role="dialog" aria-modal>
        <h2>{T.marca.titulo}</h2>
        <p className="sub">{T.marca.sub}</p>

        <div className="campo">
          <label>{T.marca.ejercicio}</label>
          <select value={ejercicio} onChange={(e) => setEjercicio(e.target.value)}>
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
        </div>

        <div className="campo">
          <label>{T.marca.cuantasVeces}</label>
          <div className="selector-vista" style={{ marginBottom: 0 }}>
            <button className={unaVez ? 'activo' : ''} onClick={() => setUnaVez(true)}>
              {T.marca.deUna}
            </button>
            <button className={!unaVez ? 'activo' : ''} onClick={() => setUnaVez(false)}>
              {T.marca.variasVeces}
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <div className="campo" style={{ flex: 1 }}>
            <label>{T.marca.peso}</label>
            <input
              type="text"
              inputMode="decimal"
              placeholder={unidad}
              value={peso}
              onChange={(e) => setPeso(e.target.value)}
            />
          </div>
          {!unaVez && (
            <div className="campo" style={{ width: 110 }}>
              <label>{T.marca.veces}</label>
              <input
                type="text"
                inputMode="numeric"
                value={reps}
                onChange={(e) => setReps(e.target.value.replace(/\D/g, ''))}
              />
            </div>
          )}
        </div>

        {!unaVez && (
          <p className="nota-privada" style={{ marginTop: -6, marginBottom: 14 }}>
            {peso && Number(peso.replace(',', '.')) > 0 && Number(reps) > 0
              ? T.marca.comoMaximo(
                  String(redondear(unRM(Number(peso.replace(',', '.')), Number(reps), false))),
                  unidad
                )
              : T.marca.sacamosDeUna}
            {Number(reps) === 1 && T.marca.unaVezNoSaca}
            {Number(reps) > 12 && T.marca.muchasFloja}
          </p>
        )}

        <div className="campo">
          <label>{T.marca.cuando}</label>
          <input
            type="date"
            value={fecha}
            max={hoyISO()}
            onChange={(e) => setFecha(e.target.value)}
          />
        </div>

        <button className="boton-solido" onClick={guardar} disabled={guardando}>
          {guardando ? T.sesion.guardando : T.marca.anotar}
        </button>
        {error && <p className="error-msg">{error}</p>}
      </div>
    </>
  );
}
