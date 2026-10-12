/**
 * "VOLVER", QUE ANDE SIEMPRE (12/10/2026).
 *
 * `router.back()` pelado no hace NADA cuando no hay pantalla debajo, y eso pasa
 * cada vez que la app arranca por un enlace: la primera pantalla es la del
 * enlace y las pestañas nunca se montaron. Con el link de amigo, quien abría la
 * app cerrada caía en un perfil del que no se podía salir sin matar la app.
 *
 * LA REGLA: ninguna pantalla llama a `router.back()` directo. Todas pasan por
 * acá, que si no hay a dónde volver va a Inicio. Lo exige `test:db`.
 */
type Navegador = { canGoBack: () => boolean; back: () => void; replace: (a: '/') => void };

export function volverOInicio(router: Navegador): void {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}
