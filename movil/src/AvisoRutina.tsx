import { useCallback, useEffect, useState } from 'react';
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
 * Va encima de la barra, donde va el recorrido, y por eso espera a que el
 * recorrido no esté. Los dos botones la dan por vista: es un aviso, no una
 * pregunta que haya que contestar bien.
 */
type Novedad = { clave: string; columna: 'comparte_rutina' | 'comparte_gimnasio'; requiere: Funcion; texto: string };
const NOVEDADES: Novedad[] = [
  { clave: CLAVE_AVISO_RUTINA, columna: 'comparte_rutina', requiere: 'rutinaDeAmigo', get texto() { return T.social.avisoRutina; } },
  { clave: CLAVE_AVISO_ENTRENO, columna: 'comparte_gimnasio', requiere: 'avisoDeEntrenoPrendido', get texto() { return T.social.avisoEntreno; } },
];

export default function AvisoRutina() {
  const [aviso, setAviso] = useState<{ uid: string; novedad: Novedad } | null>(null);

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

  if (!aviso) return null;

  async function visto(irAAjustes: boolean) {
    if (!aviso) return;
    const { uid: yo, novedad } = aviso;
    setAviso(null);
    if (irAAjustes) irAPestana('ajustes');
    const crudo = await plataforma.almacenamiento.leer(novedad.clave).catch(() => null);
    await plataforma.almacenamiento.guardar(novedad.clave, conEsteVisto(crudo, yo)).catch(() => undefined);
  }

  return (
    <View testID="aviso-rutina" style={estilos.tarjeta} accessibilityRole="alert">
      <Text style={estilos.texto}>{aviso.novedad.texto}</Text>
      <View style={estilos.botones}>
        <Pressable testID="aviso-rutina-entendido" style={estilos.borde} onPress={() => void visto(false)} hitSlop={10}>
          <Text style={estilos.bordeTexto}>{T.social.avisoRutinaEntendido}</Text>
        </Pressable>
        <Pressable testID="aviso-rutina-ajustes" style={estilos.solido} onPress={() => void visto(true)}>
          <Text style={estilos.solidoTexto}>{T.social.avisoRutinaAjustes}</Text>
        </Pressable>
      </View>
    </View>
  );
}

// La misma tarjeta que el recorrido: es el mismo lugar y la misma voz.
const estilos = StyleSheet.create({
  tarjeta: {
    marginHorizontal: 12,
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.lineaFuerte,
    backgroundColor: conAlfa(C.hoja, 0.96),
  },
  texto: { color: C.tinta, fontSize: 15, lineHeight: 21 },
  botones: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
  borde: { borderWidth: StyleSheet.hairlineWidth, borderColor: C.lineaFuerte, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 18 },
  bordeTexto: { color: C.tinta, fontSize: 14 },
  solido: { backgroundColor: C.tinta, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 18 },
  solidoTexto: { color: C.fondo, fontSize: 14, fontWeight: '600' },
});
