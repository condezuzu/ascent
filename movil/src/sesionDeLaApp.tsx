import { createContext, useContext, type ReactNode } from 'react';

/**
 * LAS DOS COSAS QUE UNA PANTALLA LE PIDE A LA RAÍZ: "cerré sesión, fijate de
 * nuevo" y "esta cuenta no tiene nombre, mandala a elegirlo".
 *
 * POR QUÉ UN CONTEXTO Y NO PROPS (22/9). Antes `App.tsx` dibujaba `Pestanas` y
 * se las pasaba en la mano. Con el router, las pantallas las monta él: entre
 * el layout que sabe de la sesión y la pantalla que necesita avisarle ya no
 * hay una llamada, hay un archivo en una carpeta. Pasarlas por parámetros de
 * ruta sería mandar funciones por una URL, que no se puede y no debería.
 *
 * SON DOS FUNCIONES Y NO EL ESTADO DE LA SESIÓN. Ninguna pantalla pregunta
 * "¿hay sesión?" —si se está dibujando, hay— así que exponer el estado sería
 * ofrecer una respuesta que nadie necesita y que se puede leer mal.
 */
export type SesionDeLaApp = {
  /** Se cerró la sesión, o se borró la cuenta: la raíz vuelve a mirar. */
  salir: () => void;
  /** La cuenta no tiene nombre de usuario todavía. */
  sinNombre: () => void;
};

const Contexto = createContext<SesionDeLaApp>({ salir: () => {}, sinNombre: () => {} });

export function ProveedorDeSesion({ valor, children }: { valor: SesionDeLaApp; children: ReactNode }) {
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSesionDeLaApp(): SesionDeLaApp {
  return useContext(Contexto);
}
