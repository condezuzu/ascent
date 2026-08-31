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

  return (
    <div className="seccion">
      <h3>{T.ajustes.fondo}</h3>
      {/* SE DIBUJA SIEMPRE, aunque todavía no sepamos qué está elegido.
          Devolver `null` mientras se lee la preferencia parecía prolijo y
          estaba mal: la sección aparecía tarde y EMPUJABA todo lo de abajo.
          En una pantalla llena de plegables eso significa que apuntás a uno y
          tocás otro — y lo agarró `capturas`, que no pudo hacer clic en "Cómo
          se compara" porque se le movía debajo del dedo.

          Mientras no se sabe, ninguno queda marcado: mostrar "auto" y
          corregirlo un instante después sería decir algo falso, aunque sea por
          un cuadro. */}
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
        {pref === null
          ? T.ajustes.fondoNota
          : pref === 'auto'
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
