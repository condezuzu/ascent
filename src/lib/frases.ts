// Una frase corta por pantalla, distinta según el rango. Van en voz baja:
// describen dónde estás, no te arengan. Nada de "¡vamos que se puede!".
const FRASES: Record<number, string[]> = {
  1: [
    'Todo lo grande empezó siendo esto.',
    'Materia suelta, todavía sin forma.',
    'Nada pesa lo suficiente para atraer al resto. Por ahora.',
    'El polvo tarda en decidirse.',
    'Acá no se ve nada. Igual está pasando.',
  ],
  2: [
    'Ya hay algo sólido.',
    'Una piedra que aguanta el viaje.',
    'Lo suficientemente denso como para no deshacerse.',
    'Chico, pero entero.',
    'Va rápido y no se rompe.',
  ],
  3: [
    'Cada marca es un día que no faltaste.',
    'Los golpes quedan a la vista, y está bien.',
    'Ya tiene gravedad propia.',
    'Suficiente masa para que algo la orbite.',
    'Gris, callada, siempre ahí.',
  ],
  4: [
    'Un mundo entero, todavía frío.',
    'Ya tiene atmósfera.',
    'Cada día cambia de mundo.',
    'Crece hasta que se encienda.',
    'Le falta poco para no ser roca.',
  ],
  5: [
    'Se encendió.',
    'Ahora la luz sale de acá.',
    'Dejó de reflejar: ahora genera.',
    'Fusión: nada de esto vuelve atrás.',
    'Lo que antes orbitaba, ahora depende.',
  ],
  6: [
    'Ya no está sola.',
    'Todo esto gira alrededor tuyo.',
    'Un orden que se sostiene solo.',
    'Ocho mundos con la misma costumbre.',
    'La rutina se volvió mecánica celeste.',
  ],
  7: [
    'Millones de soles con la misma idea.',
    'A esta escala los días no se cuentan.',
    'Una espiral que tardó en armarse.',
    'Ya no se mide en cuerpos, se mide en brazos.',
    'Tanta luz junta que parece niebla.',
  ],
  8: [
    'Ya nada de lo que entra vuelve a salir.',
    'El final de la escalera. Se sigue igual.',
    'Tanta masa que ni la luz se escapa.',
    'Acá el tiempo se estira.',
    'No hay rango después de este. No hace falta.',
  ],
};

// Cambia de día en día, no en cada carga: que no baile mientras la mirás,
// pero que no sea siempre la misma.
export function fraseDelDia(rango: number, semilla: string): string {
  const lista = FRASES[rango] ?? FRASES[1];
  let h = 0;
  for (let i = 0; i < semilla.length; i++) h = (h * 31 + semilla.charCodeAt(i)) | 0;
  return lista[Math.abs(h) % lista.length];
}
