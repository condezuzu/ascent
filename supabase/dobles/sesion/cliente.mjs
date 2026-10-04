// Una base de mentira con las reglas que importan acá: `fijar_series` y
// `fijar_bloques` escriben por id de sesión (aunque ya esté cerrada, igual que la
// de verdad), y `mi_sesion` devuelve la que corre. Cada pedido tiene ida,
// proceso y vuelta, así que la respuesta puede llegar vieja.
export const servidor = {
  sesiones: [], // { id, inicio, series, bloques, estado, ultima_actividad, origen, cerro_sola }
  n: 0,
  ida: {}, // ms por rpc
  falla: {}, // rpc -> true: después de la espera contesta un error de red
  historial: [], // lo que devuelve la lista de sesiones terminadas (la rutina)
  registro: [], // lo que LLEGÓ a la base, en orden
  ultimoEjercicio: null,
  // rpc -> función que corre con la respuesta ya calculada y todavía en viaje
  antesDeResponder: {},
};

const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const viva = () => servidor.sesiones.find((s) => s.estado === 'corriendo') ?? null;
const porId = (id) => servidor.sesiones.find((s) => s.id === id) ?? null;
const copia = (x) => (x === undefined ? null : JSON.parse(JSON.stringify(x)));

function procesar(rpc, a) {
  const ahora = new Date().toISOString();
  switch (rpc) {
    case 'version_del_esquema':
      return 53;
    case 'iniciar_sesion': {
      const s = viva();
      if (s) return { bloqueado: false, id: s.id, inicio: s.inicio, origen: s.origen, series: s.series, ahora, yaEstaba: true, registro: null };
      const nueva = {
        id: 'sesion-' + ++servidor.n,
        inicio: ahora,
        series: 0,
        bloques: [],
        estado: 'corriendo',
        ultima_actividad: ahora,
        origen: a?.p_origen ?? 'manual',
        cerro_sola: false,
      };
      servidor.sesiones.push(nueva);
      return { bloqueado: false, id: nueva.id, inicio: nueva.inicio, origen: nueva.origen, series: 0, ahora, yaEstaba: false, registro: null };
    }
    case 'terminar_sesion': {
      const s = viva();
      if (!s) return { termino: false };
      s.estado = 'terminada';
      s.fin = ahora;
      return { termino: true, deshizo_el_dia: false };
    }
    case 'mi_sesion': {
      const s = viva();
      if (s) return { corriendo: true, id: s.id, inicio: s.inicio, origen: s.origen, ahora, series: s.series, ultima_actividad: s.ultima_actividad };
      const sola = [...servidor.sesiones].reverse().find((x) => x.cerro_sola);
      return { corriendo: false, ahora, cerrada_sola: sola ? { id: sola.id, inicio: sola.inicio, fin: sola.fin, estado: sola.estado } : null };
    }
    case 'fijar_series': {
      const s = porId(a.p_sesion);
      if (s) s.series = a.p_series;
      return s?.series ?? 0;
    }
    case 'fijar_bloques': {
      const s = porId(a.p_sesion);
      if (!s) return null;
      s.bloques = copia(a.p_bloques);
      return { bloques: s.bloques, total_series: s.series };
    }
    case 'marcar_actividad': {
      const s = porId(a.p_sesion);
      if (s && s.estado === 'corriendo') s.ultima_actividad = a.p_hasta;
      return null;
    }
    case 'ultimo_ejercicio':
      return servidor.ultimoEjercicio;
    case 'como_arranca':
      return { carga: 'total', elegida: false, peso: null };
    default:
      return null;
  }
}

async function llamar(rpc, a) {
  await espera(servidor.ida[rpc] ?? 5);
  if (servidor.falla[rpc]) return { data: null, error: { message: 'Network request failed' } };
  const data = copia(procesar(rpc, a));
  servidor.registro.push({ rpc, args: copia(a) });
  await espera(5);
  if (servidor.antesDeResponder[rpc]) await servidor.antesDeResponder[rpc](data);
  return { data, error: null };
}

function consulta(tabla) {
  const filtro = {};
  const q = {
    select: () => q,
    neq: () => q,
    gte: () => q,
    order: () => q,
    eq(columna, valor) {
      filtro[columna] = valor;
      return q;
    },
    maybeSingle: () => ejecutar(true),
    then: (a, b) => ejecutar(false).then(a, b),
  };
  async function ejecutar(uno) {
    await espera(5);
    const s = tabla === 'sesiones' && uno ? porId(filtro.id) : null;
    const data = uno ? (s ? { bloques: copia(s.bloques) } : null) : tabla === 'sesiones' ? copia(servidor.historial) : [];
    await espera(5);
    return { data, error: null };
  }
  return q;
}

const cliente = { rpc: (nombre, a) => llamar(nombre, a), from: (tabla) => consulta(tabla) };
export function crearCliente() {
  return cliente;
}
