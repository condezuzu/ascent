import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  CLAVE_META_PASOS,
  META_APRETADO,
  META_PASO,
  META_PASOS_POR_OMISION,
  leerMeta,
  marcasDeMeta,
  metaAcotada,
  metaArrastrada,
  metaValida,
} from '@nucleo/pasos';
import { T } from '@nucleo/textos';
import { plataforma } from '@plataforma';
import Candado from '../Candado';
import { FIJO } from '../coloresFijos';
import { L } from '../fuentes';
import ReglaConBotones from '../ReglaConBotones';
import { CifraJunta, Text } from '../Texto';
import Tocable from '../Tocable';
import FondoOctogonal from '../FondoOctogonal';

/**
 * LA META DE PASOS DEL DÍA.
 *
 * VIVE EN EL APARATO Y NO EN LA BASE, igual que "Fondo: automático / siempre /
 * nunca". No es un dato de la persona: es cómo quiere ver un gráfico. Meterla
 * en `profiles` habría costado una migración para una preferencia que nadie más
 * va a leer nunca.
 *
 * NO ENTRA EN LA RACHA. Si los pasos contaran para la racha, esta app dejaría de
 * contar días de gimnasio y pasaría a contar otra cosa. La meta es para mirar el
 * gráfico y saber cuánto falta, y nada más.
 *
 * SE ELIGE COMO SE ANOTA EL PESO (2/11, a pedido): el número grande, − y + a los lados de la regla.
 * Con una barra no gustaba. La semana de abajo sigue mostrando, con los pasos de verdad, qué días
 * llegan a la meta que se está eligiendo. El candado dice que no la ve nadie. VoiceOver sigue
 * leyendo el texto.
 *
 * SE GUARDA CON EL BOTÓN y no con cada píxel del arrastre: guardando al mover, se escribiría decenas
 * de veces para un número.
 */
export default function MetaDePasos({
  alCambiar,
  alCancelar,
  pasos = [],
}: {
  alCambiar?: (meta: number) => void;
  alCancelar?: () => void;
  /** Los pasos de verdad, por día, del más viejo al más nuevo. */
  pasos?: { fecha: string; valor: number }[];
} = {}) {
  const [valor, setValor] = useState(META_PASOS_POR_OMISION);
  const tocado = useRef(false);

  useEffect(() => {
    let vivo = true;
    plataforma.almacenamiento
      .leer(CLAVE_META_PASOS)
      .then((m) => {
        // Si ya la empezó a mover, no se le cambia el número de abajo de los dedos.
        if (vivo && !tocado.current) setValor(leerMeta(m));
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  async function guardar() {
    if (!metaValida(valor)) return;
    // QUIEN LA MUESTRA SE ENTERA EN EL ACTO. Sin esto, cambiar la meta desde el
    // grafico dejaba la linea punteada donde estaba hasta volver a entrar, que
    // es justo lo que hace dudar de si el cambio se guardo.
    alCambiar?.(valor);
    await plataforma.almacenamiento.guardar(CLAVE_META_PASOS, String(valor)).catch(() => {});
  }

  const escribir = (n: number) => n.toLocaleString(T.general.locale);
  const semana = pasos.slice(-7);
  const techo = Math.max(valor, ...semana.map((d) => d.valor), 1);
  return (
    <View style={estilos.todo} testID="meta-de-pasos" accessible={false} accessibilityHint={T.ajustes.metaPasosNota}>
      <View style={estilos.cabeza}>
        <Text style={estilos.titulo}>{T.ajustes.metaPasosTitulo}</Text>
        <View style={estilos.candado}>
          <Candado etiqueta={T.ajustes.metaPasosNota} />
        </View>
      </View>
      <View style={estilos.cifra}>
        <Text style={estilos.numero} testID="meta-valor">
          <CifraJunta texto={escribir(valor)} apretar={-13} />
        </Text>
      </View>
      <ReglaConBotones
        valor={valor}
        alCambiar={(v) => {
          tocado.current = true;
          setValor(v);
        }}
        acotar={metaAcotada}
        arrastrado={metaArrastrada}
        marcasDe={(v, ancho) => marcasDeMeta(v, ancho, escribir)}
        paso={META_PASO}
        apretado={META_APRETADO}
        etiquetaMenos={`− ${META_PASO}`}
        etiquetaMas={`+ ${META_PASO}`}
        prefijo="meta"
      />
      {semana.length > 0 && (
        <View style={estilos.semana} testID="meta-semana">
          {semana.map((d) => (
            <View key={d.fecha} style={[estilos.dia, { height: `${(d.valor / techo) * 100}%` }, d.valor >= valor && estilos.diaLlega]} />
          ))}
          <View testID="meta-linea" style={[estilos.lineaMeta, { bottom: `${(valor / techo) * 100}%` }]} />
        </View>
      )}
      <Tocable style={estilos.boton} onPress={guardar} testID="meta-guardar" accessibilityRole="button">
        <FondoOctogonal relleno={FIJO.crema} luz={FIJO.crema} />
        <Text style={estilos.botonTexto}>{T.general.guardar}</Text>
      </Tocable>
      {alCancelar && (
        <Tocable style={estilos.cancelar} onPress={alCancelar} testID="meta-cancelar">
          <Text style={estilos.cancelarTexto}>{T.general.cancelar}</Text>
        </Tocable>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  todo: { alignItems: 'center', gap: 14 },
  cabeza: { alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  titulo: { color: FIJO.tinta, fontSize: 15, fontWeight: '600', textAlign: 'center' },
  candado: { position: 'absolute', right: 0 },
  cifra: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 6 },
  numero: { color: FIJO.tinta, fontSize: 64, fontWeight: '200', lineHeight: 84, fontFamily: L.dato, letterSpacing: -3 },
  semana: { alignSelf: 'stretch', height: 66, flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  dia: { flex: 1, borderRadius: 1, backgroundColor: FIJO.raya },
  diaLlega: { backgroundColor: FIJO.crema },
  lineaMeta: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: FIJO.sub },
  boton: { alignSelf: 'stretch', paddingVertical: 14, alignItems: 'center' },
  botonTexto: { color: FIJO.negro, fontSize: 15, fontWeight: '600' },
  cancelar: { paddingVertical: 8, alignItems: 'center' },
  cancelarTexto: { color: FIJO.sub, fontSize: 14 },
});
