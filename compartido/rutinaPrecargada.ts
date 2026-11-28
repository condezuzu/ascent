import type { Cliente } from '@cliente';
import type { DiaDeSemana, Rutina } from '@nucleo/rutinas';
import type { Ejercicio } from '@nucleo/tipos';
import { miId } from '@compartido/quienSoy';
import { cargarMisRutinas, cargarRutinaParaVer, hayRutinasGuardadas } from '@compartido/rutinas';
import { eventos, RUTINA_CAMBIO } from '@compartido/eventos';

/**
 * «TU RUTINA», PEDIDA ANTES DE QUE SE VEA (21/10, a pedido: "carga más lento que todo lo demás y
 * aparece de golpe"). Stats → Entrenamiento recién la pedía al abrirse —tres viajes seguidos— y
 * hasta entonces no dibujaba nada: aparecía después y empujaba lo de abajo. Ahora Stats la pide
 * junto con lo suyo, y la pantalla arranca con esto ya puesto (y lo refresca de fondo).
 *
 * Es de la cuenta: `limpiarAlSalir` la olvida, para que otra no vea la de la anterior.
 */
export type RutinaPrecargada = { de: string | null; hay: boolean; mias: Rutina[] | null; deducida: DiaDeSemana[] | null; ejercicios: Ejercicio[] };

let precarga: RutinaPrecargada | null = null;
let enCurso: Promise<RutinaPrecargada | null> | null = null;

// LO QUE SE GUARDA DESPUÉS TAMBIÉN QUEDA ACÁ (27/11, bug del dueño). «Editar este día» nace con esto: sin anotar lo
// guardado volvía a abrir con la rutina de antes, y tocar algo ahí guardaba esa encima (el cambio anterior se perdía
// de la base). La rutina guardada se anota; lo demás (una nueva, activar, borrar) se olvida y se pide de nuevo.
let cambios = 0;
eventos.escuchar(RUTINA_CAMBIO, (dato) => {
  cambios++;
  const g = dato as { id?: string; nombre?: string; dias?: DiaDeSemana[] } | undefined;
  const mias = precarga?.mias;
  precarga =
    precarga && mias && g?.dias && mias.some((r) => r.id === g.id)
      ? { ...precarga, mias: mias.map((r) => (r.id === g.id ? { ...r, nombre: g.nombre ?? r.nombre, dias: g.dias ?? r.dias } : r)) }
      : null;
});

export function rutinaPrecargada(): RutinaPrecargada | null {
  return precarga;
}

/** Pide todo junto; dos pedidos a la vez son uno solo. `null` si no se pudo (queda lo de antes). */
export function precargarRutina(supabase: Cliente): Promise<RutinaPrecargada | null> {
  enCurso ??= (async () => {
    try {
      for (;;) {
        const antes = cambios;
        const [hay, ejercicios, yo] = await Promise.all([hayRutinasGuardadas(supabase), supabase.from('ejercicios').select('*'), miId(supabase)]);
        const [mias, vista] = await Promise.all([hay ? cargarMisRutinas(supabase) : Promise.resolve(null), yo ? cargarRutinaParaVer(supabase, yo, true) : Promise.resolve(null)]);
        // Una rutina guardada mientras esto viajaba: lo traído puede ser de antes. Se pide de nuevo.
        if (cambios !== antes) continue;
        precarga = { de: yo, hay, mias, deducida: vista?.deducida ? vista.dias : null, ejercicios: (ejercicios.data ?? []) as Ejercicio[] };
        return precarga;
      }
    } catch {
      return null;
    } finally {
      enCurso = null;
    }
  })();
  return enCurso;
}

export function olvidarRutinaPrecargada(): void {
  precarga = null;
}
