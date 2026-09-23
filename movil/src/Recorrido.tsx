import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { guardarPasoDelRecorrido, leerPasoDelRecorrido, marcarRecorridoVisto } from '@compartido/guia';
import { PASOS_DEL_RECORRIDO } from '@nucleo/recorrido';
import { eventos } from '@compartido/eventos';
import { T } from '@nucleo/textos';
import { supabase } from './supabase';
import { irAPestana, type Pestana } from './irAPestana';
import { C, conAlfa } from './colores';

/** Desde Ajustes, "ver la guía de nuevo": el recorrido vuelve a arrancar. */
export const GUIA_DE_NUEVO = 'ascent:guia-de-nuevo';

/**
 * EL RECORRIDO DE LA PRIMERA VEZ (§10), la versión del teléfono.
 *
 * ES EL MISMO RECORRIDO QUE LA WEB: los cinco pasos, su orden y sus textos
 * salen de `nucleo/recorrido.ts`, y lo que ya se vio se guarda con
 * `compartido/guia.ts`. Acá está solamente cómo se dibuja.
 *
 * LO QUE REEMPLAZA: una bienvenida de cinco párrafos antes de ver nada. Una
 * línea mirando la pantalla de la que habla se entiende; cinco párrafos sobre
 * pantallas que todavía no viste, no. Por eso el recorrido no es un carrusel
 * aparte: lleva a la pantalla de verdad y habla de lo que estás viendo.
 *
 * VIVE ENCIMA DE LA BARRA porque la barra está en las cinco pantallas del
 * recorrido: puesto acá no hay que acordarse de ponerlo en cada una, que es
 * exactamente la clase de cosa que después falta en dos.
 *
 * SI TE VAS POR TU CUENTA, NO TE PERSIGUE. La tarjeta se queda diciendo en qué
 * paso vas y ofrece llevarte; no te arrastra de vuelta. Un recorrido que te
 * devuelve a los tirones cada vez que tocás otra cosa es una trampa, no una
 * guía — y lo primero que hace cualquiera con una guía es tocar otra cosa.
 *
 * EL GIMNASIO VA PRIMERO, igual que en la web: registrar el día solo al llegar
 * es lo que hace distinta a la app. El primer paso lleva a Ajustes con el
 * punto del gimnasio a la vista.
 */
export default function Recorrido({ pestana }: { pestana: Pestana }) {
  const [uid, setUid] = useState('');
  const [paso, setPaso] = useState<number | null>(null);

  const mirar = useCallback(async (u: string) => {
    setPaso(await leerPasoDelRecorrido(u));
  }, []);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const u = data.session?.user?.id;
      if (!vivo || !u) return;
      setUid(u);
      await mirar(u);
    })();
    return () => {
      vivo = false;
    };
  }, [mirar]);

  // "Ver la guía de nuevo" desde Ajustes. El que la pide está MIRANDO Ajustes,
  // así que el recorrido tiene que aparecer ahí mismo: sin este aviso había
  // que cerrar y reabrir la app para que se enterara.
  useEffect(() => {
    if (!uid) return;
    return eventos.escuchar(GUIA_DE_NUEVO, () => void mirar(uid));
  }, [uid, mirar]);

  if (paso === null) return null;
  const actual = PASOS_DEL_RECORRIDO[paso];
  if (!actual) return null;

  const aca = pestana === actual.pestana;
  const ultimo = paso === PASOS_DEL_RECORRIDO.length - 1;

  async function terminar() {
    setPaso(null);
    if (uid) await marcarRecorridoVisto(uid);
    irAPestana('inicio');
  }

  async function siguiente() {
    if (ultimo) return terminar();
    const n = (paso ?? 0) + 1;
    setPaso(n);
    // Se guarda DESPUÉS de moverse, no antes: si la escritura falla o tarda,
    // el paso igual avanza en la pantalla. Lo guardado solo sirve para
    // retomarlo si cerrás la app a la mitad.
    irAPestana(PASOS_DEL_RECORRIDO[n].pestana);
    if (uid) await guardarPasoDelRecorrido(uid, n);
  }

  return (
    <View style={estilos.tarjeta} accessibilityRole="alert">
      {/* LA CUENTA DE PASOS NO SON PUNTITOS CENTRADOS (§7): es una regla fina
          contra el borde, y el número al lado. Cinco puntos en el medio son
          cinco cosas que mirar antes de leer la única línea que importa. */}
      <View style={estilos.cuenta}>
        <View style={estilos.regla}>
          <View style={[estilos.reglaLlena, { flex: paso + 1 }]} />
          <View style={{ flex: PASOS_DEL_RECORRIDO.length - paso - 1 }} />
        </View>
        <Text style={estilos.numero}>
          {paso + 1}/{PASOS_DEL_RECORRIDO.length}
        </Text>
      </View>

      <Text style={estilos.texto}>{actual.texto}</Text>

      <View style={estilos.botones}>
        {/* "SALTAR" SIEMPRE A LA VISTA (§10). Un recorrido del que no se puede
            salir deja de ser una guía en el primer paso que no te interesa. */}
        {/* LOS `testID` SON PARA LA SONDA, y se ganan el lugar: los rótulos de
            estos dos botones cambian solos —"Ir" / "Siguiente" / "Listo"— y
            además "Ir" es una palabra de dos letras que aparece suelta en
            otras pantallas. Buscarlos por texto encontraba otra cosa. */}
        <Pressable testID="recorrido-saltar" onPress={terminar} hitSlop={10}>
          <Text style={estilos.saltar}>{T.recorrido.saltar}</Text>
        </Pressable>
        <Pressable
          testID="recorrido-avanzar"
          style={estilos.solido}
          onPress={aca ? siguiente : () => irAPestana(actual.pestana)}
        >
          <Text style={estilos.solidoTexto}>
            {aca ? (ultimo ? T.recorrido.listo : T.recorrido.siguiente) : T.recorrido.ir}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  tarjeta: {
    marginHorizontal: 12,
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.lineaFuerte,
    // Casi opaco: detrás corre el motor, y una tarjeta traslúcida encima de un
    // planeta que se mueve hace que el texto no se pueda leer.
    backgroundColor: conAlfa(C.hoja, 0.96),
  },
  cuenta: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  regla: { flex: 1, flexDirection: 'row', height: 2, backgroundColor: C.linea, borderRadius: 1 },
  reglaLlena: { backgroundColor: C.sub, borderRadius: 1 },
  numero: { color: C.apagado, fontSize: 11, letterSpacing: 1 },
  texto: { color: C.tinta, fontSize: 15, lineHeight: 21 },
  botones: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
  saltar: { color: C.apagado, fontSize: 14 },
  solido: { backgroundColor: C.tinta, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 18 },
  solidoTexto: { color: C.fondo, fontSize: 14, fontWeight: '600' },
});
