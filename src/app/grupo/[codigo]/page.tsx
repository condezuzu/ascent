import type { Metadata } from 'next';
import { TIENDA, codigoDeGrupo, enlaceDeGrupo } from '@nucleo/enlace';
import { T } from '@nucleo/textos';

/**
 * A DÓNDE CAE EL LINK DEL GRUPO (migración 88), igual que el de amigo: un puente
 * que ofrece abrir la app, sin saltar solo (sin la app, Safari muestra un error).
 * Con la build 8 y su archivo de dominios asociados, el link abre la app directo.
 *
 * ES PÚBLICA (`RUTAS_PUBLICAS`) y no consulta nada: no dice si el grupo existe.
 * Eso lo resuelve la app, con sesión.
 */
type Props = { params: Promise<{ codigo: string }> };

export const metadata: Metadata = { title: T.social.grupoEnlaceTitulo };

export default async function Grupo({ params }: Props) {
  const { codigo: crudo } = await params;
  const codigo = codigoDeGrupo(enlaceDeGrupo(crudo));
  return (
    <main className="pantalla legal">
      <h1>{T.social.grupoEnlaceTitulo}</h1>
      {codigo ? (
        <>
          <p>{T.social.grupoEnlacePie}</p>
          <p>
            <a className="boton-solido" href={`ascent://grupo/${codigo}`}>
              {T.social.enlaceAbrir}
            </a>
          </p>
          <h2>{T.social.enlaceSinApp}</h2>
          <ol>
            <li>
              <a href={TIENDA}>{T.social.enlacePaso1}</a>.
            </li>
            <li>{T.social.enlacePaso2}</li>
            <li>
              <strong>{T.social.grupoEnlacePaso3}</strong>
            </li>
          </ol>
          <p>{T.social.grupoEnlaceOjo}</p>
        </>
      ) : (
        <p>{T.social.grupoEnlaceMalo}</p>
      )}
    </main>
  );
}
