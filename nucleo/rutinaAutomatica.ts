// LA RUTINA AUTOMÁTICA (19/11, idea del dueño; galería 25). Arma una semana con lo que dicen los
// estudios y con lo que contestó la persona. Las reglas, con su porqué, son las que se explican en
// Ajustes; acá van solo los números. Sin la parte de Moss (sueño, comida): eso ajusta cada semana, después.
//
//   · Cada músculo, al menos dos veces por semana: con el mismo volumen, 2 o 3 dan parecido.
//   · Pocas series al empezar y de a poco: cada serie suma menos que la anterior.
//   · Una zona que «molesta» lleva otra variante o una serie menos; una que se «evita», ningún ejercicio
//     que la cargue.
//
// Sale en el formato de las rutinas (`DiaDeSemana[]`, el 0 es el domingo). NO importa nada.

export type Objetivo = 'musculo' | 'fuerza' | 'grasa' | 'salud' | 'deporte';
export type Experiencia = 'nunca' | 'menos6m' | 'hasta2a' | 'mas';
export type Lugar = 'gimnasio' | 'mancuernas' | 'casa';
export type Zona = 'hombro' | 'codoMuneca' | 'espaldaBaja' | 'cadera' | 'rodilla' | 'tobillo';
export type EstadoZona = 'bien' | 'molesta' | 'evitar';

export type Respuestas = {
  objetivo: Objetivo;
  experiencia: Experiencia;
  dias: number;
  minutos: number;
  lugar: Lugar;
  /** Juega un deporte de equipo o de carrera: menos carga de piernas. */
  deporte: boolean;
  zonas: Partial<Record<Zona, EstadoZona>>;
  /** En silla de ruedas: sin tren inferior. */
  silla: boolean;
  /** Presión alta, corazón, embarazo, operación reciente: se arma igual, y se avisa que vea a un médico. */
  condicion: boolean;
};

type Equipo = 'barra' | 'maquina' | 'mancuerna' | 'polea' | 'corporal';
type Opcion = { id: string; equipo: Equipo; carga: Zona[] };
type Hueco = { nombre: string; compuesto: boolean; pierna: boolean; opciones: Opcion[] };

const o = (id: string, equipo: Equipo, ...carga: Zona[]): Opcion => ({ id, equipo, carga });

// Los huecos de cada sesión, cada uno con sus variantes en orden de preferencia: la primera que entre
// por equipo y por zonas es la que va. Todos los ids están en el catálogo (lo pinea test:db).
const H: Record<string, Hueco> = {
  rodilla: { nombre: 'rodilla', compuesto: true, pierna: true, opciones: [o('sentadilla', 'barra', 'rodilla', 'espaldaBaja', 'cadera'), o('prensa', 'maquina', 'rodilla'), o('sentadilla_goblet', 'mancuerna', 'rodilla'), o('sentadilla_bulgara', 'corporal', 'rodilla', 'tobillo')] },
  rodillaUni: { nombre: 'rodillaUni', compuesto: true, pierna: true, opciones: [o('sentadilla_bulgara', 'mancuerna', 'rodilla', 'tobillo'), o('zancada_inversa', 'mancuerna', 'rodilla'), o('prensa_una_pierna', 'maquina', 'rodilla'), o('subida_cajon', 'corporal', 'rodilla', 'tobillo')] },
  cadera: { nombre: 'cadera', compuesto: true, pierna: true, opciones: [o('peso_muerto_rumano', 'barra', 'espaldaBaja', 'cadera'), o('hip_thrust', 'barra', 'cadera'), o('puente_gluteo', 'corporal', 'cadera')] },
  isquios: { nombre: 'isquios', compuesto: false, pierna: true, opciones: [o('curl_femoral', 'maquina', 'rodilla'), o('puente_gluteo', 'corporal', 'cadera')] },
  cuadriceps: { nombre: 'cuadriceps', compuesto: false, pierna: true, opciones: [o('extension_cuadriceps', 'maquina', 'rodilla'), o('sentadilla_goblet', 'mancuerna', 'rodilla')] },
  gemelos: { nombre: 'gemelos', compuesto: false, pierna: true, opciones: [o('gemelos', 'maquina', 'tobillo'), o('gemelos_sentado', 'maquina', 'tobillo')] },
  empujeH: { nombre: 'empujeH', compuesto: true, pierna: false, opciones: [o('press_banca', 'barra', 'hombro', 'codoMuneca'), o('press_pecho_maquina', 'maquina', 'hombro'), o('press_mancuernas', 'mancuerna', 'hombro'), o('flexiones', 'corporal', 'hombro', 'codoMuneca')] },
  empujeInc: { nombre: 'empujeInc', compuesto: true, pierna: false, opciones: [o('press_inclinado', 'barra', 'hombro', 'codoMuneca'), o('press_mancuernas', 'mancuerna', 'hombro'), o('flexiones', 'corporal', 'hombro', 'codoMuneca')] },
  empujeV: { nombre: 'empujeV', compuesto: true, pierna: false, opciones: [o('press_militar', 'barra', 'hombro', 'espaldaBaja'), o('press_hombro_maquina', 'maquina', 'hombro'), o('press_arnold', 'mancuerna', 'hombro')] },
  tironV: { nombre: 'tironV', compuesto: true, pierna: false, opciones: [o('jalon', 'polea', 'hombro'), o('dominadas', 'corporal', 'hombro', 'codoMuneca'), o('remo_mancuerna', 'mancuerna')] },
  tironH: { nombre: 'tironH', compuesto: true, pierna: false, opciones: [o('remo_barra', 'barra', 'espaldaBaja'), o('remo_polea', 'polea'), o('remo_mancuerna', 'mancuerna'), o('remo_invertido', 'corporal')] },
  lateral: { nombre: 'lateral', compuesto: false, pierna: false, opciones: [o('elevaciones_laterales', 'mancuerna', 'hombro'), o('face_pull', 'polea', 'hombro')] },
  posterior: { nombre: 'posterior', compuesto: false, pierna: false, opciones: [o('face_pull', 'polea'), o('pajaros', 'mancuerna')] },
  biceps: { nombre: 'biceps', compuesto: false, pierna: false, opciones: [o('curl_mancuernas', 'mancuerna', 'codoMuneca'), o('curl_polea', 'polea', 'codoMuneca')] },
  triceps: { nombre: 'triceps', compuesto: false, pierna: false, opciones: [o('triceps_polea', 'polea', 'codoMuneca'), o('fondos_banco', 'corporal', 'hombro', 'codoMuneca')] },
  core: { nombre: 'core', compuesto: false, pierna: false, opciones: [o('plancha', 'corporal', 'espaldaBaja'), o('dead_bug', 'corporal'), o('press_pallof', 'polea')] },
};

/** Las sesiones, por cantidad de días. Cada letra es una plantilla; se reparten lunes a sábado. */
const PLANTILLAS: Record<string, string[]> = {
  // Cuerpo completo: las dos llevan pecho, espalda, pierna y brazo, así con dos días cada uno va dos veces.
  A: ['rodilla', 'empujeH', 'tironV', 'cadera', 'lateral', 'biceps', 'core'],
  B: ['cadera', 'empujeInc', 'tironH', 'rodillaUni', 'empujeV', 'triceps'],
  Arriba: ['empujeH', 'tironV', 'empujeInc', 'tironH', 'lateral', 'empujeV', 'biceps', 'triceps'],
  Abajo: ['rodilla', 'cadera', 'cuadriceps', 'isquios', 'gemelos', 'core'],
  Empuje: ['empujeH', 'empujeV', 'empujeInc', 'lateral', 'triceps'],
  Tiron: ['tironV', 'tironH', 'posterior', 'biceps'],
  Piernas: ['rodilla', 'cadera', 'rodillaUni', 'isquios', 'gemelos', 'core'],
};
const REPARTO: Record<number, { dias: number[]; sesiones: string[] }> = {
  2: { dias: [1, 4], sesiones: ['A', 'B'] },
  3: { dias: [1, 3, 5], sesiones: ['A', 'B', 'A'] },
  4: { dias: [1, 2, 4, 5], sesiones: ['Arriba', 'Abajo', 'Arriba', 'Abajo'] },
  5: { dias: [1, 2, 3, 5, 6], sesiones: ['Empuje', 'Tiron', 'Piernas', 'Arriba', 'Abajo'] },
  6: { dias: [1, 2, 3, 4, 5, 6], sesiones: ['Empuje', 'Tiron', 'Piernas', 'Empuje', 'Tiron', 'Piernas'] },
};

const EQUIPO: Record<Lugar, Equipo[]> = {
  gimnasio: ['barra', 'maquina', 'polea', 'mancuerna', 'corporal'],
  mancuernas: ['mancuerna', 'corporal'],
  casa: ['corporal'],
};

/** Repeticiones objetivo: compuesto y aislado. Fuerza, más pesado; lo demás, en el medio. */
const REPS: Record<Objetivo, [number, number]> = { musculo: [8, 12], fuerza: [5, 10], grasa: [10, 12], salud: [10, 12], deporte: [6, 10] };
/**
 * Series por hueco, compuesto y aislado: arranca bajo y sube con la experiencia. Nunca más de 3 en un
 * compuesto: con 4, las del principio llenaban el tiempo y el pecho quedaba en 8 por semana.
 */
const SERIES: Record<Experiencia, [number, number]> = { nunca: [2, 2], menos6m: [3, 2], hasta2a: [3, 2], mas: [3, 3] };
/** Lo que entra en el tiempo: unos 3 minutos y medio por serie, con el descanso. */
const SERIES_POR_SESION = (minutos: number) => Math.max(6, Math.floor(minutos / 3.5));

function elegir(h: Hueco, r: Respuestas): { id: string; menos: boolean } | null {
  const sirven = h.opciones.filter((op) => EQUIPO[r.lugar].includes(op.equipo) && !op.carga.some((z) => r.zonas[z] === 'evitar'));
  const sinMolestia = sirven.find((op) => !op.carga.some((z) => r.zonas[z] === 'molesta'));
  if (sinMolestia) return { id: sinMolestia.id, menos: false };
  return sirven[0] ? { id: sirven[0].id, menos: true } : null;
}

export type RutinaAutomatica = {
  dias: { descanso: boolean; ejercicios: { ejercicio: string; series: number; reps: number }[] }[];
  consultarMedico: boolean;
};

export function armarRutina(r: Respuestas): RutinaAutomatica {
  const cuantos = Math.min(6, Math.max(2, Math.round(r.dias)));
  const { dias, sesiones } = REPARTO[cuantos];
  const [series, seriesAisl] = SERIES[r.experiencia];
  const [reps, repsAisl] = REPS[r.objetivo];
  const tope = SERIES_POR_SESION(r.minutos);
  const semana: RutinaAutomatica['dias'] = Array.from({ length: 7 }, () => ({ descanso: true, ejercicios: [] }));
  dias.forEach((d, i) => {
    const ejercicios: RutinaAutomatica['dias'][number]['ejercicios'] = [];
    let total = 0;
    for (const nombre of PLANTILLAS[sesiones[i]]) {
      const h = H[nombre];
      if (h.pierna && r.silla) continue;
      const e = elegir(h, r);
      // Un ejercicio que ya está en la sesión no se repite (dos huecos pueden caer en la misma variante).
      if (!e || ejercicios.some((x) => x.ejercicio === e.id)) continue;
      let n = h.compuesto ? series : seriesAisl;
      if (e.menos) n -= 1;
      if (h.pierna && r.deporte) n -= 1;
      n = Math.max(1, n);
      if (total + n > tope) break;
      total += n;
      ejercicios.push({ ejercicio: e.id, series: n, reps: h.compuesto ? reps : repsAisl });
    }
    semana[d] = { descanso: false, ejercicios };
  });
  return { dias: semana, consultarMedico: r.condicion };
}

/** Los ids que usa: test:db los compara con el catálogo de la base. */
export const EJERCICIOS_QUE_USA = [...new Set(Object.values(H).flatMap((h) => h.opciones.map((op) => op.id)))];
