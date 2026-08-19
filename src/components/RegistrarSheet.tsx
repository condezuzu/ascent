'use client';

import { useRef, useState } from 'react';
import { crearCliente } from '@/lib/supabase/client';
import { fechaLinda, hoyISO } from '@/lib/fechas';
import { aKilos, limites, type Unidad } from '@/lib/peso';
import type { ResultadoRegistro } from '@/lib/tipos';

/**
 * Hoja de registro del día: foto opcional y peso opcional.
 *
 * Tiene DOS modos, y el segundo existe por un bug que estuvo desde el
 * principio: una vez registrado, el día quedaba cerrado y no había forma de
 * agregarle la foto ni el peso. Con el cronómetro dejó de ser un caso raro y
 * pasó a ser el normal, porque empezar una sesión registra el día sin foto ni
 * peso (§17.2).
 *
 * - **Sin `logId`**: el día no existe todavía. Se registra con `registrar_dia`.
 * - **Con `logId`**: el día YA está. No se vuelve a registrar —la base lo
 *   rechazaría por unicidad— y solo se agrega lo que falte: la foto se cuelga
 *   de ese log y el peso va por `anotar_peso`.
 *
 * Los días de descanso NO se registran acá: se eligen una sola vez en Ajustes
 * como días fijos de la semana.
 */
export default function RegistrarSheet({
  racha,
  fecha,
  logId,
  unidadPeso = 'kg',
  visibilidadDefault = 'privada',
  alCerrar,
  alConfirmar,
}: {
  racha: number;
  fecha?: string; // para corrección manual de días pasados
  logId?: string | null; // presente = el día ya está registrado
  unidadPeso?: Unidad;
  visibilidadDefault?: 'privada' | 'amigos';
  alCerrar: () => void;
  alConfirmar: (r: ResultadoRegistro | null) => void;
}) {
  const supabase = crearCliente();
  const dia = fecha ?? hoyISO();
  const esHoy = dia === hoyISO();
  const yaEsta = !!logId;
  const [peso, setPeso] = useState('');
  const [foto, setFoto] = useState<File | null>(null);
  // arranca donde el usuario dijo en Ajustes, para no elegir una por una
  const [fotoVisible, setFotoVisible] = useState(visibilidadDefault === 'amigos');
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

  /** Sube la foto y la cuelga del día. Vale para los dos modos. */
  async function subirFoto(idDelLog: string | null, subioRango: boolean) {
    if (!foto) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const ext = foto.name.split('.').pop() || 'jpg';
    const ruta = `${user.id}/${dia}-${Date.now()}.${ext}`;
    const { error: errSubida } = await supabase.storage.from('fotos').upload(ruta, foto);
    if (errSubida) return;
    await supabase.from('photos').insert({
      user_id: user.id,
      log_id: idDelLog,
      storage_path: ruta,
      visibilidad: fotoVisible ? 'amigos' : 'privada',
      es_subida_de_rango: subioRango,
    });
  }

  /** El peso escrito, pasado a kilos y validado. `undefined` = no puso nada. */
  function pesoEnKilos(): number | null | undefined {
    if (!peso) return null;
    const escrito = Number(peso.replace(',', '.'));
    const tope = limites(unidadPeso);
    if (isNaN(escrito) || escrito < tope.min || escrito > tope.max) return undefined;
    // a la base va siempre en kilos: la unidad es solo cómo lo escribe y lo
    // lee el usuario. Dos decimales, que es lo que acepta la columna.
    return Math.round(aKilos(escrito, unidadPeso) * 100) / 100;
  }

  async function confirmar() {
    setError('');
    const kilos = pesoEnKilos();
    if (kilos === undefined) return setError('Ese peso no parece válido.');
    setCargando(true);

    // ---- el día YA está: solo se agrega lo que falte ----
    if (yaEsta) {
      if (kilos !== null) {
        const { error: errPeso } = await supabase.rpc('anotar_peso', {
          p_fecha: dia,
          p_valor: kilos,
        });
        if (errPeso) {
          setCargando(false);
          return setError('No se pudo guardar el peso. Probá de nuevo.');
        }
      }
      await subirFoto(logId ?? null, false);
      setCargando(false);
      return alConfirmar(null); // no hay nada que festejar: el día ya contaba
    }

    // ---- el día no existe: se registra ----
    const { data, error: errRpc } = await supabase.rpc('registrar_dia', {
      p_fecha: dia,
      p_es_descanso: false,
      p_peso: kilos,
    });

    if (errRpc) {
      setCargando(false);
      if (errRpc.code === '23505') return setError('Este día ya está registrado.');
      return setError('No se pudo guardar. Probá de nuevo.');
    }

    const resultado = data as ResultadoRegistro;
    // La foto se sube después de que el día quedó confirmado en la base.
    await subirFoto(resultado.log_id, resultado.subio_rango);

    setCargando(false);
    alConfirmar(resultado);
  }

  return (
    <>
      <div className={`hoja-fondo ${cerrando ? 'cerrando' : ''}`} onClick={cerrar} />
      <div className={`hoja ${cerrando ? 'cerrando' : ''}`} role="dialog" aria-modal>
        <h2>{yaEsta ? 'Sumar al día' : esHoy ? `Día ${racha + 1}` : 'Corregir día'}</h2>
        <p className="sub">{fechaLinda(dia)}</p>

        <div className="campo">
          <label>Foto</label>
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
              {fotoVisible ? 'La ven tus amigos ✓' : 'Solo la ves vos — tocá para compartirla'}
            </button>
          )}
        </div>

        <div className="campo">
          <label>Peso</label>
          <input
            type="text"
            inputMode="decimal"
            placeholder={unidadPeso}
            value={peso}
            onChange={(e) => setPeso(e.target.value)}
          />
        </div>

        <button className="boton-solido" onClick={confirmar} disabled={cargando}>
          {cargando ? 'Guardando…' : yaEsta ? 'Guardar' : 'Registrar día'}
        </button>
        {error && <p className="error-msg">{error}</p>}
      </div>
    </>
  );
}
