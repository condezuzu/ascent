'use client';

import { useRef, useState } from 'react';
import { crearCliente } from '@/lib/supabase/client';
import { fechaLinda, hoyISO } from '@/lib/fechas';
import type { ResultadoRegistro } from '@/lib/tipos';

// Hoja inferior de registro: día, foto opcional y peso opcional. Nada más.
// Los días de descanso NO se registran acá: se eligen una sola vez en Ajustes
// como días fijos de la semana.
export default function RegistrarSheet({
  racha,
  fecha,
  alCerrar,
  alConfirmar,
}: {
  racha: number;
  fecha?: string; // para corrección manual de días pasados
  alCerrar: () => void;
  alConfirmar: (r: ResultadoRegistro) => void;
}) {
  const supabase = crearCliente();
  const dia = fecha ?? hoyISO();
  const esHoy = dia === hoyISO();
  const [peso, setPeso] = useState('');
  const [foto, setFoto] = useState<File | null>(null);
  const [fotoVisible, setFotoVisible] = useState(false);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [cerrando, setCerrando] = useState(false);
  const inputFoto = useRef<HTMLInputElement>(null);

  // la hoja se va con su animación antes de desmontarse
  function cerrar() {
    if (cargando) return;
    setCerrando(true);
    setTimeout(alCerrar, 200);
  }

  async function confirmar() {
    setError('');
    setCargando(true);
    const pesoNum = peso ? Number(peso.replace(',', '.')) : null;
    if (peso && (isNaN(pesoNum!) || pesoNum! < 20 || pesoNum! > 400)) {
      setCargando(false);
      return setError('Ese peso no parece válido.');
    }

    const { data, error } = await supabase.rpc('registrar_dia', {
      p_fecha: dia,
      p_es_descanso: false,
      p_peso: pesoNum,
    });

    if (error) {
      setCargando(false);
      if (error.code === '23505') return setError('Este día ya está registrado.');
      return setError('No se pudo guardar. Probá de nuevo.');
    }

    const resultado = data as ResultadoRegistro;

    // La foto se sube después de que el día quedó confirmado en la base.
    if (foto) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const ext = foto.name.split('.').pop() || 'jpg';
        const ruta = `${user.id}/${dia}-${Date.now()}.${ext}`;
        const { error: errSubida } = await supabase.storage.from('fotos').upload(ruta, foto);
        if (!errSubida) {
          await supabase.from('photos').insert({
            user_id: user.id,
            log_id: resultado.log_id,
            storage_path: ruta,
            visibilidad: fotoVisible ? 'amigos' : 'privada',
            es_subida_de_rango: resultado.subio_rango,
          });
        }
      }
    }

    setCargando(false);
    alConfirmar(resultado);
  }

  return (
    <>
      <div className={`hoja-fondo ${cerrando ? 'cerrando' : ''}`} onClick={cerrar} />
      <div className={`hoja ${cerrando ? 'cerrando' : ''}`} role="dialog" aria-modal>
        <h2>{esHoy ? `Día ${racha + 1}` : 'Corregir día'}</h2>
        <p className="sub">{fechaLinda(dia)}</p>

        <div className="campo">
          <label>Foto (opcional)</label>
          <input
            ref={inputFoto}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => setFoto(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            className="boton-fantasma"
            onClick={() => inputFoto.current?.click()}
          >
            {foto ? foto.name : 'Agregar foto'}
          </button>
          {foto && (
            <button
              type="button"
              className="boton-texto"
              onClick={() => setFotoVisible(!fotoVisible)}
            >
              {fotoVisible ? 'Visible para amigos ✓' : 'Privada — tocá para compartirla'}
            </button>
          )}
        </div>

        <div className="campo">
          <label>Peso (opcional)</label>
          <input
            type="text"
            inputMode="decimal"
            placeholder="kg"
            value={peso}
            onChange={(e) => setPeso(e.target.value)}
          />
          <p className="nota-privada">El peso solo lo ves vos. Nunca se comparte.</p>
        </div>

        <button className="boton-solido" onClick={confirmar} disabled={cargando}>
          {cargando ? 'Guardando…' : 'Registrar día'}
        </button>
        {error && <p className="error-msg">{error}</p>}
      </div>
    </>
  );
}
