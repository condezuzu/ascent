'use client';

import { useRef, useState } from 'react';
import { crearCliente } from '@/lib/supabase/client';
import { miUsuario } from '@/lib/supabase/quienSoy';
import { fechaLinda, hoyISO } from '@nucleo/fechas';
import { estaBloqueado, textoDeBloqueo } from '@nucleo/pendiente';
import { avisarFallo } from '@/lib/cola';
import { prepararFoto } from '@/lib/foto';
import type { ResultadoRegistro } from '@nucleo/tipos';
import { T } from '@nucleo/textos';

/**
 * Hoja de registro del día: con foto opcional.
 *
 * Tiene DOS modos, y el segundo existe por un bug que estuvo desde el
 * principio: una vez registrado, el día quedaba cerrado y no había forma de
 * agregarle la foto ni el peso. Con el cronómetro dejó de ser un caso raro y
 * pasó a ser el normal, porque empezar una sesión registra el día sin foto ni
 * peso (§17.2).
 *
 * - **Sin `logId`**: el día no existe todavía. Se registra con `registrar_dia`.
 * - **Con `logId`**: el día YA está. No se vuelve a registrar —la base lo
 *   rechazaría por unicidad— y solo se cuelga la foto de ese log.
 *
 * Los días de descanso NO se registran acá: se eligen una sola vez en Ajustes
 * como días fijos de la semana.
 *
 * EL PESO NO ESTÁ ACÁ, y estuvo hasta el 27/8/2026. Atarlo a esta hoja lo
 * ataba a haber entrenado: el que se pesaba un domingo y no iba al gimnasio se
 * registraba el día sin querer, y la racha —la única cifra que la app dice que
 * importa— contaba un día que no existió. El peso se anota a la mañana, antes
 * de entrenar o sin entrenar; ahora tiene su propia puerta (`PesoSheet`).
 */
export default function RegistrarSheet({
  racha,
  fecha,
  logId,
  visibilidadDefault = 'privada',
  alCerrar,
  alConfirmar,
}: {
  racha: number;
  fecha?: string; // para corrección manual de días pasados
  logId?: string | null; // presente = el día ya está registrado
  visibilidadDefault?: 'privada' | 'amigos';
  alCerrar: () => void;
  alConfirmar: (r: ResultadoRegistro | null) => void;
}) {
  const supabase = crearCliente();
  const dia = fecha ?? hoyISO();
  const esHoy = dia === hoyISO();
  const yaEsta = !!logId;
  const [foto, setFoto] = useState<File | null>(null);
  // arranca donde el usuario dijo en Ajustes, para no elegir una por una
  const [fotoVisible, setFotoVisible] = useState(visibilidadDefault === 'amigos');
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
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
    const user = await miUsuario(supabase);
    if (!user) return;
    // Se recodifica ANTES de subir. No es por el peso: el archivo de la
    // cámara trae el EXIF, y el EXIF trae las coordenadas GPS de dónde se
    // sacó. Compartir la foto con un amigo compartía la ubicación del
    // gimnasio. Ver `lib/foto.ts`.
    const lista = await prepararFoto(foto);
    // Si no se pudo preparar NO se sube el original: el original es
    // justamente el que tiene las coordenadas.
    if (!lista.ok) return avisarFallo(T.general.falloFotoPreparar);
    const ruta = `${user.id}/${dia}-${Date.now()}.jpg`;
    const { error: errSubida } = await supabase.storage
      .from('fotos')
      .upload(ruta, lista.blob, { contentType: lista.tipo });
    // No va a la cola: el archivo puede pesar megas y guardarlo para después
    // llenaría el teléfono. Pero callarse era peor — creías que la habías
    // subido. El día ya quedó registrado igual, que es lo que importa.
    if (errSubida) return avisarFallo(T.general.falloFoto);
    await supabase.from('photos').insert({
      user_id: user.id,
      log_id: idDelLog,
      storage_path: ruta,
      visibilidad: fotoVisible ? 'amigos' : 'privada',
      es_subida_de_rango: subioRango,
    });
  }

  async function confirmar() {
    setError('');
    setCargando(true);

    // ---- el día YA está: solo se cuelga la foto ----
    if (yaEsta) {
      await subirFoto(logId ?? null, false);
      setCargando(false);
      return alConfirmar(null); // no hay nada que festejar: el día ya contaba
    }

    // ---- el día no existe: se registra ----
    // Solo el origen. `p_es_descanso` y `p_peso` se fueron en la migración
    // 25: eran constantes disfrazadas de parámetro.
    const { data, error: errRpc } = await supabase.rpc('registrar_dia', {
      p_origen: 'manual',
    });

    if (errRpc) {
      setCargando(false);
      if (errRpc.code === '23505') return setError(T.registrar.diaYaRegistrado);
      return setError(T.general.noSePudo);
    }

    // La guarda de las 20 horas por cambio de zona no es un error: el día
    // quedó anotado y entra solo. Se dice con todas las letras, porque un
    // rechazo mudo con la racha en juego se lee como que la app está rota.
    if (estaBloqueado(data)) {
      setCargando(false);
      return setAviso(textoDeBloqueo(data.hasta));
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
        <h2>{yaEsta ? T.registrar.sumarAlDia : esHoy ? T.registrar.diaN(racha + 1) : T.registrar.corregirDia}</h2>
        <p className="sub">{fechaLinda(dia)}</p>

        <div className="campo">
          <label>{T.registrar.foto}</label>
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
            {foto ? foto.name : T.registrar.agregarFoto}
          </button>
          {foto && (
            <button
              type="button"
              className="boton-texto"
              onClick={() => setFotoVisible(!fotoVisible)}
            >
              {fotoVisible ? T.registrar.laVenAmigos : T.registrar.soloLaVesVos}
            </button>
          )}
        </div>

        <button className="boton-solido" onClick={confirmar} disabled={cargando}>
          {cargando ? T.sesion.guardando : yaEsta ? T.general.guardar : T.inicio.registrarDia}
        </button>
        {aviso && <p className="ok-msg">{aviso}</p>}
        {error && <p className="error-msg">{error}</p>}
      </div>
    </>
  );
}
