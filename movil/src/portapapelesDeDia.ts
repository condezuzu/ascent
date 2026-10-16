import { useEffect, useState } from 'react';
import { eventos } from '@compartido/eventos';
import { esPropio } from '@nucleo/propios';
import type { DiaDeSemana } from '@nucleo/rutinas';

/**
 * EL DÍA COPIADO (16/10): un día de cualquier rutina —tuya o de un amigo— queda acá
 * hasta pegarlo en otro, de la misma rutina o de otra. Vive mientras la app está
 * abierta; cambiar de rutina o de pantalla no lo pierde.
 */
export type DiaCopiado = { dia: DiaDeSemana; origen: string };

const CAMBIO = 'ascent:dia-copiado';
let copiado: DiaCopiado | null = null;

/** `ajeno`: de la rutina de otro. Sus ejercicios propios no viajan, como al copiar la rutina entera. */
export function copiarDiaAlPortapapeles(dia: DiaDeSemana, origen: string, ajeno = false) {
  const ejercicios = dia.ejercicios.filter((e) => !ajeno || !esPropio(e.ejercicio)).map((e) => ({ ...e }));
  copiado = { dia: { descanso: dia.descanso, ejercicios }, origen };
  eventos.emitir(CAMBIO);
}

export function useDiaCopiado(): DiaCopiado | null {
  const [x, setX] = useState(copiado);
  useEffect(() => eventos.escuchar(CAMBIO, () => setX(copiado)), []);
  return x;
}
