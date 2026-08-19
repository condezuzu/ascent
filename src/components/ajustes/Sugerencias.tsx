'use client';

import { useState } from 'react';
import { crearCliente } from '@/lib/supabase/client';

export default function Sugerencias({ userId }: { userId: string }) {
  const [supabase] = useState(() => crearCliente());
  const [texto, setTexto] = useState('');
  const [enviado, setEnviado] = useState(false);

  async function mandar() {
    if (!texto.trim()) return;
    const { error } = await supabase.from('feedback').insert({
      user_id: userId,
      texto: texto.trim(),
      tipo: 'idea',
      version_app: '0.1.0',
      plataforma: navigator.userAgent.includes('Android')
        ? 'android'
        : /iPhone|iPad/.test(navigator.userAgent)
          ? 'ios'
          : 'web',
      pantalla_origen: 'ajustes',
    });
    if (!error) {
      setTexto('');
      setEnviado(true);
      setTimeout(() => setEnviado(false), 3500);
    }
  }

  return (
    <div className="seccion">
      <h3>Sugerencias</h3>
      <textarea
        rows={3}
        placeholder="¿Algo anda mal? ¿Se te ocurrió algo? Contá acá."
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
      />
      <button className="boton-fantasma" style={{ marginTop: 8 }} onClick={mandar}>
        Mandar
      </button>
      {enviado && <p className="ok-msg">Gracias por tu opinión, la leo yo mismo.</p>}
    </div>
  );
}
