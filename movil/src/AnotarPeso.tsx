import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { aKilos, conComa, type Unidad } from '@nucleo/peso';
import { marcasDeRegla, pesoAcotado, pesoArrastrado, pesoInicial } from '@nucleo/reglaDePeso';
import { fechaLinda } from '@nucleo/fechas';
import { useEnVuelo } from '@compartido/useEnVuelo';
import { T } from '@nucleo/textos';
import { supabase } from './supabase';
import { FIJO } from './coloresFijos';
import { Text, CifraJunta } from './Texto';
import { L } from './fuentes';
import FondoOctogonal from './FondoOctogonal';
import ReglaConBotones from './ReglaConBotones';
import Tocable from './Tocable';

/**
 * ANOTAR EL PESO (20/10, la B de la galería): el número grande, − y + a los lados de una
 * regla que se arrastra, la última vez y «Anotar». Arranca en el último peso anotado.
 *
 * EL PESO NO REGISTRA EL DÍA, y por eso tiene su propia puerta: estuvo colgado de la hoja
 * de registrar hasta el 27/8 y pesarse un domingo contaba como día de gimnasio.
 */
export default function AnotarPeso({ unidad, alGuardar }: { unidad: Unidad; alGuardar: () => void }) {
  const [valor, setValor] = useState(() => pesoInicial(null, unidad));
  const [ultimo, setUltimo] = useState<{ fecha: string; valor: number } | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const tocado = useRef(false);

  useEffect(() => {
    let vivo = true;
    void supabase
      .from('weights')
      .select('fecha, valor')
      .order('fecha', { ascending: false })
      .limit(1)
      .then(({ data }) => {
        const u = data?.[0] as { fecha: string; valor: number } | undefined;
        if (!vivo || !u) return;
        setUltimo({ fecha: u.fecha, valor: Number(u.valor) });
        // Si ya lo empezó a mover, no se le cambia el número de abajo de los dedos.
        if (!tocado.current) setValor(pesoInicial(Number(u.valor), unidad));
      });
    return () => {
      vivo = false;
    };
  }, [unidad]);

  const guardar = useEnVuelo(async () => {
    setError('');
    setGuardando(true);
    const { error: err } = await supabase.rpc('anotar_peso', { p_valor: Math.round(aKilos(valor, unidad) * 100) / 100 });
    setGuardando(false);
    if (err) return setError(T.general.noSePudo);
    alGuardar();
  });

  return (
    <View style={estilos.todo} testID="anotar-peso">
      <View style={estilos.cifra}>
        <Text style={estilos.numero} testID="anotar-peso-valor">
          <CifraJunta texto={conComa(valor.toFixed(1))} apretar={-13} />
        </Text>
        <Text style={estilos.unidad}>{unidad}</Text>
      </View>
      <ReglaConBotones
        valor={valor}
        alCambiar={(v) => {
          tocado.current = true;
          setValor(v);
        }}
        acotar={(v) => pesoAcotado(v, unidad)}
        arrastrado={(desde, dx) => pesoArrastrado(desde, dx, unidad)}
        marcasDe={marcasDeRegla}
        paso={0.1}
        apretado={1}
        etiquetaMenos={T.peso.restar(unidad)}
        etiquetaMas={T.peso.sumar(unidad)}
        prefijo="anotar-peso"
      />
      {ultimo && <Text style={estilos.ultima}>{T.peso.ultima(conComa(pesoInicial(ultimo.valor, unidad).toFixed(1)), unidad, fechaLinda(ultimo.fecha))}</Text>}
      <Tocable style={[estilos.anotar, guardando && estilos.apagado]} onPress={() => guardar()} disabled={guardando} accessibilityRole="button" testID="anotar-peso-anotar">
        <FondoOctogonal relleno={FIJO.crema} luz={FIJO.crema} />
        <Text style={estilos.anotarTexto}>{guardando ? '…' : T.peso.anotar}</Text>
      </Tocable>
      {!!error && <Text style={estilos.error}>{error}</Text>}
    </View>
  );
}

const estilos = StyleSheet.create({
  todo: { alignItems: 'center', gap: 14, marginTop: 10 },
  cifra: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 6 },
  numero: { color: FIJO.tinta, fontSize: 64, fontWeight: '200', lineHeight: 84, fontFamily: L.dato, letterSpacing: -3 },
  unidad: { color: FIJO.sub, fontSize: 16 },
  ultima: { color: FIJO.sub, fontSize: 12, fontFamily: L.dato },
  anotar: { alignSelf: 'stretch', paddingVertical: 14, alignItems: 'center' },
  apagado: { opacity: FIJO.deshabilitado },
  anotarTexto: { color: FIJO.negro, fontSize: 15, fontWeight: '600' },
  error: { color: FIJO.error, fontSize: 13 },
});
