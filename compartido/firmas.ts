import type { Cliente } from '@cliente';
import { plataforma } from '@plataforma';

/**
 * LOS ENLACES FIRMADOS DE LAS FOTOS, REUSADOS (15/10).
 *
 * Medido el 15/10: cada apertura firmaba enlaces NUEVOS (230 ms) y cada enlace nuevo
 * es otra dirección para el CDN, que nunca la tenía guardada: 530 a 860 ms hasta el
 * primer byte, aunque la foto pesara 2 KB. El mismo enlace por segunda vez: 40 a 60 ms.
 * Era eso, y no el peso, lo que hacía tardar a las fotos.
 *
 * Ahora cada ruta se firma por 24 h y el enlace se guarda (en memoria y en el
 * teléfono) y se reusa mientras le queden más de dos horas. Misma foto, misma
 * dirección: el CDN y la caché del teléfono la tienen.
 *
 * EL COSTO, A SABIENDAS: quien ya tenía el enlace de una foto la puede seguir
 * bajando hasta que venza, aunque el dueño la vuelva privada o lo saque de
 * amigos. Antes era una hora; ahora, un día como mucho. La foto deja de aparecer
 * en la app enseguida (la fila ya no se le da); lo que queda es el enlace.
 */
const DURA_S = 24 * 60 * 60;
// Reusar solo si le quedan más de dos horas: las pantallas guardan el enlace hasta
// una hora antes de volver a pedir (`useRefrescoDeFirmadas`).
const MARGEN_MS = 2 * 60 * 60 * 1000;
const CLAVE = 'ascent:firmas';
const TOPE = 400;

type Firma = { url: string; vence: number };
let memoria: Map<string, Firma> | null = null;
let cargando: Promise<Map<string, Firma>> | null = null;

async function cache(): Promise<Map<string, Firma>> {
  if (memoria) return memoria;
  cargando ??= (async () => {
    const m = new Map<string, Firma>();
    try {
      const crudo = await plataforma.almacenamiento.leer(CLAVE);
      const lista = crudo ? (JSON.parse(crudo) as [string, Firma][]) : [];
      const ahora = Date.now();
      for (const [ruta, f] of lista) if (f && typeof f.url === 'string' && f.vence - ahora > MARGEN_MS) m.set(ruta, f);
    } catch {
      // Sin lo guardado se firma de nuevo: es lo de antes, no un error.
    }
    memoria = m;
    return m;
  })();
  return cargando;
}

function guardar(m: Map<string, Firma>) {
  // Las más nuevas, hasta el tope: el álbum de alguien con muchas fotos no llena el teléfono.
  const lista = [...m.entries()].sort((a, b) => b[1].vence - a[1].vence).slice(0, TOPE);
  void plataforma.almacenamiento.guardar(CLAVE, JSON.stringify(lista)).catch(() => {});
}

/**
 * Los enlaces de estas rutas del bucket `fotos`, en el mismo orden; `null` donde no
 * se pudo (la miniatura que no existe vuelve con su error y no se guarda).
 */
export async function firmarFotos(supabase: Cliente, rutas: string[]): Promise<(string | null)[]> {
  if (rutas.length === 0) return [];
  const m = await cache();
  const ahora = Date.now();
  const faltan = [...new Set(rutas.filter((r) => !((m.get(r)?.vence ?? 0) - ahora > MARGEN_MS)))];
  if (faltan.length) {
    try {
      const { data } = await supabase.storage.from('fotos').createSignedUrls(faltan, DURA_S);
      const vence = ahora + DURA_S * 1000;
      faltan.forEach((r, i) => {
        const d = data?.[i];
        if (d && !d.error && d.signedUrl) m.set(r, { url: d.signedUrl, vence });
      });
      guardar(m);
    } catch {
      // Sin red: lo que haya guardado sirve; lo que falta queda en null.
    }
  }
  return rutas.map((r) => {
    const f = m.get(r);
    return f && f.vence > ahora ? f.url : null;
  });
}

/** Al cerrar sesión: los enlaces de una cuenta no le sirven a la siguiente. */
export async function olvidarFirmas() {
  memoria = new Map();
  cargando = null;
  await plataforma.almacenamiento.guardar(CLAVE, '[]').catch(() => {});
}

/** Cuánto tiempo vive una foto subida en el CDN y en la caché del teléfono: lo mismo que el enlace. */
export const CACHE_DE_FOTO = String(DURA_S);
