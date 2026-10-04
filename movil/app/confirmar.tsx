import { useEffect } from 'react';
import { useRouter } from 'expo-router';

/**
 * `/confirmar` — EL ENLACE DEL CORREO NO ES UNA PANTALLA.
 *
 * El correo de confirmar la cuenta y el de cambiar la contraseña vuelven a la
 * app por `ascent://confirmar#...`. Los tokens los lee el layout (`enlace.ts`),
 * pero el router TAMBIÉN recibe ese enlace y busca una ruta con ese nombre: sin
 * este archivo caía en su pantalla de "ruta que no existe", en inglés, y ahí
 * quedaba la persona al cerrar la pantalla de la clave nueva.
 *
 * No dibuja nada: vuelve a donde se estaba. Si la app arrancó por el enlace no
 * hay a dónde volver, y va a Inicio.
 */
export default function Confirmar() {
  const router = useRouter();
  useEffect(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, [router]);
  return null;
}
