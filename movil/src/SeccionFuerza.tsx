import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { supabase } from './supabase';
import { fechaDeMarca, pesoLindo, redondear } from '@nucleo/fuerza';
import type { Unidad } from '@nucleo/peso';
import type { FilaFuerza, MiFuerza } from '@nucleo/tipos';
import { esSexoEstandar, muestraFina, type SexoEstandar } from '@nucleo/estandares';
import { T } from '@nucleo/textos';
import { cargarFuerza, filasDondeEstoy } from '@compartido/fuerza';
import Avatar from './Avatar';
import { irAPestana } from './irAPestana';
import { C } from './colores';

/**
 * LA FUERZA DENTRO DE STATS (§16.6), en la app nativa: acá se mira y se
 * compara. La misma sección que la web (`src/components/SeccionFuerza.tsx`),
 * con lo que se pide y "dónde estoy" en `compartido/fuerza.ts`.
 *
 * LO QUE NO ESTÁ: en la web, "Mis marcas" y "Anotar una marca" llevan a la
 * pantalla donde se cargan las marcas (`/fuerza`), que no está portada. Esos
 * botones no se muestran hasta que exista, en vez de llevar a ningún lado; el
 * texto de cada caso sí, porque dice lo que pasa. "Ajustes" sí lleva: es una
 * pestaña (`irAPestana`).
 */
export default function SeccionFuerza({
  unidad,
  sexo,
  pesoCorporal,
  claro,
}: {
  unidad: Unidad;
  sexo: string | null;
  /** El peso corporal más reciente, en KILOS: la tabla está en kilos. */
  pesoCorporal: number | null;
  /** El `--pal-claro` de la web. */
  claro: string;
}) {
  const [mia, setMia] = useState<MiFuerza | null>(null);
  const [ranking, setRanking] = useState<FilaFuerza[]>([]);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [yo, setYo] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) return;
      setYo(session.user.id);
      const datos = await cargarFuerza(supabase);
      setMia(datos?.mia ?? null);
      setRanking(datos?.ranking ?? []);
    })();
  }, []);

  // Sin `mi_fuerza` (base sin la migración) la sección no se muestra:
  // preferible a una sección rota en medio de Stats.
  if (!mia) return null;

  const aAjustes = (
    <Text style={{ color: claro }} onPress={() => irAPestana('ajustes')} accessibilityRole="link">
      {T.general.ajustes}
    </Text>
  );

  return (
    <View>
      <Text style={estilos.seccion}>{T.fuerza.titulo}</Text>

      {mia.marcas.length === 0 ? (
        <Text style={estilos.sub}>{T.fuerza.sinNada}</Text>
      ) : (
        <>
          <View style={estilos.contenida}>
            {mia.dots !== null ? (
              <>
                <Text style={estilos.dots}>{redondear(mia.dots)}</Text>
                <Text style={estilos.dotsPie}>
                  {T.fuerza.dotsPie(mia.total !== null ? pesoLindo(mia.total, unidad) : '')}
                </Text>
                {/* El número exacto lo ven los amigos (migración 28): se dice
                    acá y no solo al activarlo. */}
                <Text style={estilos.nota}>{T.fuerza.loVenTusAmigos}</Text>
              </>
            ) : (
              <Text style={estilos.sub}>
                {mia.falta === 'marcas' && T.fuerza.faltanMarcasCorto}
                {mia.falta === 'sexo' && (
                  <>
                    {T.fuerza.faltaSexo} {aAjustes}
                    {T.fuerza.faltaSexoFin}
                  </>
                )}
                {mia.falta === 'peso' && (
                  <>
                    {T.fuerza.faltaPesoEnMarcas} {T.fuerza.misMarcas}
                    {T.fuerza.faltaPesoEnMarcasFin}
                  </>
                )}
              </Text>
            )}
          </View>

          {esSexoEstandar(sexo) && pesoCorporal !== null && (
            <DondeEstoy sexo={sexo} pesoCorporal={pesoCorporal} marcas={mia.marcas} unidad={unidad} claro={claro} />
          )}

          <View style={estilos.tira}>
            {mia.marcas
              .filter((m) => m.cuenta_dots)
              .map((m) => (
                <View key={m.ejercicio} style={estilos.tiraItem}>
                  <Text style={[estilos.dato, { color: C.tinta }]}>{pesoLindo(m.kg, unidad)}</Text>
                  <Text style={[estilos.sub, { flex: 1 }]}>{m.nombre}</Text>
                  {/* la fecha va siempre pegada al número (§16.5) */}
                  <Text style={estilos.apagado}>{fechaDeMarca(m.fecha)}</Text>
                </View>
              ))}
          </View>

          {ranking.length > 1 && (
            <>
              <Text style={[estilos.seccion, { marginTop: 22 }]}>{T.fuerza.entreAmigos}</Text>
              <View style={estilos.tarjeta}>
                {ranking.map((f, i) => {
                  const desplegado = abierto === f.id;
                  return (
                    <View key={f.id} style={i > 0 && estilos.separada}>
                      <Pressable
                        style={estilos.rankCabecera}
                        onPress={() => setAbierto(desplegado ? null : f.id)}
                        accessibilityState={{ expanded: desplegado }}
                      >
                        <Text style={[estilos.dato, { width: 18 }]}>{i + 1}</Text>
                        <Avatar url={f.avatar_url} nombre={f.username} tam={30} />
                        <Text style={[estilos.nombre, { flex: 1 }]}>{f.id === yo ? T.social.vos : f.username}</Text>
                        {/* El mismo número para todos (§16.7b). */}
                        <Text style={estilos.dato}>{redondear(f.dots)}</Text>
                      </Pressable>
                      {desplegado && (
                        <View style={estilos.rankDetalle}>
                          {f.marcas.map((m) => (
                            <View key={m.ejercicio} style={estilos.tiraItem}>
                              <Text style={[estilos.sub, { flex: 1 }]}>{m.nombre}</Text>
                              <Text style={estilos.dato}>{pesoLindo(m.kg, unidad)}</Text>
                              <Text style={estilos.apagado}>{fechaDeMarca(m.fecha)}</Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            </>
          )}
        </>
      )}
    </View>
  );
}

/**
 * Dónde cae cada marca entre la gente del mismo sexo y peso corporal (§16.8),
 * contra la tabla que viene en el repo. La CATEGORÍA va primero y más grande
 * que el porcentaje: es el dato que publica la fuente; el porcentaje lo
 * interpolamos nosotros.
 */
function DondeEstoy({
  sexo,
  pesoCorporal,
  marcas,
  unidad,
  claro,
}: {
  sexo: SexoEstandar;
  pesoCorporal: number;
  marcas: MiFuerza['marcas'];
  unidad: Unidad;
  claro: string;
}) {
  const filas = filasDondeEstoy(sexo, pesoCorporal, marcas);
  if (filas.length === 0) return null;

  return (
    <View style={estilos.donde}>
      <Text style={estilos.dondeTitulo}>{T.fuerza.dondeEstoy}</Text>
      <View style={{ gap: 14, marginTop: 12 }}>
        {filas.map((f) => (
          <View key={f.ejercicio}>
            <View style={estilos.dondeDatos}>
              <Text style={[estilos.sub, { flex: 1 }]}>{f.nombre}</Text>
              <Text style={{ color: claro, fontSize: 15 }}>{f.u.categoria}</Text>
              <Text style={estilos.pct}>{f.u.faltaParaPrincipiante === null ? `${f.u.supera}%` : ''}</Text>
            </View>
            {/* La escala crece hacia la derecha y la marca cae donde cae. */}
            <View style={estilos.escala}>
              <View style={[estilos.marca, { left: `${f.u.supera}%`, backgroundColor: claro }]} />
            </View>
            {f.u.faltaParaPrincipiante !== null && (
              // La distancia motiva sin inventar una categoría que la fuente
              // no nombra.
              <Text style={estilos.falta}>
                {f.u.faltaParaPrincipiante === 1
                  ? T.fuerza.faltaParaUno(pesoLindo(f.u.faltaParaPrincipiante, unidad))
                  : T.fuerza.faltaPara(pesoLindo(f.u.faltaParaPrincipiante, unidad))}
              </Text>
            )}
          </View>
        ))}
      </View>
      {/* Con una muestra diez veces más chica el mismo número no está igual de
          firme, y presentarlos igual le daría una precisión que no tiene. */}
      {muestraFina(sexo) && <Text style={estilos.nota}>{T.fuerza.muestraFina}</Text>}
      {filas.some((f) => f.u.fueraDeTabla) && <Text style={estilos.nota}>{T.fuerza.fueraDeTabla}</Text>}
      <Text style={estilos.nota}>
        {T.fuerza.contraQuien}{' '}
        <Text style={{ color: claro }} onPress={() => irAPestana('ajustes')} accessibilityRole="link">
          {T.fuerza.verEnAjustes}
        </Text>
      </Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  seccion: { color: C.sub, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', marginTop: 28, marginBottom: 10 },
  sub: { color: C.sub, fontSize: 14, lineHeight: 21 },
  nota: { color: C.apagado, fontSize: 12, lineHeight: 17, marginTop: 8 },
  apagado: { color: C.apagado, fontSize: 13 },
  nombre: { color: C.tinta, fontSize: 14 },
  dato: { color: C.sub, fontSize: 13, fontVariant: ['tabular-nums'] },
  contenida: {
    backgroundColor: 'rgba(138,147,168,0.06)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.linea,
    borderRadius: 2,
    padding: 16,
  },
  dots: { color: C.tinta, fontSize: 46, fontWeight: '300', letterSpacing: -1.4, fontVariant: ['tabular-nums'] },
  dotsPie: { color: C.sub, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 8 },
  tira: { gap: 2, marginTop: 12 },
  tiraItem: { flexDirection: 'row', alignItems: 'baseline', gap: 10, paddingVertical: 5, paddingHorizontal: 2 },
  tarjeta: {
    backgroundColor: 'rgba(11,13,19,0.72)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.linea,
    borderRadius: 14,
    padding: 4,
  },
  separada: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: C.linea },
  rankCabecera: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, paddingHorizontal: 12 },
  rankDetalle: { paddingLeft: 50, paddingRight: 12, paddingBottom: 10 },
  donde: { marginTop: 16, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderColor: C.linea },
  dondeTitulo: { color: C.sub, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase' },
  dondeDatos: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginBottom: 6 },
  pct: { minWidth: 34, textAlign: 'right', color: C.apagado, fontSize: 12 },
  escala: { height: 3, backgroundColor: 'rgba(160,180,220,0.09)', marginTop: 14 },
  marca: { position: 'absolute', top: -3, width: 2, height: 9 },
  falta: { color: C.apagado, fontSize: 12, marginTop: 6 },
});
