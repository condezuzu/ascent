import { useEffect, useState } from 'react';
import { faltaElGlobo, marcarGloboVisto, type Globo } from '@compartido/guia';
import { supabase } from './supabase';
import { miId } from '@compartido/quienSoy';
import Globito from './Globito';

/**
 * UNA LÍNEA SOBRE LA PANTALLA, la primera vez y nunca más (§10). Se dibuja con
 * el globito de siempre (`Globito`): flota, no empuja nada, y un toque lo saca.
 *
 * QUEDAN TRES: contar series adentro de una sesión, que las fotos del perfil
 * son privadas, y quién está entrenando. El resto lo presenta el recorrido.
 *
 * ARRANCA ESCONDIDO y aparece recién cuando se confirmó que falta verlo: si no,
 * el que ya lo cerró lo vería parpadear en cada visita.
 *
 * SE CIERRA Y NO VUELVE, salvo "ver la guía de nuevo" desde Ajustes.
 */
export default function GloboPrimeraVez({
  cual,
  children,
  cerrarCuando = false,
}: {
  cual: Globo;
  children: string;
  /** Se cierra solo —y queda visto— cuando la cosa que explica ya se usó (el de las series, con el primer `+`). */
  cerrarCuando?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const [uid, setUid] = useState('');

  useEffect(() => {
    let vivo = true;
    (async () => {
      const u = await miId(supabase);
      if (!vivo || !u) return;
      setUid(u);
      if ((await faltaElGlobo(u, cual)) && vivo) setVisible(true);
    })();
    return () => {
      vivo = false;
    };
  }, [cual]);

  const cerrar = () => {
    // No se espera a que se guarde: el globo se va ya, y que quede anotado es asunto de después.
    if (uid) void marcarGloboVisto(uid, cual);
    setVisible(false);
  };

  useEffect(() => {
    if (cerrarCuando && visible) cerrar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cerrarCuando, visible]);

  if (!visible) return null;
  return <Globito texto={children} alCerrar={cerrar} testID={`globo-${cual}`} />;
}
