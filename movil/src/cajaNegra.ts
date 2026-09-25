/**
 * LA CAJA NEGRA: qué pasó al arrancar, para verlo en el teléfono.
 *
 * NACIÓ DE LA PRIMERA BUILD (18/9): instaló, abrió, y quedó la pantalla en
 * negro. Una build de release no tiene la pantalla roja de desarrollo ni un
 * Metro conectado del que leer la consola: si algo tira, no queda rastro a la
 * vista. Esto junta el rastro y `Raiz.tsx` lo muestra.
 *
 * SE CARGA ANTES QUE TODO (es el primer import de `index.ts`) y no importa
 * nada de la app: si importara Supabase o el motor, un error ahí la mataría a
 * ella también, justo en el caso que tiene que contar.
 *
 * Junta, en orden y con la hora desde el arranque:
 *   - los errores que nadie atrapó (fatales o no) y las promesas sin `catch`;
 *   - los `console.error` y `console.warn`;
 *   - marcas de por dónde va el arranque (`anotar`), para saber hasta dónde
 *     llegó cuando no hay error sino silencio.
 */

export type Entrada = { ms: number; tipo: 'marca' | 'error' | 'aviso'; texto: string };

const inicio = Date.now();
const registro: Entrada[] = [];
const oyentes = new Set<() => void>();
let listo = false;
let huboError = false;

// EL AVISO SALE EN LA PRÓXIMA VUELTA, no en el momento (19/9). Lo que se
// anota puede llegar desde adentro del dibujo de un componente —un
// `console.warn` de React mientras dibuja— y el oyente (`Raiz`) hace un
// `setState`: en el momento, eso es actualizar un componente mientras se
// dibuja otro, y React lo reporta como error. Lo vio `test:real`. Varios
// avisos seguidos salen juntos.
let avisoPendiente = false;
function avisar() {
  if (avisoPendiente) return;
  avisoPendiente = true;
  setTimeout(() => {
    avisoPendiente = false;
    for (const fn of [...oyentes]) fn();
  }, 0);
}

function agregar(tipo: Entrada['tipo'], texto: string) {
  registro.push({ ms: Date.now() - inicio, tipo, texto: texto.slice(0, 4000) });
  if (registro.length > 300) registro.shift();
  avisar();
}

function describir(e: unknown): string {
  if (e instanceof Error) return `${e.name}: ${e.message}${e.stack ? `\n${e.stack}` : ''}`;
  try {
    return typeof e === 'string' ? e : JSON.stringify(e);
  } catch {
    return String(e);
  }
}

/** Una marca de por dónde va el arranque. */
export function anotar(texto: string) {
  agregar('marca', texto);
}

// UN SUMIDERO OPCIONAL DE ERRORES, para mandarlos afuera.
//
// La caja negra sigue sin importar NADA de la app —esa es toda su gracia: si
// Supabase o el motor están rotos, esto igual junta el rastro—. Así que no
// manda ella el error a ningún lado: guarda una función que le registran, y la
// llama. Quien la registra (`reporteDeErrores.ts`) es el que sí importa
// Supabase. Si esa función tira, se traga acá: reportar un error NO puede
// romper el registro del error.
let sumidero: ((donde: string, e: unknown) => void) | null = null;

export function reportarErroresA(fn: ((donde: string, e: unknown) => void) | null) {
  sumidero = fn;
}

/** Un error, con dónde pasó. */
export function registrarError(donde: string, e: unknown) {
  huboError = true;
  agregar('error', `${donde}: ${describir(e)}`);
  try {
    sumidero?.(donde, e);
  } catch {
    /* un reporte que falla no puede tapar el error que venía a contar */
  }
}

/** La app llegó a una pantalla de verdad (Login, Onboarding o las pestañas). */
export function marcarListo() {
  if (listo) return;
  listo = true;
  agregar('marca', 'la app llegó a una pantalla');
}

export function estado() {
  return { registro: [...registro], listo, huboError };
}

export function escuchar(fn: () => void) {
  oyentes.add(fn);
  return () => {
    oyentes.delete(fn);
  };
}

/** Todo el registro como texto, para compartirlo. */
/**
 * LO QUE SE COMPARTE, ADEMÁS DEL REGISTRO. Lo pone el diagnóstico de la sesión
 * (`DiagnosticoSesion.tsx`) para que la foto que se manda lleve también las
 * tres fuentes y la cola, y no solo el arranque.
 *
 * ES UNA FUNCIÓN Y NO UN TEXTO: se llama al compartir, así que dice cómo
 * estaban las cosas EN ESE MOMENTO y no cuando se abrió el panel.
 *
 * La caja negra sigue sin importar nada de la app —que es toda su gracia—:
 * guarda una función que le pasan, no sabe qué hay adentro, y si tira se
 * comparte igual el registro.
 */
let anexo: (() => string) | null = null;

export function ponerAnexo(fn: (() => string) | null) {
  anexo = fn;
}

export function comoTexto() {
  const lineas = registro
    .map((r) => `${(r.ms / 1000).toFixed(2).padStart(7)}s ${r.tipo.toUpperCase().padEnd(5)} ${r.texto}`)
    .join('\n');
  let extra = '';
  try {
    extra = anexo?.() ?? '';
  } catch {
    extra = '(el anexo de la sesion fallo)';
  }
  return extra ? `${extra}\n\n${lineas}` : lineas;
}

// ---- LO QUE SE ENGANCHA AL CARGAR ----

anotar('arranque del JS');
// Si las variables de Supabase llegaron a la build. Solo sí o no: el valor no
// se muestra. Van escritas enteras porque Expo las reemplaza al compilar
// buscando exactamente `process.env.EXPO_PUBLIC_...`.
//
// Y QUÉ FORMA TIENEN, sin decir el valor: `eas.json` las pasa como
// "$EXPO_PUBLIC_SUPABASE_URL", y la documentación de EAS no dice si ese "$…"
// se reemplaza por la variable o llega tal cual. Si llegó tal cual, esto lo dice.
function forma(v: string | undefined) {
  if (!v) return 'FALTA';
  if (v.startsWith('$')) return `llegó LITERAL, sin reemplazar ("${v.slice(0, 40)}")`;
  if (/^https:\/\//.test(v)) return `está (https://…, ${v.length} caracteres)`;
  return `está (${v.length} caracteres, no empieza con https://)`;
}
anotar(`EXPO_PUBLIC_SUPABASE_URL: ${forma(process.env.EXPO_PUBLIC_SUPABASE_URL)}`);
anotar(`EXPO_PUBLIC_SUPABASE_ANON_KEY: ${forma(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY)}`);

type ManejadorGlobal = (e: unknown, fatal?: boolean) => void;
const U = (globalThis as { ErrorUtils?: { getGlobalHandler(): ManejadorGlobal; setGlobalHandler(f: ManejadorGlobal): void } })
  .ErrorUtils;
if (U) {
  const anterior = U.getGlobalHandler();
  U.setGlobalHandler((e, fatal) => {
    registrarError(fatal ? 'ERROR FATAL sin atrapar' : 'error sin atrapar', e);
    // Uno fatal NO se le pasa al de siempre: en release, ese cierra la app, y
    // entonces no hay pantalla donde mostrar qué pasó.
    if (!fatal) anterior(e, fatal);
  });
}

const H = (globalThis as { HermesInternal?: { enablePromiseRejectionTracker?(o: object): void } }).HermesInternal;
H?.enablePromiseRejectionTracker?.({
  allRejections: true,
  onUnhandled: (_id: number, e: unknown) => registrarError('promesa sin catch', e),
});

for (const nivel of ['error', 'warn'] as const) {
  const original = console[nivel].bind(console);
  console[nivel] = (...args: unknown[]) => {
    agregar(nivel === 'error' ? 'error' : 'aviso', args.map(describir).join(' '));
    original(...args);
  };
}
