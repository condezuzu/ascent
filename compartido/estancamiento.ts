import type { Cliente } from '@cliente';
import { plataforma } from '@plataforma';
import { aISO, hoyISO } from '@nucleo/fechas';
import { detectar, idDeSenal, umbralValido, type MarcaCruda, type Senal, type SesionCruda } from '@nucleo/estancamiento';
import type { Ejercicio } from '@nucleo/tipos';

/**
 * EL AVISO DE ESTANCAMIENTO, pedido una sola vez para las dos apps.
 *
 * Vivía adentro del componente de la web; se sacó acá al portar Stats a la app
 * nativa (18/9), por la misma razón que Ranking y el Álbum: copiado, se separa.
 * La cuenta de si hay una señal ya era del núcleo (`nucleo/estancamiento.ts`);
 * esto es lo que se le pregunta a la base para hacerla, y lo que ya se vio.
 */

// El descarte se guarda en ESTE aparato y no en la cuenta, a diferencia del
// umbral. Es la diferencia entre una preferencia —cada cuánto querés que te
// avisen— y un "ya lo vi": lo segundo no vale una tabla nueva, y lo peor que
// puede pasar es que la señal aparezca una vez más en el otro aparato.
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

export type DatosDeEstancamiento = {
  senal: Senal;
  ejercicios: Ejercicio[];
  silenciadas: Record<string, string>;
};

/** La señal que hay, o `null` si no hay ninguna (o el aviso está apagado). */
/**
 * EL DÍA DE UNA SESIÓN ES EL DEL RELOJ DE LA PERSONA (4/10). `inicio` viene en
 * UTC, y quedarse con los primeros diez caracteres fechaba un día después a
 * toda sesión empezada de noche (desde las 21 en Uruguay): caía en la ventana
 * equivocada de "últimas 4 semanas".
 */
export function sesionesCrudas(ses: { inicio: string; fin: string | null }[]): SesionCruda[] {
  return ses
    .filter((s) => s.fin)
    .map((s) => ({
      fecha: aISO(new Date(s.inicio)),
      minutos: Math.round((new Date(s.fin as string).getTime() - new Date(s.inicio).getTime()) / 60000),
    }));
}

export async function cargarEstancamiento(supabase: Cliente, uid: string): Promise<DatosDeEstancamiento | null> {
  const [{ data: perfil }, { data: prs }, { data: ses }, { data: cat }, silenciadas] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', uid).single(),
    // SOLO LAS PROPIAS. La tabla de marcas deja leer las de los amigos (el
    // ranking las usa), y sin este filtro el detector decía "tu mejor
    // sentadilla sigue siendo la de hace ocho semanas" mirando la marca de
    // otra persona.
    supabase.from('prs').select('ejercicio, peso, reps, es_real, fecha').eq('user_id', uid),
    supabase.from('sesiones').select('inicio, fin').eq('estado', 'terminada').not('fin', 'is', null),
    supabase.from('ejercicios').select('*'),
    leerSilenciadas(),
  ]);
  if (!perfil) return null;

  // El interruptor. Si la migración todavía no corrió, la columna no existe y
  // el valor es `undefined`: se trata como prendido, que es el valor por
  // omisión de la base.
  if (perfil.avisos_estancamiento === false) return null;

  const sesiones = sesionesCrudas((ses ?? []) as { inicio: string; fin: string | null }[]);

  const senal = detectar({
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
    silenciadas,
  });
  if (!senal) return null;
  return { senal, ejercicios: (cat ?? []) as Ejercicio[], silenciadas };
}

/** "Ya lo vi": esa señal no vuelve por seis semanas en este aparato. */
export async function descartarSenal(silenciadas: Record<string, string>, senal: Senal) {
  const nuevas = { ...silenciadas, [idDeSenal(senal)]: hoyISO() };
  await plataforma.almacenamiento.guardar(CLAVE, JSON.stringify(nuevas));
  return nuevas;
}
