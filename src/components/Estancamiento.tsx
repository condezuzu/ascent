'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { crearCliente } from '@/lib/supabase/client';
import { plataforma } from '@/plataforma';
import { hoyISO } from '@nucleo/fechas';
import {
  detectar,
  idDeSenal,
  umbralValido,
  type MarcaCruda,
  type Senal,
  type SesionCruda,
} from '@nucleo/estancamiento';
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

// El descarte se guarda en ESTE aparato y no en la cuenta, a diferencia del
// umbral. Es la diferencia entre una preferencia —cada cuánto querés que te
// avisen— y un "ya lo vi": lo segundo no vale una tabla nueva, y lo peor que
// puede pasar es que la señal aparezca una vez más en la computadora.
const CLAVE = 'ascent:estancamiento-visto';

async function leerSilenciadas(): Promise<Record<string, string>> {
  const crudo = await plataforma.almacenamiento.leer(CLAVE);
  if (!crudo) return {};
  try {
    const v = JSON.parse(crudo);
    return v && typeof v === 'object' ? (v as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export default function Estancamiento({ registradoHoy }: { registradoHoy: boolean }) {
  const [senal, setSenal] = useState<Senal | null>(null);
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
      if (!uid) return;

      const [{ data: perfil }, { data: prs }, { data: ses }, { data: cat }, apagadas] =
        await Promise.all([
          supabase.from('profiles').select('*').eq('id', uid).single(),
          supabase.from('prs').select('ejercicio, peso, reps, es_real, fecha'),
          supabase
            .from('sesiones')
            .select('inicio, fin')
            .eq('estado', 'terminada')
            .not('fin', 'is', null),
          supabase.from('ejercicios').select('*'),
          leerSilenciadas(),
        ]);
      if (!vivo || !perfil) return;

      // El interruptor. Si la migración todavía no corrió, la columna no
      // existe y el valor es `undefined`: se trata como prendido, que es el
      // valor por omisión de la base.
      if (perfil.avisos_estancamiento === false) return;

      const sesiones: SesionCruda[] = (ses ?? [])
        .filter((s) => s.fin)
        .map((s) => ({
          fecha: String(s.inicio).slice(0, 10),
          minutos: Math.round(
            (new Date(s.fin as string).getTime() - new Date(s.inicio).getTime()) / 60000
          ),
        }));

      setEjercicios((cat ?? []) as Ejercicio[]);
      setSilenciadas(apagadas);
      setSenal(
        detectar({
          marcas: (prs ?? []).map((m) => ({
            ejercicio: m.ejercicio,
            peso: Number(m.peso),
            reps: m.reps,
            es_real: m.es_real,
            fecha: m.fecha,
          })) as MarcaCruda[],
          sesiones,
          hoy: hoyISO(),
          umbral: umbralValido(perfil.umbral_estancamiento),
          silenciadas: apagadas,
        })
      );
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
    const nuevas = { ...silenciadas, [idDeSenal(senal)]: hoyISO() };
    setSilenciadas(nuevas);
    setSenal(null);
    await plataforma.almacenamiento.guardar(CLAVE, JSON.stringify(nuevas));
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
