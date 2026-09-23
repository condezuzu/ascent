/**
 * LA TENDENCIA DE UNA SERIE DIARIA: suavizar, recortar la ventana y decir
 * dónde va cada punto. Sin unidades y sin saber de qué habla.
 *
 * POR QUÉ ESTÁ SEPARADO DE `peso.ts` (23/9). Esta cuenta se escribió para el
 * peso corporal y vivió ahí hasta que apareció el segundo gráfico —los pasos
 * de Apple Health—, que quiere exactamente lo mismo: la misma media móvil, las
 * mismas ventanas de tiempo, el mismo arrastrar el dedo para leer un día. Lo
 * único del peso era la conversión a libras.
 *
 * `peso.ts` sigue exportando todo esto, así que nada de lo que ya importaba de
 * ahí tuvo que cambiar.
 */

export type PuntoDia = { fecha: string; valor: number; suave: number };

/**
 * LA MEDIA MÓVIL — por FECHA, no por registros.
 *
 * ERA UN BUG, y de los que no se ven mirando el gráfico. La versión anterior
 * promediaba los ÚLTIMOS SIETE REGISTROS: para quien se pesa todos los días
 * eso son siete días, pero para quien se pesa tres veces por semana son dos
 * semanas y media. El rótulo decía "tendencia 7 días" y el número era otro.
 *
 * POR QUÉ SE SUAVIZA. El dato diario oscila por razones que no tienen que ver
 * con lo que se quiere leer —en el peso la sal, el agua y la hora; en los pasos
 * un día de mandados contra uno de escritorio—, y una línea con esos dientes se
 * lee como progreso o como fracaso según el día que toque mirar.
 *
 * DEVUELVE EL CRUDO TAMBIÉN. La línea se dibuja con el suavizado, que es lo
 * que se puede afirmar; el número que se muestra al tocar un día es el CRUDO,
 * que es lo que pasó ese día. Mostrar el suavizado ahí sería inventar un número
 * que nunca existió.
 */
export function suavizarPorFecha(
  datos: { fecha: string; valor: number }[],
  dias = 7
): PuntoDia[] {
  const ms = (iso: string) => new Date(iso + 'T00:00:00').getTime();
  const ventana = (dias - 1) * 24 * 3600 * 1000;
  return datos.map((p, i) => {
    const desde = ms(p.fecha) - ventana;
    let suma = 0;
    let n = 0;
    // Hacia atrás desde el propio punto: la ventana es [fecha-6, fecha], o
    // sea que un punto nunca se promedia con datos que todavía no existían.
    for (let j = i; j >= 0; j--) {
      if (ms(datos[j].fecha) < desde) break;
      suma += datos[j].valor;
      n++;
    }
    return { fecha: p.fecha, valor: p.valor, suave: suma / n };
  });
}

/** Los últimos N días de una serie ya ordenada. `null` = todo. */
export function ultimosDias<T extends { fecha: string }>(
  serie: T[],
  dias: number | null
): T[] {
  if (dias === null || serie.length === 0) return serie;
  const fin = new Date(serie[serie.length - 1].fecha + 'T00:00:00').getTime();
  const desde = fin - (dias - 1) * 24 * 3600 * 1000;
  return serie.filter((p) => new Date(p.fecha + 'T00:00:00').getTime() >= desde);
}

/**
 * EL GRÁFICO, COMO CUENTA: la serie, dónde va cada punto y los dos trazos (la
 * línea y el área de abajo). Lo dibujan las dos apps —la web con `<svg>`, la
 * nativa con `react-native-svg`— y la cuenta es la misma.
 *
 * Se suaviza con TODO el historial y recién después se recorta la ventana: al
 * revés, el primer punto de "último mes" se promediaría solo consigo mismo y
 * la línea arrancaría con un escalón que no existe.
 *
 * El alto se reparte con un margen arriba y abajo para que la línea no toque
 * los bordes. ESOS números son de dibujo y por eso no se devuelven: mostrarlos
 * como mínimo y máximo fue el error de la primera versión.
 *
 * `luzMinima` es cuánto aire dejar cuando la serie es plana. Existe para que
 * una serie de valores idénticos no divida por cero, y su tamaño depende de la
 * unidad: 0,4 kg es aire en una balanza y nada en una cuenta de pasos.
 *
 * `null` si en la ventana no hay dos puntos: con uno no hay tendencia.
 */
export function trazarSerie(
  datos: { fecha: string; valor: number }[],
  dias: number | null,
  ancho: number,
  alto: number,
  ventana = 7,
  luzMinima = 0.4
) {
  const todo = suavizarPorFecha(datos, ventana);
  const serie = ultimosDias(todo, dias);
  if (serie.length < 2) return null;

  const piso = Math.min(...serie.map((p) => p.suave));
  const techo = Math.max(...serie.map((p) => p.suave));
  const luz = Math.max(luzMinima, (techo - piso) * 0.25); // aire, y algo si es plano
  const min = piso - luz;
  const max = techo + luz;

  const puntos = serie.map((p, i) => ({
    x: (i / (serie.length - 1)) * ancho,
    y: alto - ((p.suave - min) / (max - min)) * alto,
  }));
  const linea = puntos.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  // El relleno cierra por abajo del área visible para que el degradado se
  // apague solo.
  const area = `${linea} L${ancho},${alto} L0,${alto} Z`;
  const hoy = serie[serie.length - 1].suave;
  return { serie, puntos, linea, area, hoy, cambio: hoy - serie[0].suave, dias: serie.length };
}

/**
 * El punto de la serie MÁS CERCANO en x a una posición del dedo (0 a 1 del
 * ancho), no el que está justo abajo: el dedo tapa 40 px y los puntos pueden
 * estar a 3 px uno de otro. Sin esto hay que apuntar, y apuntar en un gráfico
 * de 84 px de alto no se puede.
 */
export function puntoMasCercano(fraccion: number, cuantos: number): number {
  const t = Math.min(1, Math.max(0, fraccion));
  return Math.round(t * (cuantos - 1));
}
