'use client';

import { useState } from 'react';
import { crearCliente } from '@/lib/supabase/client';
import { hoyISO } from '@nucleo/fechas';
import { aKilos, limites, type Unidad } from '@nucleo/peso';
import { T } from '@nucleo/textos';

/**
 * Anotar el peso corporal desde donde hace falta, sin registrar un día.
 *
 * Existe porque la pantalla decía "se anota al registrar un día" y en ese
 * momento eso ya no se podía: quien había registrado hoy y nunca había
 * anotado su peso quedaba sin DOTS hasta el día siguiente (§16.4).
 *
 * Va por RPC (`anotar_peso`): `weights` sigue siendo de solo lectura para el
 * cliente, así que el peso no se puede escribir en la fecha de otro.
 */
export default function AnotarPeso({
  unidad,
  alGuardar,
}: {
  unidad: Unidad;
  alGuardar: () => void;
}) {
  const [supabase] = useState(() => crearCliente());
  const [valor, setValor] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  async function guardar() {
    setError('');
    const escrito = Number(valor.replace(',', '.'));
    const tope = limites(unidad);
    if (!valor || isNaN(escrito) || escrito < tope.min || escrito > tope.max) {
      return setError(T.peso.noDa);
    }
    setGuardando(true);
    // a la base va siempre en kilos: la unidad es solo cómo lo escribe y lo
    // lee el usuario. Dos decimales, que es lo que acepta la columna.
    const { error: err } = await supabase.rpc('anotar_peso', {
      p_valor: Math.round(aKilos(escrito, unidad) * 100) / 100,
    });
    setGuardando(false);
    if (err) return setError(T.general.noSePudo);
    setValor('');
    alGuardar();
  }

  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <input
          type="text"
          inputMode="decimal"
          placeholder={T.peso.placeholder(unidad)}
          value={valor}
          onChange={(e) => setValor(e.target.value)}
        />
        <button
          className="boton-fantasma"
          style={{ width: 'auto', flex: 'none', padding: '13px 18px' }}
          onClick={guardar}
          disabled={guardando}
        >
          {guardando ? '…' : T.peso.anotar}
        </button>
      </div>
      <p className="nota-privada">{T.peso.privado}</p>
      {error && <p className="error-msg">{error}</p>}
    </>
  );
}
