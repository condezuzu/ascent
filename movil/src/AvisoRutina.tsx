import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { leerViva, suscribirViva } from '@compartido/sesionViva';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { plataforma } from '@plataforma';
import { GUIA_DE_NUEVO } from '@compartido/guia';
import { miId } from '@compartido/quienSoy';
import { versionDelEsquema } from '@compartido/esquema';
import { disponible, type Funcion } from '@nucleo/esquema';
import { CLAVE_AVISO_ENTRENO, CLAVE_AVISO_RUTINA, conEsteVisto, quienesLoVieron, tocaAvisarDeLaRutina } from '@nucleo/avisoRutina';
import { T } from '@nucleo/textos';
import { supabase } from './supabase';
import { eventos } from '@compartido/eventos';
import { irAPestana } from './irAPestana';
import { C, conAlfa } from './colores';

/**
 * LAS NOVEDADES QUE SE AVISAN UNA SOLA VEZ. Ver `nucleo/avisoRutina.ts`.
 *
 * Son cosas que nacieron PRENDIDAS para cuentas que ya existían, y que la
 * persona tiene derecho a saber y a apagar: que sus amigos ven su rutina
 * (8/10) y que ven cuando está entrenando (12/10). De a una por vez: la
 * segunda aparece la próxima vez que se abre la app.
 *
 * Los dos botones la dan por vista: es un aviso, no una pregunta que haya que contestar bien.
 *
 * UN GLOBO, NO UNA TARJETA (21/10, a pedido: "tapa botones y empuja el contenido"). Era una
 * tarjeta en el medio de la columna, entre las pantallas y la barra: les sacaba lugar y tapaba
 * «Terminar». Ahora cuelga de un ancla de alto cero —no ocupa lugar, no mueve nada—, chico y
 * apuntando a Ajustes, que es donde se apaga. Mientras se entrena no sale: queda para después.
 */
type Novedad = { clave: string; columna: 'comparte_rutina' | 'comparte_gimnasio'; requiere: Funcion; texto: string };
const NOVEDADES: Novedad[] = [
  { clave: CLAVE_AVISO_RUTINA, columna: 'comparte_rutina', requiere: 'rutinaDeAmigo', get texto() { return T.social.avisoRutina; } },
  { clave: CLAVE_AVISO_ENTRENO, columna: 'comparte_gimnasio', requiere: 'avisoDeEntrenoPrendido', get texto() { return T.social.avisoEntreno; } },
];

export default function AvisoRutina() {
  const [aviso, setAviso] = useState<{ uid: string; novedad: Novedad } | null>(null);
  const entrenando = useSyncExternalStore(suscribirViva, leerViva).inicio !== null;
  const [ancho, setAncho] = useState(0);

  const mirar = useCallback(async () => {
    const yo = await miId(supabase);
    if (!yo) return;
    // Lo barato primero: si ya vio todas, no se le pregunta nada a la base.
    const vistas = await Promise.all(
      NOVEDADES.map(async (n) => quienesLoVieron(await plataforma.almacenamiento.leer(n.clave).catch(() => null)))
    );
    if (vistas.every((v) => v.includes(yo))) return setAviso(null);
    const version = await versionDelEsquema(supabase).catch(() => null);
    const { data, error } = await supabase.from('profiles').select('comparte_rutina, comparte_gimnasio').eq('id', yo).maybeSingle();
    const perfil = error || !data ? null : (data as Record<Novedad['columna'], boolean>);
    // Sin recorrido desde el 15/10: nada que esperar.
    const recorridoAndando = false;
    const toca = NOVEDADES.find(
      (n, i) =>
        disponible(n.requiere, version) &&
        tocaAvisarDeLaRutina({ uid: yo, vistoPor: vistas[i], recorridoAndando, comparte: perfil ? perfil[n.columna] === true : null })
    );
    setAviso(toca ? { uid: yo, novedad: toca } : null);
  }, []);

  // Al abrir y cada vez que la app vuelve adelante: el que saltó el recorrido
  // lo ve la próxima vez que mira el teléfono, no recién al reiniciar.
  useEffect(() => {
    void mirar();
    return plataforma.ciclo.alCambiar((visible) => {
      if (visible) void mirar();
    });
  }, [mirar]);

  // "Ver la guía de nuevo" la arranca con este aviso ya en pantalla: quedaban
  // las dos tarjetas apiladas. Se guarda y vuelve cuando la app pase al frente.
  useEffect(() => eventos.escuchar(GUIA_DE_NUEVO, () => setAviso(null)), []);

  if (!aviso || entrenando) return null;

  async function visto(irAAjustes: boolean) {
    if (!aviso) return;
    const { uid: yo, novedad } = aviso;
    setAviso(null);
    if (irAAjustes) irAPestana('ajustes');
    const crudo = await plataforma.almacenamiento.leer(novedad.clave).catch(() => null);
    await plataforma.almacenamiento.guardar(novedad.clave, conEsteVisto(crudo, yo)).catch(() => undefined);
  }

  // La cola cae sobre el medio de la pestaña de Ajustes: la última de cinco.
  const cola = ancho > 0 ? ancho / 10 - COLA / 2 - MARGEN : 24;
  return (
    <View style={estilos.ancla} pointerEvents="box-none" onLayout={(e) => setAncho(e.nativeEvent.layout.width)}>
      <View testID="aviso-rutina" style={estilos.globo} accessibilityRole="alert">
        <Text style={estilos.texto}>{aviso.novedad.texto}</Text>
        <View style={estilos.botones}>
          <Pressable testID="aviso-rutina-entendido" onPress={() => void visto(false)} hitSlop={10}>
            <Text style={estilos.enlace}>{T.social.avisoRutinaEntendido}</Text>
          </Pressable>
          <Pressable testID="aviso-rutina-ajustes" style={estilos.solido} onPress={() => void visto(true)} hitSlop={6}>
            <Text style={estilos.solidoTexto}>{T.social.avisoRutinaAjustes}</Text>
          </Pressable>
        </View>
        <View style={[estilos.cola, { right: cola }]} />
      </View>
    </View>
  );
}

const COLA = 12;
const MARGEN = 10;

const estilos = StyleSheet.create({
  // Alto cero: el globo cuelga para arriba, sobre las pantallas, sin sacarles lugar.
  ancla: { height: 0, zIndex: 30, elevation: 30 },
  globo: {
    position: 'absolute',
    right: MARGEN,
    bottom: 8,
    maxWidth: 250,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.lineaFuerte,
    backgroundColor: conAlfa(C.hoja, 0.97),
  },
  texto: { color: C.tinta, fontSize: 13, lineHeight: 18 },
  botones: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 14, marginTop: 8 },
  enlace: { color: C.sub, fontSize: 13 },
  solido: { backgroundColor: C.tinta, borderRadius: 999, paddingVertical: 5, paddingHorizontal: 12 },
  solidoTexto: { color: C.fondo, fontSize: 13, fontWeight: '600' },
  cola: {
    position: 'absolute',
    bottom: -COLA / 2,
    width: COLA,
    height: COLA,
    backgroundColor: conAlfa(C.hoja, 0.97),
    borderRightWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: C.lineaFuerte,
    transform: [{ rotate: '45deg' }],
  },
});
