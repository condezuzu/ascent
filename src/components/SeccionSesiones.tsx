'use client';

import { useEffect, useState } from 'react';
import { crearCliente } from '@/lib/supabase/client';
import { duracionLinda } from '@/lib/sesiones';
import type { ResumenSesiones } from '@/lib/sesiones';

/**
 * Las duraciones en Stats (§17.7). Promedio y total salen SOLO de las
 * sesiones con duración válida; las que no cuentan se dicen aparte, para que
 * el promedio no parezca calculado sobre más sesiones de las que entran.
 */
export default function SeccionSesiones() {
  const [supabase] = useState(() => crearCliente());
  const [r, setR] = useState<ResumenSesiones | null>(null);

  useEffect(() => {
    supabase.rpc('resumen_sesiones').then(({ data }) => setR(data as ResumenSesiones | null));
  }, [supabase]);

  // Sin migración el RPC no existe, y sin sesiones no hay nada que contar:
  // en los dos casos la sección no aparece en vez de mostrar ceros.
  if (!r || (r.validas === 0 && r.abandonadas === 0 && r.cortas === 0)) return null;

  const fuera: string[] = [];
  if (r.abandonadas > 0) {
    fuera.push(`${r.abandonadas} sin duración`);
  }
  if (r.cortas > 0) {
    fuera.push(`${r.cortas} de menos de 5 min`);
  }

  return (
    <div className="seccion">
      <h3>Sesiones</h3>
      {r.validas > 0 ? (
        <div className="stat-grilla" style={{ marginBottom: 0 }}>
          <div className="stat-celda">
            <div className="valor">{duracionLinda(r.promedio_segundos ?? 0)}</div>
            <div className="etiqueta">Promedio</div>
          </div>
          <div className="stat-celda">
            <div className="valor">{duracionLinda(r.total_segundos)}</div>
            <div className="etiqueta">Total en {r.validas} sesiones</div>
          </div>
        </div>
      ) : (
        <p className="nota-privada" style={{ marginTop: 0 }}>
          Todavía no hay ninguna sesión con duración para promediar.
        </p>
      )}
      {fuera.length > 0 && (
        <p className="nota-privada">
          Fuera del promedio: {fuera.join(' y ')}. Los días sí cuentan.
        </p>
      )}
    </div>
  );
}
