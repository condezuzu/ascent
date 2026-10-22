import type { Cliente } from '@cliente';
import type { DiaDeSemana, Rutina } from '@nucleo/rutinas';
import type { Ejercicio } from '@nucleo/tipos';
import { miId } from '@compartido/quienSoy';
import { cargarMisRutinas, cargarRutinaParaVer, hayRutinasGuardadas } from '@compartido/rutinas';

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

export function rutinaPrecargada(): RutinaPrecargada | null {
  return precarga;
}

/** Pide todo junto; dos pedidos a la vez son uno solo. `null` si no se pudo (queda lo de antes). */
export function precargarRutina(supabase: Cliente): Promise<RutinaPrecargada | null> {
  enCurso ??= (async () => {
    try {
      const [hay, ejercicios, yo] = await Promise.all([hayRutinasGuardadas(supabase), supabase.from('ejercicios').select('*'), miId(supabase)]);
      const [mias, vista] = await Promise.all([hay ? cargarMisRutinas(supabase) : Promise.resolve(null), yo ? cargarRutinaParaVer(supabase, yo, true) : Promise.resolve(null)]);
      precarga = { de: yo, hay, mias, deducida: vista?.deducida ? vista.dias : null, ejercicios: (ejercicios.data ?? []) as Ejercicio[] };
      return precarga;
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
