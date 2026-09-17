import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Ejercicio } from '@nucleo/tipos';
import { ORDEN_ZONAS, gruposDeZona, zonaDeGrupo, type Zona } from '@nucleo/ejercicios';
import { tuyos, type Usado } from '@nucleo/tuyos';
import { disponible } from '@nucleo/esquema';
import { useVersionDelEsquema } from '@compartido/esquema';
import { ejerciciosUsados, usadosEnCache } from '@compartido/usados';
import { T } from '@nucleo/textos';
import Hoja from './Hoja';
import { supabase } from './supabase';
import { C } from './colores';

/**
 * ELEGIR ENTRE CIEN EJERCICIOS, NAVEGANDO. El mismo árbol que la web
 * (`nucleo/ejercicios.ts`): los tres del DOTS arriba, después zona y músculo,
 * y ahí la lista corta. Una zona con un solo músculo no pregunta dos veces.
 *
 * Y ARRIBA DE TODO, "TUYOS": los que esta persona repite de verdad. El orden
 * lo decide `nucleo/tuyos.ts`, el mismo que usa la web, así que las dos apps
 * muestran lo mismo. El árbol de abajo no se reordena nunca.
 */
export default function SelectorEjercicio({
  visible,
  ejercicios,
  valor,
  userId,
  alElegir,
  alCerrar,
}: {
  visible: boolean;
  ejercicios: Ejercicio[];
  valor: string | null;
  /** Para el atajo "Tuyos". Sin esto el selector funciona igual, sin atajo. */
  userId?: string;
  alElegir: (id: string | null) => void;
  alCerrar: () => void;
}) {
  const actual = ejercicios.find((e) => e.id === valor) ?? null;
  const [zona, setZona] = useState<Zona | null>(null);
  const [grupo, setGrupo] = useState<string | null>(null);

  // Abre donde está lo que ya tenías: pasar de press inclinado a declinado no
  // obliga a bajar todo el árbol.
  useEffect(() => {
    if (!visible) return;
    setZona(actual && !actual.cuenta_dots ? zonaDeGrupo(actual.grupo) : null);
    setGrupo(actual && !actual.cuenta_dots ? actual.grupo : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const grupos = [...new Set(ejercicios.map((e) => e.grupo))];
  const delDots = ejercicios.filter((e) => e.cuenta_dots);

  // Se pide al ABRIR y no al montar: la hoja vive montada e invisible toda la
  // sesión, así que montarla no es señal de que alguien vaya a elegir nada.
  const [usados, setUsados] = useState<Usado[]>(() => (userId ? usadosEnCache(userId) ?? [] : []));
  // La versión se pregunta antes de llamar: ver el comentario de la web.
  const version = useVersionDelEsquema();
  const hayAtajo = disponible('tusEjercicios', version);
  useEffect(() => {
    if (!visible || !userId || !hayAtajo) return;
    const yaEsta = usadosEnCache(userId);
    if (yaEsta) {
      setUsados(yaEsta);
      return;
    }
    let vivo = true;
    ejerciciosUsados(supabase, userId).then((filas) => {
      if (vivo) setUsados(filas);
    });
    return () => {
      vivo = false;
    };
  }, [visible, userId, hayAtajo]);
  const mios = tuyos(usados, ejercicios);

  function elegir(id: string | null) {
    alElegir(id);
    alCerrar();
  }

  function abrirZona(z: Zona) {
    const suyos = gruposDeZona(z, grupos);
    setZona(z);
    setGrupo(suyos.length === 1 ? suyos[0] : null);
  }

  function volver() {
    if (grupo && zona && gruposDeZona(zona, grupos).length > 1) setGrupo(null);
    else {
      setZona(null);
      setGrupo(null);
    }
  }

  const titulo = grupo ? grupo.charAt(0).toUpperCase() + grupo.slice(1) : zona ? T.ejercicios[zona] : T.sesion.queEstasHaciendo;

  const Fila = ({ texto, extra, elegido, onPress }: { texto: string; extra?: string; elegido?: boolean; onPress: () => void }) => (
    <Pressable style={estilos.fila} onPress={onPress} accessibilityRole="button">
      <Text style={[estilos.filaTexto, elegido && estilos.elegido]}>{texto}</Text>
      {extra !== undefined && <Text style={estilos.extra}>{extra}</Text>}
    </Pressable>
  );

  return (
    <Hoja visible={visible} alCerrar={alCerrar}>
      <View style={estilos.cabecera}>
        {zona && (
          <Pressable onPress={volver} style={estilos.volver} accessibilityLabel={T.general.volver}>
            <Text style={estilos.volverTexto}>←</Text>
          </Pressable>
        )}
        <Text style={estilos.titulo}>{titulo}</Text>
      </View>

      {!zona && (
        <>
          <Fila texto={T.sesion.sinEjercicio} onPress={() => elegir(null)} />
          {mios.length > 0 && (
            <>
              <Text style={estilos.rotulo}>{T.sesion.tuyos}</Text>
              {mios.map((e) => (
                <Fila
                  key={`tuyo-${e.id}`}
                  texto={e.nombre}
                  elegido={e.id === valor}
                  onPress={() => elegir(e.id)}
                />
              ))}
            </>
          )}
          <Text style={estilos.rotulo}>{T.marca.cuentanDots}</Text>
          {delDots.map((e) => (
            <Fila key={e.id} texto={e.nombre} elegido={e.id === valor} onPress={() => elegir(e.id)} />
          ))}
          <View style={estilos.separa} />
          {ORDEN_ZONAS.filter((z) => gruposDeZona(z, grupos).length > 0).map((z) => (
            <Fila key={z} texto={T.ejercicios[z]} extra="›" onPress={() => abrirZona(z)} />
          ))}
        </>
      )}

      {zona && !grupo &&
        gruposDeZona(zona, grupos).map((g) => (
          <Fila
            key={g}
            texto={g.charAt(0).toUpperCase() + g.slice(1)}
            extra={String(ejercicios.filter((e) => e.grupo === g && !e.cuenta_dots).length)}
            onPress={() => setGrupo(g)}
          />
        ))}

      {grupo &&
        ejercicios
          .filter((e) => e.grupo === grupo && !e.cuenta_dots)
          .map((e) => <Fila key={e.id} texto={e.nombre} elegido={e.id === valor} onPress={() => elegir(e.id)} />)}

      <Pressable style={estilos.cancelar} onPress={alCerrar}>
        <Text style={estilos.cancelarTexto}>{T.general.cancelar}</Text>
      </Pressable>
    </Hoja>
  );
}

const estilos = StyleSheet.create({
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  volver: { minWidth: 36, minHeight: 36, justifyContent: 'center' },
  volverTexto: { color: C.sub, fontSize: 20 },
  titulo: { color: C.tinta, fontSize: 20, fontWeight: '500' },
  rotulo: { color: C.apagado, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', marginTop: 14, marginBottom: 2 },
  separa: { height: 14 },
  fila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 48,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.linea,
  },
  filaTexto: { color: C.sub, fontSize: 16 },
  elegido: { color: C.tinta, fontWeight: '600' },
  extra: { color: C.apagado, fontSize: 14 },
  cancelar: { paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  cancelarTexto: { color: C.sub, fontSize: 14 },
});
