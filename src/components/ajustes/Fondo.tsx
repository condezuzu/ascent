'use client';

import { useEffect, useState } from 'react';
import { equipoFlojo, guardarPreferenciaFondo, leerPreferenciaFondo } from '@/lib/fondo';
import type { PreferenciaFondo } from '@nucleo/fondo';
import { T } from '@nucleo/textos';

/**
 * EL FONDO: automático, siempre, o nunca.
 *
 * POR QUÉ SE PUEDE ELEGIR y no lo decide la app sola. Medido, el motor cuesta
 * tres segundos de arranque, y en un equipo flojo eso se multiplica. La
 * detección automática apaga el fondo ahí — pero alguien con un teléfono lento
 * puede preferir el fondo igual, y alguien con un equipo bueno puede preferir
 * que la app abra instantánea. Es una preferencia, no un diagnóstico.
 *
 * Y ES DE ESTE APARATO, no de la cuenta: el mismo usuario puede tener un
 * teléfono flojo y una computadora buena, y no quiere la misma respuesta en
 * los dos.
 *
 * Se dice qué detectó el automático, porque "automático" sin decir qué decidió
 * es pedirle a alguien que confíe a ciegas en algo que le cambia la app.
 */
export default function Fondo() {
  const [pref, setPref] = useState<PreferenciaFondo | null>(null);
  const [flojo, setFlojo] = useState<boolean | null>(null);

  useEffect(() => {
    setFlojo(equipoFlojo());
    leerPreferenciaFondo().then(setPref);
  }, []);

  async function elegir(p: PreferenciaFondo) {
    setPref(p);
    await guardarPreferenciaFondo(p);
  }

  // Hasta saber qué está guardado no se dibuja: mostrar "auto" y corregirlo un
  // instante después haría parpadear la opción elegida.
  if (pref === null) return null;

  return (
    <div className="seccion">
      <h3>{T.ajustes.fondo}</h3>
      <div className="selector-vista">
        <button className={pref === 'auto' ? 'activo' : ''} onClick={() => elegir('auto')}>
          {T.ajustes.fondoAuto}
        </button>
        <button className={pref === 'siempre' ? 'activo' : ''} onClick={() => elegir('siempre')}>
          {T.ajustes.fondoSiempre}
        </button>
        <button className={pref === 'nunca' ? 'activo' : ''} onClick={() => elegir('nunca')}>
          {T.ajustes.fondoNunca}
        </button>
      </div>
      <p className="nota-privada">
        {pref === 'auto'
          ? flojo === null
            ? T.ajustes.fondoAutoNoSe
            : flojo
              ? T.ajustes.fondoAutoFlojo
              : T.ajustes.fondoAutoBueno
          : T.ajustes.fondoNota}
      </p>
    </div>
  );
}
