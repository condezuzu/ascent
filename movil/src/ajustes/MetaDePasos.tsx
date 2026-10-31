import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  CLAVE_META_PASOS,
  META_DESLIZADOR,
  META_PASOS_POR_OMISION,
  leerMeta,
  metaValida,
} from '@nucleo/pasos';
import { T } from '@nucleo/textos';
import { plataforma } from '@plataforma';
import Candado from '../Candado';
import { C, conTema } from '../colores';
import Deslizador from '../Deslizador';
import { L } from '../fuentes';
import { R } from '../roles';
import { Text } from '../Texto';
import Tocable from '../Tocable';
import FondoOctogonal from '../FondoOctogonal';
import { useTema } from '../useTema';

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
 * SE MUESTRA EN VEZ DE EXPLICARSE (propuesta H, aprobada el 31/10). Decía «Mueve la barra de Inicio
 * y el gráfico de Stats. No entra en tu racha ni la ve nadie.». Ahora se arrastra, y se mueven acá
 * mismo la barra de hoy y la línea de la semana con los pasos de verdad. El candado dice que no la
 * ve nadie. VoiceOver sigue leyendo el texto.
 *
 * SE GUARDA CON EL BOTÓN y no con cada píxel del arrastre: guardando al mover, se escribiría decenas
 * de veces para un número.
 */
export default function MetaDePasos({
  alCambiar,
  pasos = [],
}: {
  alCambiar?: (meta: number) => void;
  /** Los pasos de verdad, por día, del más viejo al más nuevo. */
  pasos?: { fecha: string; valor: number }[];
} = {}) {
  useTema();
  const [valor, setValor] = useState(META_PASOS_POR_OMISION);

  useEffect(() => {
    let vivo = true;
    plataforma.almacenamiento
      .leer(CLAVE_META_PASOS)
      .then((m) => {
        if (vivo) setValor(leerMeta(m));
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

  const lindo = valor.toLocaleString(T.general.locale);
  const semana = pasos.slice(-7);
  const hoy = semana[semana.length - 1]?.valor ?? 0;
  const techo = Math.max(valor, ...semana.map((d) => d.valor), 1);
  return (
    <View style={estilos.seccion} testID="meta-de-pasos" accessible={false} accessibilityHint={T.ajustes.metaPasosNota}>
      <View style={estilos.cabeza}>
        <Text style={estilos.titulo}>{T.ajustes.metaPasosTitulo}</Text>
        <Candado etiqueta={T.ajustes.metaPasosNota} />
      </View>
      <Text style={estilos.numero} testID="meta-valor">{lindo}</Text>
      <Deslizador
        testID="meta-deslizador"
        valor={valor}
        min={META_DESLIZADOR.min}
        max={META_DESLIZADOR.max}
        paso={META_DESLIZADOR.paso}
        alMover={setValor}
        etiqueta={T.ajustes.metaPasosTitulo}
        textoDelValor={lindo}
      />
      {/* La barra de Inicio, con los pasos de hoy: se mueve mientras se arrastra. */}
      <View style={estilos.barra}>
        <View testID="meta-barra" style={[estilos.barraLlena, { width: `${Math.min(100, (hoy / Math.max(1, valor)) * 100)}%` }]} />
      </View>
      <View style={estilos.pie}>
        <Text style={estilos.pieTexto}>{hoy.toLocaleString(T.general.locale)}</Text>
        <Text style={estilos.pieTexto}>{lindo}</Text>
      </View>
      {semana.length > 0 && (
        <View style={estilos.semana} testID="meta-semana">
          {semana.map((d) => (
            <View key={d.fecha} style={[estilos.dia, { height: `${(d.valor / techo) * 100}%` }, d.valor >= valor && estilos.diaLlega]} />
          ))}
          <View testID="meta-linea" style={[estilos.lineaMeta, { bottom: `${(valor / techo) * 100}%` }]} />
        </View>
      )}
      <Tocable style={estilos.boton} onPress={guardar} testID="meta-guardar">
        <FondoOctogonal relleno={C.claro} luz={C.claro} />
        <Text style={estilos.botonTexto}>{T.general.guardar}</Text>
      </Tocable>
    </View>
  );
}

const estilos = conTema(() => StyleSheet.create({
  seccion: { marginTop: 8 },
  cabeza: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  titulo: { ...R.etiqueta },
  numero: { color: C.claro, fontSize: 30, fontWeight: '300', letterSpacing: -1.2, fontFamily: L.dato },
  barra: { height: 3, borderRadius: 999, backgroundColor: C.barraPista, overflow: 'hidden', marginTop: 4 },
  barraLlena: { height: '100%', backgroundColor: C.claro },
  pie: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 },
  pieTexto: { color: C.sub, fontSize: 11, fontFamily: L.dato },
  semana: { height: 66, flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginTop: 14 },
  dia: { flex: 1, borderRadius: 1, backgroundColor: C.barraDentro },
  diaLlega: { backgroundColor: C.claro },
  lineaMeta: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: C.claro, opacity: 0.7 },
  boton: { marginTop: 18, paddingVertical: 13, alignItems: 'center' },
  botonTexto: { color: C.fondo, fontSize: 14.5, fontWeight: '600' },
}));
