'use client';

import { useState } from 'react';
import { crearCliente } from '@/lib/supabase/client';
import { hoyISO } from '@/lib/fechas';
import { aKilos, deKilos, type Unidad } from '@/lib/peso';
import { redondear, unRM } from '@/lib/fuerza';
import type { Ejercicio } from '@/lib/tipos';

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
      return setError('Ese peso no parece válido.');
    }
    const r = unaVez ? 1 : Number(reps);
    if (!Number.isInteger(r) || r < 1 || r > 20) {
      return setError('Las repeticiones van de 1 a 20.');
    }
    if (fecha > hoyISO()) return setError('Todavía no la levantaste.');

    setGuardando(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setGuardando(false);
      return setError('Se cerró la sesión. Volvé a entrar.');
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
    if (err) return setError('No se pudo guardar. Probá de nuevo.');
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
        <h2>Cargar una marca</h2>
        <p className="sub">No hace falta que sea de hoy. Queda con su fecha.</p>

        <div className="campo">
          <label>Ejercicio</label>
          <select value={ejercicio} onChange={(e) => setEjercicio(e.target.value)}>
            <optgroup label="Cuentan para el DOTS">
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
          <label>Cómo lo cargás</label>
          <div className="selector-vista" style={{ marginBottom: 0 }}>
            <button className={unaVez ? 'activo' : ''} onClick={() => setUnaVez(true)}>
              Lo levanté una vez
            </button>
            <button className={!unaVez ? 'activo' : ''} onClick={() => setUnaVez(false)}>
              Lo estimo
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <div className="campo" style={{ flex: 1 }}>
            <label>Peso</label>
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
              <label>Repes</label>
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
              ? `Da un 1RM estimado de ${redondear(
                  unRM(Number(peso.replace(',', '.')), Number(reps), false)
                )} ${unidad}.`
              : 'Se estima el 1RM desde las repeticiones.'}
            {Number(reps) === 1 && ' Con una repetición no hay nada que estimar: es el peso.'}
            {Number(reps) > 12 && ' Arriba de 12 repeticiones la estimación se vuelve muy floja.'}
          </p>
        )}

        <div className="campo">
          <label>Cuándo</label>
          <input
            type="date"
            value={fecha}
            max={hoyISO()}
            onChange={(e) => setFecha(e.target.value)}
          />
        </div>

        <button className="boton-solido" onClick={guardar} disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar marca'}
        </button>
        {error && <p className="error-msg">{error}</p>}
      </div>
    </>
  );
}
