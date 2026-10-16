'use client';

// BANCO DE PRUEBAS DE LA PANTALLA DE ENTRADA. No está enlazada desde la app y no
// crea ninguna cuenta: se entra a mano por /galeria/bienvenida.
//
// MONTA LA PANTALLA DE VERDAD (`components/bienvenida/Bienvenida.tsx`): lo que se
// mira acá es lo que ve alguien que abre la app por primera vez. La entrada se ve
// UNA vez en la vida de un usuario, así que sin esto no hay forma de mirarla dos
// veces seguidas. `?pantalla=pesos|llegar|amigo|ranking` arranca en una.
//
// Desde el 15/10 es la entrada nueva (cuatro pantallas y el circulito); la de los
// ocho objetos y el agujero negro se sacó.

import { useEffect, useState } from 'react';
import Bienvenida, { PANTALLAS_DE_LA_ENTRADA } from '@/components/bienvenida/Bienvenida';

type Clave = (typeof PANTALLAS_DE_LA_ENTRADA)[number];

export default function BancoDeBienvenida() {
  const [inicial, setInicial] = useState<Clave | null>(null);
  const [corrida, setCorrida] = useState(0);
  const [salida, setSalida] = useState<string | null>(null);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('pantalla');
    setInicial((PANTALLAS_DE_LA_ENTRADA as readonly string[]).includes(p ?? '') ? (p as Clave) : 'pesos');
  }, []);
  if (!inicial) return null;
  return (
    <>
      <Bienvenida
        key={corrida}
        inicial={inicial}
        alSalir={(destino) => {
          setSalida(destino);
          setCorrida((c) => c + 1);
        }}
      />
      {salida && (
        <div style={{ position: 'fixed', left: 12, bottom: 12, zIndex: 60, color: 'var(--sub)', fontSize: 12, background: 'rgba(0,0,0,.6)', padding: '4px 10px', borderRadius: 999 }}>
          Salió por «{salida}» y volvió a empezar
        </div>
      )}
    </>
  );
}
