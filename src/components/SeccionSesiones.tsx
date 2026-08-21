'use client';

import { useEffect, useState } from 'react';
import { crearCliente } from '@/lib/supabase/client';
import { duracionLinda } from '@/lib/sesiones';
import { agruparPorDia, etiquetaDeDia, type DiaConSesiones } from '@/lib/dias';
import type { ResumenSesiones } from '@/lib/sesiones';

/**
 * Las duraciones en Stats (§17.7). Promedio y total salen SOLO de las
 * sesiones con duración válida; las que no cuentan se dicen aparte, para que
 * el promedio no parezca calculado sobre más sesiones de las que entran.
 */
export default function SeccionSesiones() {
  const [supabase] = useState(() => crearCliente());
  const [r, setR] = useState<ResumenSesiones | null>(null);
  const [dias, setDias] = useState<DiaConSesiones[]>([]);

  useEffect(() => {
    (async () => {
      // El resumen va PRIMERO y no en paralelo: adentro cierra las sesiones
      // vencidas, así que después de esperarlo la lista de abajo ya no
      // muestra una sesión de anteayer todavía "corriendo".
      const { data } = await supabase.rpc('resumen_sesiones');
      setR(data as ResumenSesiones | null);

      // 40 filas para llegar a siete días holgado aunque haya varias por día.
      // La fecha sale de `logs`, que es la que decide a qué día pertenece la
      // sesión; derivarla del `inicio` acá la calcularía de nuevo, con la
      // zona del teléfono, que es justo lo que puede haber cambiado.
      const { data: filas } = await supabase
        .from('sesiones')
        .select('inicio, fin, estado, series, logs(fecha)')
        .order('inicio', { ascending: false })
        .limit(40);
      setDias(agruparPorDia(filas ?? []).slice(0, 7));
    })();
  }, [supabase]);

  // Sin migración el RPC no existe, y sin sesiones no hay nada que contar:
  // en los dos casos la sección no aparece en vez de mostrar ceros.
  if (!r || (r.validas === 0 && r.abandonadas === 0 && r.cortas === 0)) return null;

  const fuera: string[] = [];
  if (r.abandonadas > 0) fuera.push(`${r.abandonadas} sin duración`);
  if (r.cortas > 0) fuera.push(`${r.cortas} de menos de 5 min`);

  // La barra es proporcional al día más largo de los siete, no a un tope
  // fijo: lo que se compara es una semana contra sí misma.
  const techo = Math.max(1, ...dias.map((d) => d.segundos));

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
        <p className="nota-privada" style={{ marginTop: 0 }}>Todavía ninguna con duración.</p>
      )}

      {dias.length > 0 && (
        <div className="dias-sesion">
          {dias.map((d) => (
            <div key={d.fecha} className="dia-sesion">
              <span className="dato">{etiquetaDeDia(d.fecha)}</span>
              <span className="barra">
                <i style={{ width: `${(d.segundos / techo) * 100}%` }} />
              </span>
              <span className="dato tiempo">
                {d.segundos > 0 ? duracionLinda(d.segundos) : '—'}
                {d.cuantas > 1 && <em>×{d.cuantas}</em>}
              </span>
            </div>
          ))}
        </div>
      )}

      {fuera.length > 0 && (
        <p className="nota-privada">Fuera del promedio: {fuera.join(', ')}. Los días cuentan igual.</p>
      )}
    </div>
  );
}
