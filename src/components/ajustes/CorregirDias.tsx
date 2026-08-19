'use client';

import { useState } from 'react';
import { crearCliente } from '@/lib/supabase/client';
import { enDias, hoyISO } from '@/lib/fechas';
import CalendarioCorregir from '@/components/CalendarioCorregir';

export default function CorregirDias({ recargar }: { recargar: () => void }) {
  const [supabase] = useState(() => crearCliente());
  const [recalculando, setRecalculando] = useState(false);
  const [aviso, setAviso] = useState('');

  // El RPC recalcula y aplica la pérdida en la misma transacción: el número
  // que mostramos acá es el final, no rebota al recargar.
  async function recalcular() {
    setRecalculando(true);
    setAviso('');
    const { data, error } = await supabase.rpc('recalcular_desde_cero', { p_hoy: hoyISO() });
    setRecalculando(false);
    if (error) return setAviso('No se pudo recalcular. Probá de nuevo.');
    const r = data as { racha: number; perdida: boolean };
    setAviso(
      r.perdida
        ? `Tu historial da ${enDias(r.racha)}: está cortado, así que se aplicó el descuento.`
        : `Listo: ${enDias(r.racha)}.`
    );
    recargar();
  }

  return (
    <div className="seccion">
      <h3>Corregir días</h3>
      <CalendarioCorregir alCambiar={recargar} />
      <button
        className="boton-texto"
        onClick={recalcular}
        disabled={recalculando}
        style={{ marginTop: 4 }}
      >
        {recalculando ? 'Recalculando…' : 'Recalcular racha desde el historial'}
      </button>
      {aviso && <p className="ok-msg">{aviso}</p>}
    </div>
  );
}
