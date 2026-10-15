/**
 * EL ARCHIVO QUE LE DICE A iOS QUÉ LINKS ABRE LA APP (15/10/2026). Con esto y el
 * permiso de dominios asociados de la build 8, un link https de amigo
 * (`/amigo/<nombre>`) abre la app directo en vez de la web. Sin la build 8 no
 * cambia nada: el link sigue abriendo la web.
 *
 * Apple lo baja desde su propia red y lo cachea: tiene que estar publicado antes
 * de probar la build. Va como ruta y no como archivo suelto para salir con
 * `application/json`, que un archivo sin extensión no trae.
 */
export const dynamic = 'force-static';

const APP = 'XF9N8X9KJG.uy.ascent.app';

export function GET() {
  return Response.json({
    applinks: {
      details: [
        // `appIDs` + `components` es la forma de iOS 13 en adelante; `appID` + `paths`, la de antes.
        { appIDs: [APP], components: [{ '/': '/amigo/*', comment: 'Link de amigo' }] },
        { appID: APP, paths: ['/amigo/*'] },
      ],
    },
  });
}
