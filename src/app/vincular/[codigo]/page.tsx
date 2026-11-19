import type { Metadata } from 'next';
import { TIENDA } from '@nucleo/enlace';
import { codigoDeVinculo } from '@nucleo/vinculoConMoss';
import { T } from '@nucleo/textos';

/**
 * A DÓNDE CAE EL ENLACE DE MOSS SIN ASCENT (18/11). Moss abre `/vincular/<código>`; con Ascent instalada
 * iOS lo abre en la app y esta página no se ve. Se ve sin Ascent —se ofrece la tienda— o mientras Apple
 * todavía no bajó el `apple-app-site-association` nuevo (hasta un día): para eso, abrir la app a mano.
 * El código vence en minutos. No consulta nada y es pública.
 */
export const metadata: Metadata = { title: T.moss.vinculaTitulo };

type Props = { params: Promise<{ codigo: string }> };

export default async function Vincular({ params }: Props) {
  // Lo que viene en la URL lo escribió cualquiera: solo pasa si tiene forma de código.
  const codigo = codigoDeVinculo((await params).codigo);
  return (
    <main className="pantalla legal">
      <h1>{T.moss.vinculaTitulo}</h1>
      {codigo && (
        <p>
          <a className="boton-solido" href={`ascent://vincular/${codigo}`}>
            {T.moss.abrirAscent}
          </a>
        </p>
      )}
      <p>{T.moss.webSinAscent}</p>
      <p>
        <a href={TIENDA}>{T.moss.conseguirAscent}</a>
      </p>
      <p>{T.moss.webDespues}</p>
    </main>
  );
}
