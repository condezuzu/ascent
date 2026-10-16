'use client';

// Propuesta: los textos de la ubicación y los botones de Mi gimnasio (15/10).
//
// "Marcar el punto" → "Marcar gimnasio" con un pin dibujado acá (no un emoji);
// "Borrar el punto" → "Borrar ubicación"; "Volver a marcar el punto" → "Volver a
// marcar el gimnasio". Y los botones de Mi gimnasio, que quedaron con la forma de
// antes (cajas sueltas, radio 10), toman la de los controles nuevos de Ajustes: una
// sola caja de radio 12 con separadores finos, como Kilos | Libras.
//
// Fondo: capturas reales. Lo dibujado es solo lo que cambia, encima de un parche
// hecho con el fondo de alrededor.

import type { CSSProperties, ReactNode } from 'react';
import { Banco } from '../Banco';
import { C, Captura, Fila, FUENTE, Marco, Parche, PinGimnasio, Titulito, cajas, type Caja } from '../Captura';

const ANCHO_CAJA = { x: 24, w: 342 };
// Lo que mide un renglón de Kilos | Libras en la captura: 42 de alto.
const RENGLON = 42;

const renglon: CSSProperties = { height: RENGLON, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, color: C.tinta, fontSize: 14, fontFamily: FUENTE };

function CajaAjustes({ arriba, children }: { arriba: number; children: ReactNode }) {
  return (
    <div style={{ position: 'absolute', left: ANCHO_CAJA.x, width: ANCHO_CAJA.w, top: arriba, border: `0.5px solid ${C.lineaFuerte}`, borderRadius: 12, overflow: 'hidden' }}>{children}</div>
  );
}

/** El botón viejo ocupa de su borde de arriba al de abajo; se tapa entero. */
function cajaDeBoton(texto: Caja | null | undefined, alto = 46): Caja {
  const centro = texto ? texto.y + texto.h / 2 : 257;
  return { x: ANCHO_CAJA.x - 2, y: Math.round(centro - alto / 2) - 2, w: ANCHO_CAJA.w + 4, h: alto + 4 };
}

export default function PropuestaUbicacion() {
  const sin = cajas['gimnasio-sin-marcar'] ?? {};
  const con = cajas['gimnasio-marcado'] ?? {};
  const ins = cajas['insistir'] ?? {};
  const botonSin = cajaDeBoton(sin.marcar);
  const botonRe = cajaDeBoton(con.remarcar);
  const botonBo = cajaDeBoton(con.borrar);
  const juntos: Caja = { ...botonRe, h: botonBo.y + botonBo.h - botonRe.y };
  const accion = ins.accion ?? { x: 41, y: 613, w: 308, h: 16 };
  return (
    <Banco
      titulo="La ubicación: textos y botones"
      queEs="Capturas reales de la app (nativa, corriendo en el navegador). Lo único dibujado es lo que cambia."
    >
      <Titulito>Ajustes · Mi gimnasio, sin marcar</Titulito>
      <Fila>
        <Marco rotulo="Hoy">
          <Captura nombre="gimnasio-sin-marcar" />
        </Marco>
        <Marco rotulo="Propuesta" nota="«Marcar gimnasio» con el pin, en la caja de los controles nuevos (radio 12, borde fino, 42 de alto). Se pierde el «estando ahí» del texto de hoy: ¿lo dice la nota de debajo, o lo querés en el botón?">
          <Captura nombre="gimnasio-sin-marcar">
            <Parche nombre="gimnasio-sin-marcar" caja={botonSin} />
            <CajaAjustes arriba={botonSin.y + 2}>
              <div style={renglon}>
                <PinGimnasio tam={16} />
                Marcar gimnasio
              </div>
            </CajaAjustes>
          </Captura>
        </Marco>
      </Fila>

      <Titulito>Ajustes · Mi gimnasio, ya marcado</Titulito>
      <Fila>
        <Marco rotulo="Hoy">
          <Captura nombre="gimnasio-marcado" />
        </Marco>
        <Marco rotulo="Propuesta" nota="Los dos en una sola caja, uno arriba del otro con un separador fino, como Kilos | Libras pero de pie (lado a lado «Volver a marcar el gimnasio» no entra). En la app, lo de abajo subiría 19 px; acá queda donde estaba.">
          <Captura nombre="gimnasio-marcado">
            <Parche nombre="gimnasio-marcado" caja={juntos} />
            <CajaAjustes arriba={juntos.y + 2}>
              <div style={renglon}>
                <PinGimnasio tam={16} />
                Volver a marcar el gimnasio
              </div>
              <div style={{ ...renglon, borderTop: `0.5px solid ${C.lineaFuerte}` }}>Borrar ubicación</div>
            </CajaAjustes>
          </Captura>
        </Marco>
      </Fila>

      <Titulito>Inicio · después de anotar el día a mano</Titulito>
      <Fila>
        <Marco rotulo="Hoy">
          <Captura nombre="insistir" />
        </Marco>
        <Marco rotulo="Propuesta" nota="«Marcar el punto» → «Marcar gimnasio», con el mismo pin. El resto de la tarjeta queda igual.">
          <Captura nombre="insistir">
            <Parche nombre="insistir" caja={{ x: accion.x - 1, y: accion.y - 2, w: accion.w + 2, h: accion.h + 4 }} />
            <div style={{ position: 'absolute', left: accion.x, top: accion.y - 1, height: accion.h + 2, display: 'flex', alignItems: 'center', gap: 8, color: C.sub, fontSize: 12, letterSpacing: 1.6, textTransform: 'uppercase', fontFamily: FUENTE }}>
              <PinGimnasio tam={13} />
              Marcar gimnasio
            </div>
          </Captura>
        </Marco>
      </Fila>

      <Titulito>El pin, en grande</Titulito>
      <div style={{ display: 'flex', gap: 30, alignItems: 'center', color: C.tinta, marginBottom: 30 }}>
        <PinGimnasio tam={64} />
        <PinGimnasio tam={32} />
        <PinGimnasio tam={16} />
        <span style={{ color: 'var(--sub)', fontSize: 13, maxWidth: 360, lineHeight: 1.5 }}>Una gota hueca con su punto, a trazo de 1,4 como los íconos de Foto y Peso. Toma el color del texto que acompaña.</span>
      </div>
    </Banco>
  );
}
