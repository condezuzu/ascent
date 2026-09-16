// CUÁNTO CUESTA DIBUJAR STATS, y cuántas veces se paga.
//
// `filasPorMusculo` y `maximosDelCatalogo` se llaman en el CUERPO del
// componente, o sea en cada render: tocar una barra, cambiar de series a
// kilos o abrir un grupo de máximos vuelve a recorrer TODAS las sesiones.
//
// Esto lo mide con datos sintéticos de varios tamaños, sin navegador: es
// aritmética pura y es lo único que se puede medir sin mentir. Para saber qué
// significa en un teléfono, multiplicar por cuatro o seis.
//
//   node supabase/medir-stats.mjs
import { filasPorMusculo, maximosDelCatalogo } from '../nucleo/volumen.ts';

const EJERCICIOS = [
  ['press_banca', 'Press de banca', 'pecho'],
  ['sentadilla', 'Sentadilla', 'piernas'],
  ['peso_muerto', 'Peso muerto', 'espalda'],
  ['remo', 'Remo', 'espalda'],
  ['curl', 'Curl', 'brazos'],
  ['plancha', 'Plancha', 'core'],
];
const catalogoLista = EJERCICIOS.map(([id, nombre, grupo], i) => ({ id, nombre, grupo, orden: i }));
const catalogo = new Map(EJERCICIOS.map(([id, nombre, grupo]) => [id, { nombre, grupo }]));

function sesiones(cuantas) {
  const hoy = new Date('2026-09-16T12:00:00Z');
  return Array.from({ length: cuantas }, (_, i) => {
    const d = new Date(hoy);
    d.setUTCDate(d.getUTCDate() - i);
    return {
      id: `s${i}`,
      fecha: d.toISOString().slice(0, 10),
      bloques: Array.from({ length: 4 }, (_, j) => ({
        ejercicio: EJERCICIOS[(i + j) % EJERCICIOS.length][0],
        series: 3 + (j % 3),
        pesos: [60 + j, 60 + j, 62.5],
        carga: j % 2 ? 'par' : 'total',
      })),
    };
  });
}

const marcas = Array.from({ length: 40 }, (_, i) => ({
  ejercicio: EJERCICIOS[i % EJERCICIOS.length][0],
  peso: 80 + (i % 20),
  fecha: '2026-08-01',
}));

function medir(fn, vueltas) {
  fn();
  const t0 = performance.now();
  for (let i = 0; i < vueltas; i++) fn();
  return (performance.now() - t0) / vueltas;
}

console.log('sesiones   filasPorMusculo   maximosDelCatalogo   un render (las dos)');
for (const n of [30, 100, 300, 700]) {
  const ses = sesiones(n);
  const a = medir(() => filasPorMusculo(ses, catalogo, { hoy: '2026-09-16', semanas: 8, umbral: 6 }), 60);
  const b = medir(() => maximosDelCatalogo(ses, marcas, catalogoLista), 60);
  console.log(
    `${String(n).padStart(5)}    ${a.toFixed(2).padStart(8)} ms   ${b.toFixed(2).padStart(10)} ms   ` +
      `${(a + b).toFixed(2).padStart(8)} ms   → en un teléfono (×5): ${((a + b) * 5).toFixed(0)} ms`
  );
}
