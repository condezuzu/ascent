import { useContext, useEffect, useState } from 'react';
import { faltaElGlobo, marcarGloboVisto, type Globo } from '@compartido/guia';
import { supabase } from './supabase';
import { cuandoSeCreo, miId } from '@compartido/quienSoy';
import GloboComic from './GloboComic';
import { ContextoVisible } from './pedidoDeFondo';

/**
 * UNA LÍNEA SOBRE LA PANTALLA, la primera vez y nunca más (§10): un globo de cómic
 * (`GloboComic`) que sale de lo que explica. Desde el 15/10 son seis —elegir el
 * ejercicio, el +, el descanso, agregar amigos, el álbum y la rutina— y reemplazan
 * al recorrido. Las cuentas de antes del 15/10 no los ven (ver `faltaElGlobo`).
 *
 * ARRANCA ESCONDIDO y aparece recién cuando se confirmó que falta verlo: si no,
 * el que ya lo cerró lo vería parpadear en cada visita.
 *
 * SOLO EN LA PESTAÑA QUE SE VE: las pestañas quedan montadas, y un globo de una
 * pestaña de atrás se daba por visto sin que nadie lo viera.
 *
 * SE CIERRA Y NO VUELVE, salvo "Volver a ver la guía" desde Ajustes. Con
 * `vistoAlMostrar` queda anotado apenas aparece (el de elegir ejercicio se va con
 * la hoja, sin que nadie lo toque); si no, al tocarlo o cuando `cerrarCuando` se
 * cumple (el del +, con la primera serie).
 */
export default function GloboPrimeraVez({
  cual,
  children,
  colaX,
  alinear,
  subir,
  cerrarCuando = false,
  vistoAlMostrar = false,
}: {
  cual: Globo;
  children: string;
  colaX: number;
  alinear?: 'izquierda' | 'centro' | 'derecha';
  /** El margen de abajo del elemento del que sale (ver `GloboComic`). */
  subir?: number;
  cerrarCuando?: boolean;
  vistoAlMostrar?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const [uid, setUid] = useState('');
  const enPantalla = useContext(ContextoVisible);

  useEffect(() => {
    if (!enPantalla) return;
    let vivo = true;
    (async () => {
      const u = await miId(supabase);
      if (!vivo || !u) return;
      setUid(u);
      // La fecha de alta sale de la sesión guardada: sin viaje.
      if (!(await faltaElGlobo(u, cual, await cuandoSeCreo(supabase))) || !vivo) return;
      setVisible(true);
      if (vistoAlMostrar) void marcarGloboVisto(u, cual);
    })();
    return () => {
      vivo = false;
    };
  }, [cual, vistoAlMostrar, enPantalla]);

  const cerrar = () => {
    // No se espera a que se guarde: el globo se va ya, y que quede anotado es asunto de después.
    if (uid) void marcarGloboVisto(uid, cual);
    setVisible(false);
  };

  useEffect(() => {
    if (cerrarCuando && visible) cerrar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cerrarCuando, visible]);

  if (!visible || !enPantalla) return null;
  return <GloboComic texto={children} alCerrar={cerrar} colaX={colaX} alinear={alinear} subir={subir} testID={`globo-${cual}`} />;
}
