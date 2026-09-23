import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { T } from '@nucleo/textos';
import { leerSesionCache } from '@compartido/sesionCache';
import { cuantasPendientes } from '@compartido/cola';
import { ponerAnexo } from './cajaNegra';
import { aplicar, buscarYTraer, hayCanal, queEstoyCorriendo } from './actualizaciones';
import { loVisible } from './loVisible';
import { supabase } from './supabase';

/**
 * LAS TRES FUENTES DE LA SESIÓN, ADENTRO DEL DIAGNÓSTICO (22/9).
 *
 * POR QUÉ EXISTE. El bug de las series es un desencuentro: el total dice una
 * cosa y los circulitos otra. Son tres lugares —la pantalla, la caché de este
 * teléfono y la base— y casi siempre dicen lo mismo. La sonda
 * (`herramientas/reproducir-series-nativa.mjs`) recorre seis caminos y en
 * ninguno se separan, así que si vuelve a pasar va a ser en el gimnasio y no
 * acá. Esto es para ESE momento: se abre el diagnóstico, se saca la foto, y la
 * foto ya dice cuál de los tres se desvió.
 *
 * LA COLA VA JUNTO y no es un dato de más: una diferencia entre la pantalla y
 * la base con la cola llena NO es un bug, es la app esperando señal. La misma
 * diferencia con la cola vacía sí lo es. Sin este número, las dos fotos se ven
 * iguales.
 *
 * SE CARGA APARTE de la caja negra, con `require` adentro de un try (ver
 * `Raiz.tsx`): esto importa Supabase y la caché, o sea justo lo que la caja
 * negra no puede importar sin dejar de servir el día que eso sea lo roto.
 */

type Lectura = { series: number | null; bloque: string | null; detalle: string | null };
const VACIA: Lectura = { series: null, bloque: null, detalle: null };

export default function DiagnosticoSesion() {
  const [cache, setCache] = useState<Lectura | null>(null);
  const [base, setBase] = useState<Lectura | null>(null);
  const [cola, setCola] = useState<number | null>(null);
  const [fallo, setFallo] = useState(false);
  const [leyendo, setLeyendo] = useState(true);
  // La actualización por el aire: qué JS corre y si hay uno nuevo esperando.
  const [buscando, setBuscando] = useState(false);
  const [novedad, setNovedad] = useState<string | null>(null);

  const pantalla = loVisible();

  const leer = useCallback(async () => {
    setLeyendo(true);
    setFallo(false);
    try {
      const c = await leerSesionCache();
      setCache(
        c
          ? {
              series: c.series ?? null,
              bloque: c.bloques ? T.diagnostico.deMeta(c.bloques.hechas, c.bloques.meta) : null,
              // `faltanBloques` es la bandera del arreglo del 19/9: mientras
              // está puesta, lo de acá es solo lo contado en este teléfono.
              detalle: [c.bloques?.ejercicio ?? null, c.faltanBloques ? 'faltan bloques' : null].filter(Boolean).join(' · ') || null,
            }
          : VACIA
      );
      setCola(await cuantasPendientes());

      // La base, en dos viajes: `mi_sesion` trae la sesión y el total, pero no
      // los bloques —por eso la app los va a buscar aparte— y sin ellos esta
      // pantalla no contestaría lo único que vino a contestar.
      const { data, error } = await supabase.rpc('mi_sesion');
      const s = (Array.isArray(data) ? data[0] : data) as { id?: string; series?: number } | null;
      if (error) throw error;
      if (!s?.id) {
        setBase(VACIA);
      } else {
        const { data: fila } = await supabase.from('sesiones').select('bloques').eq('id', s.id).maybeSingle();
        const bloques = (fila?.bloques ?? []) as { ejercicio?: string; series?: number }[];
        const enBloques = bloques.reduce((n, b) => n + (b.series ?? 0), 0);
        setBase({
          series: s.series ?? null,
          bloque: T.diagnostico.enBloques(enBloques),
          detalle: bloques.map((b) => `${b.ejercicio ?? '—'}×${b.series ?? 0}`).join(' · ') || null,
        });
      }
    } catch {
      setFallo(true);
    } finally {
      setLeyendo(false);
    }
  }, []);

  useEffect(() => {
    leer();
  }, [leer]);

  // LO QUE SE COMPARTE LO ARMA ESTA MISMA PANTALLA, al tocar compartir y no
  // ahora: así el texto dice cómo estaban las cosas en ese momento.
  useEffect(() => {
    ponerAnexo(() => {
      const v = loVisible();
      return [
        '--- la sesion, en tres lugares ---',
        `pantalla: ${v ? `${v.corriendo ? 'corriendo' : 'quieta'} · ${v.series ?? '—'} en total · ${v.hechas ?? '—'}/${v.meta ?? '—'} · ${v.ejercicio ?? 'sin ejercicio'}` : 'nada anotado'}`,
        `telefono: ${textoDe(cache)}`,
        `base:     ${textoDe(base)}`,
        `cola:     ${cola ?? '?'}`,
      ].join('\n');
    });
    return () => ponerAnexo(null);
  }, [cache, base, cola]);

  return (
    <View style={estilos.caja}>
      <Text style={estilos.titulo}>{T.diagnostico.sesionTitulo}</Text>
      <Text style={estilos.nota}>{T.diagnostico.sesionNota}</Text>

      <Fila
        rotulo={T.diagnostico.fuentePantalla}
        valor={
          pantalla && pantalla.corriendo
            ? `${T.diagnostico.enTotal(pantalla.series ?? 0)} · ${T.diagnostico.deMeta(pantalla.hechas ?? 0, pantalla.meta ?? 0)}`
            : T.diagnostico.sinSesion
        }
        detalle={pantalla?.ejercicio ?? null}
      />
      <Fila rotulo={T.diagnostico.fuenteCache} valor={valorDe(cache, leyendo)} detalle={cache?.detalle ?? null} />
      <Fila
        rotulo={T.diagnostico.fuenteBase}
        valor={fallo ? T.diagnostico.noSePudoLeer : valorDe(base, leyendo)}
        detalle={base?.detalle ?? null}
      />

      <Text style={estilos.cola}>{cola === null ? T.diagnostico.leyendo : cola === 0 ? T.diagnostico.colaVacia : T.diagnostico.colaCon(cola)}</Text>
      <Pressable onPress={leer} hitSlop={8}>
        <Text style={estilos.releer}>{T.diagnostico.releer}</Text>
      </Pressable>

      {/* QUÉ JS ESTÁ CORRIENDO. Con actualizaciones por el aire, "la versión
          que tenés" dejó de ser obvia: la app puede estar corriendo el JS que
          vino en la build o uno bajado después. Sin esto, un bug arreglado que
          sigue apareciendo no se distingue de uno que no se arregló. */}
      <View style={estilos.actualizar}>
        <Text style={estilos.nota}>{T.diagnostico.corriendo(queEstoyCorriendo())}</Text>
        {hayCanal() && (
          <Pressable
            hitSlop={8}
            onPress={async () => {
              setBuscando(true);
              setNovedad(null);
              const hay = await buscarYTraer();
              setBuscando(false);
              // Si hay una nueva se aplica en el momento: el que abrió esto
              // vino justamente a eso.
              if (hay) return aplicar();
              setNovedad(T.diagnostico.sinNovedad);
            }}
          >
            <Text style={estilos.releer}>{buscando ? T.diagnostico.buscando : T.diagnostico.buscar}</Text>
          </Pressable>
        )}
        {novedad !== null && <Text style={estilos.nota}>{novedad}</Text>}
      </View>
    </View>
  );
}

function Fila({ rotulo, valor, detalle }: { rotulo: string; valor: string; detalle: string | null }) {
  return (
    <View style={estilos.fila}>
      <Text style={estilos.rotulo}>{rotulo}</Text>
      <View style={estilos.valores}>
        <Text style={estilos.valor} selectable>
          {valor}
        </Text>
        {!!detalle && (
          <Text style={estilos.detalle} selectable>
            {detalle}
          </Text>
        )}
      </View>
    </View>
  );
}

function valorDe(l: Lectura | null, leyendo: boolean): string {
  if (!l) return leyendo ? T.diagnostico.leyendo : T.diagnostico.noSePudoLeer;
  if (l.series === null && l.bloque === null) return T.diagnostico.sinSesion;
  return [l.series === null ? null : T.diagnostico.enTotal(l.series), l.bloque ?? T.diagnostico.sinBloque].filter(Boolean).join(' · ');
}

function textoDe(l: Lectura | null): string {
  if (!l) return 'no leido';
  if (l.series === null && l.bloque === null) return 'sin sesion';
  return `${l.series ?? '—'} en total · ${l.bloque ?? 'sin bloque'}${l.detalle ? ` · ${l.detalle}` : ''}`;
}

// Los mismos colores escritos a mano que el resto del diagnóstico: vive al
// lado de la caja negra y no puede depender de la paleta de la app.
const estilos = StyleSheet.create({
  caja: { borderWidth: StyleSheet.hairlineWidth, borderColor: '#2a3040', padding: 12, marginBottom: 14 },
  titulo: { color: '#e8ecf6', fontSize: 15, marginBottom: 2 },
  nota: { color: '#8a93a8', fontSize: 12, lineHeight: 17, marginBottom: 10 },
  fila: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6, gap: 10 },
  rotulo: { color: '#4a5163', fontSize: 11, width: 92, paddingTop: 2 },
  valores: { flex: 1 },
  valor: { color: '#c4c2ba', fontSize: 13, fontFamily: 'Menlo' },
  detalle: { color: '#8a93a8', fontSize: 11, fontFamily: 'Menlo', marginTop: 1 },
  cola: { color: '#8a93a8', fontSize: 12, marginTop: 8 },
  releer: { color: '#8a93a8', fontSize: 12, textDecorationLine: 'underline', marginTop: 8 },
  actualizar: { marginTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderColor: '#2a3040', paddingTop: 10 },
});
