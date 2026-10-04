'use client';

import { useRouter } from 'next/navigation';
import FondoEspacial from '@/components/FondoEspacial';
import { T } from '@nucleo/textos';

/**
 * EL ENLACE DEL CORREO NO SIRVIÓ, Y SE DICE (4/10).
 *
 * El enlace de recuperar la contraseña solo se puede canjear en el navegador
 * que lo pidió: ahí quedó guardado el verificador. Abierto en otro —el caso de
 * todos los días es la web instalada en el iPhone, que pide desde la app y abre
 * el correo en Safari— el canje falla, y antes eso terminaba en la pantalla de
 * entrada sin una palabra.
 *
 * Vive bajo `/auth` porque esas rutas son públicas: acá se llega sin sesión.
 */
export default function EnlaceVencido() {
  const router = useRouter();
  return (
    <>
      <FondoEspacial rango={1} vacio esquina="centro" velo={0.55} />
      <div className="centrado">
        <div className="marca-app">{T.entrar.marca}</div>
        <p style={{ color: 'var(--sub)', fontSize: 14, textAlign: 'center', lineHeight: 1.6 }}>
          {T.clave.enlaceVencido}
          <br />
          {T.clave.enlaceVencidoPie}
        </p>
        <button className="boton-solido" style={{ marginTop: 20 }} onClick={() => router.push('/login')}>
          {T.clave.irAEntrar}
        </button>
      </div>
    </>
  );
}
