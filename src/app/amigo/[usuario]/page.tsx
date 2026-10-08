import type { Metadata } from 'next';
import { TIENDA, enlaceALaApp, enlaceDeAmigo, usuarioDeEnlace } from '@nucleo/enlace';
import { T } from '@nucleo/textos';

/**
 * A DÓNDE CAE EL LINK DE INVITACIÓN (8/10/2026).
 *
 * Un `ascent://` no se puede tocar en la mayoría de los chats; un `https` sí.
 * Esta página es el puente: ofrece abrir la app en el perfil de quien invita.
 *
 * NO REDIRIGE SOLA, y es a propósito: sin la app instalada —que es justo el
 * caso de un invitado nuevo— Safari contesta un salto automático a `ascent://`
 * con un cartel de "la dirección no es válida". Con un botón, el que no la
 * tiene ve además dónde bajarla.
 *
 * ES PÚBLICA (`RUTAS_PUBLICAS`) y no consulta nada: no dice si ese nombre
 * existe. Eso lo resuelve la app, con sesión.
 */
type Props = { params: Promise<{ usuario: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { usuario } = await params;
  const nombre = usuarioDeEnlace(enlaceDeAmigo(usuario));
  return { title: nombre ? `${T.social.enlaceTitulo(nombre)}` : 'Ascent' };
}

export default async function Amigo({ params }: Props) {
  const { usuario } = await params;
  // Lo que viene en la URL lo escribió cualquiera: solo pasa si tiene forma de nombre.
  const nombre = usuarioDeEnlace(enlaceDeAmigo(usuario));
  return (
    <main className="pantalla legal">
      <h1>{nombre ? T.social.enlaceTitulo(nombre) : 'Ascent'}</h1>
      {nombre ? (
        <>
          <p>{T.social.enlacePie}</p>
          <p>
            <a className="boton-solido" href={enlaceALaApp(nombre)}>
              {T.social.enlaceAbrir}
            </a>
          </p>
        </>
      ) : (
        <p>{T.social.enlaceMalo}</p>
      )}
      {/* LOS TRES PASOS DEL QUE NO TIENE LA APP, numerados (8/10): el enlace
          no sobrevive a la instalación, así que hay que volver a tocarlo. Si
          eso no queda dicho, el invitado instala, no pasa nada y nadie sabe
          por qué. */}
      {nombre ? (
        <>
          <h2>{T.social.enlaceSinApp}</h2>
          <ol>
            <li>
              <a href={TIENDA}>{T.social.enlacePaso1}</a>.
            </li>
            <li>{T.social.enlacePaso2}</li>
            <li>
              <strong>{T.social.enlacePaso3(nombre)}</strong>
            </li>
          </ol>
          <p>{T.social.enlaceOjo}</p>
        </>
      ) : (
        <p>
          <a href={TIENDA}>{T.social.enlaceTienda}</a>.
        </p>
      )}
    </main>
  );
}
