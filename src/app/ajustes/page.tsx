'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { crearCliente } from '@/lib/supabase/client';
import { planetaDeDia } from '@/lib/rangos';
import type { Perfil } from '@/lib/tipos';
import FondoEspacial from '@/components/FondoEspacial';
import Avatar from '@/components/Avatar';
import InstalarPWA from '@/components/InstalarPWA';
import Nav from '@/components/Nav';
import PantallaDeslizable from '@/components/PantallaDeslizable';
import BajaDeCuenta from '@/components/ajustes/BajaDeCuenta';
import ComoSeCompara from '@/components/ajustes/ComoSeCompara';
import CorregirDias from '@/components/ajustes/CorregirDias';
import DescansoEntreSeries from '@/components/ajustes/DescansoEntreSeries';
import Descansos from '@/components/ajustes/Descansos';
import Gimnasio from '@/components/ajustes/Gimnasio';
import FotosNuevas from '@/components/ajustes/FotosNuevas';
import MisDatos from '@/components/ajustes/MisDatos';
import NombreUsuario from '@/components/ajustes/NombreUsuario';
import Sesion from '@/components/ajustes/Sesion';
import Sexo from '@/components/ajustes/Sexo';
import Sugerencias from '@/components/ajustes/Sugerencias';
import UnidadPeso from '@/components/ajustes/UnidadPeso';
import { T } from '@/textos';

/**
 * Ajustes es una LISTA de secciones independientes, y cada una vive en su
 * propio archivo (`components/ajustes/`). Acá solo se carga el perfil una vez
 * y se decide el orden. La pantalla crece cada vez que aparece una
 * preferencia nueva: si todas vivieran acá, tocar una obligaría a leer todas.
 */
export default function Ajustes() {
  const [supabase] = useState(() => crearCliente());
  const [perfil, setPerfil] = useState<Perfil | null>(null);

  const cargar = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    // select('*') y no la lista de columnas: si el código llega antes que la
    // migración, pedir una columna que todavía no existe rompe la pantalla
    // entera en vez de dejar la sección nueva en su estado vacío.
    const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    setPerfil(p);
  }, [supabase]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Cada sección pinta su cambio al toque y lo deshace sola si la base lo
  // rechaza; acá solo se mezcla lo que informó.
  const alCambiar = useCallback((parcial: Partial<Perfil>) => {
    setPerfil((p) => (p ? { ...p, ...parcial } : p));
  }, []);

  if (!perfil) {
    return (
      <>
        <FondoEspacial rango={1} vacio esquina="centro" velo={0.7} />
        <div className="pantalla" />
        <Nav />
      </>
    );
  }

  return (
    <>
      <FondoEspacial
        rango={perfil.rango_actual}
        planeta={planetaDeDia(perfil.racha_actual)}
        esquina="arriba-derecha"
        velo={0.74}
      />
      <PantallaDeslizable>
        <div className="titulo-pantalla">{T.ajustes.titulo}</div>

        {/* Todo lo que es "mío" vive en el perfil propio (§9): la foto, qué
            fotos ven los amigos, y la lista de amigos. Acá solo la puerta. */}
        <Link href="/yo" className="seccion" style={{ display: 'block' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Avatar url={perfil.avatar_url} nombre={perfil.username} tam={52} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 500 }}>{perfil.username}</div>
              <div style={{ fontSize: 12, color: 'var(--apagado)', marginTop: 2 }}>
                {T.ajustes.tuPerfil}
              </div>
            </div>
            <span style={{ color: 'var(--apagado)', fontSize: 18 }}>›</span>
          </div>
        </Link>

        <Descansos perfil={perfil} alCambiar={alCambiar} recargar={cargar} />
        <CorregirDias recargar={cargar} />
        <DescansoEntreSeries perfil={perfil} alCambiar={alCambiar} />
        <Gimnasio perfil={perfil} alCambiar={alCambiar} />
        <NombreUsuario perfil={perfil} alCambiar={alCambiar} />
        <FotosNuevas perfil={perfil} alCambiar={alCambiar} />
        <UnidadPeso perfil={perfil} alCambiar={alCambiar} />
        <Sexo perfil={perfil} alCambiar={alCambiar} />
        <Sugerencias userId={perfil.id} />

        <InstalarPWA />

        <MisDatos perfil={perfil} />
        <Sesion userId={perfil.id} />
        {/* Abajo de todo y plegado: acá el párrafo largo SÍ vale, porque
            el que lo abre lo está buscando (§8 del repaso). */}
        <ComoSeCompara />

        <BajaDeCuenta perfil={perfil} />
      </PantallaDeslizable>

      <Nav />
    </>
  );
}
