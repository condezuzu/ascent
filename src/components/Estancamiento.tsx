'use client';

import { useEffect, useState } from 'react';
import { useEsperar } from '@/components/PantallaDeslizable';
import Link from 'next/link';
import { crearCliente } from '@/lib/supabase/client';
import { cargarEstancamiento, descartarSenal } from '@compartido/estancamiento';
import type { Senal } from '@nucleo/estancamiento';
import type { Ejercicio } from '@nucleo/tipos';
import { T } from '@nucleo/textos';

/**
 * EL AVISO DE ESTANCAMIENTO. Uno, o ninguno.
 *
 * DÓNDE VIVE, y no es un detalle: en Stats. Nunca en Inicio —Inicio es la
 * racha y punto—, nunca durante una sesión y nunca el día que registrás. El
 * momento de hacer no es el momento de auditar; el que abrió Stats PIDIÓ que
 * lo evalúen.
 *
 * CÓMO SE DICE: describe, no juzga y no receta. "Llevas 3 meses sin mejorar"
 * es un veredicto; "tu mejor press de banca sigue siendo el de hace 11
 * semanas" es un hecho con fecha. Y lo único que se ofrece es lo único que la
 * app puede hacer —guardar una marca—, no un consejo de entrenamiento.
 *
 * Y PARA LA SESIÓN QUE SE ACHICA NO HAY FRASE: dos filas de números, sin
 * verbo. Nadie se siente reprochado por sus propios números puestos uno al
 * lado del otro, y la conclusión la saca quien mira.
 *
 * LA RACHA NO SE NOMBRA NUNCA ACÁ. Es lo único que funciona sin fricción en
 * toda la app; contaminarla con crítica arruina el motor entero.
 */

// Qué se le pregunta a la base y dónde se anota lo ya visto: en
// `compartido/estancamiento.ts`, que usa también la app nativa.

export default function Estancamiento({ registradoHoy }: { registradoHoy: boolean }) {
  const [senal, setSenal] = useState<Senal | null>(null);
  const [cargado, setCargado] = useState(false);
  // La pantalla no aparece sin esto (19/9): si apareciera antes, esta sección
  // entraría después y empujaría lo de abajo. Ver `useEsperar`.
  useEsperar(cargado);
  const [ejercicios, setEjercicios] = useState<Ejercicio[]>([]);
  const [silenciadas, setSilenciadas] = useState<Record<string, string>>({});

  useEffect(() => {
    let vivo = true;
    (async () => {
      const supabase = crearCliente();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const uid = session?.user?.id;
      const datos = uid ? await cargarEstancamiento(supabase, uid) : null;
      if (!vivo) return;
      if (datos) {
        setEjercicios(datos.ejercicios);
        setSilenciadas(datos.silenciadas);
        setSenal(datos.senal);
      }
      setCargado(true);
    })();
    return () => {
      vivo = false;
    };
  }, []);

  // NUNCA EL DÍA QUE REGISTRÁS. Es la única regla de las tres que esta
  // pantalla puede romper sola: en Stats no hay sesión corriendo, pero sí se
  // puede entrar diez minutos después de haber entrenado.
  if (!senal || registradoHoy) return null;

  async function descartar() {
    if (!senal) return;
    setSenal(null);
    setSilenciadas(await descartarSenal(silenciadas, senal));
  }

  const nombre = (id: string) => ejercicios.find((e) => e.id === id)?.nombre ?? id;

  return (
    <div className="seccion estancamiento">
      {senal.tipo === 'sesion_mas_corta' ? (
        <div className="estancamiento-filas">
          <div>
            <span className="cuando">{T.estancamiento.ultimas4}</span>
            <span className="dato fuerte">{T.estancamiento.dias(senal.ahora.dias)}</span>
            <span className="dato fuerte">{T.estancamiento.minutos(senal.ahora.minutos)}</span>
          </div>
          <div>
            <span className="cuando">{T.estancamiento.anteriores4}</span>
            <span className="dato">{T.estancamiento.dias(senal.antes.dias)}</span>
            <span className="dato">{T.estancamiento.minutos(senal.antes.minutos)}</span>
          </div>
        </div>
      ) : (
        <p>
          {senal.tipo === 'marca_quieta'
            ? T.estancamiento.marcaQuieta(nombre(senal.ejercicio), senal.semanas)
            : T.estancamiento.ejercicioDejado(nombre(senal.ejercicio), senal.semanas)}{' '}
          <Link href="/fuerza" className="enlace">
            {T.estancamiento.anotarUna}
          </Link>
        </p>
      )}
      <button className="boton-texto" onClick={descartar}>
        {T.estancamiento.descartar}
      </button>
    </div>
  );
}
