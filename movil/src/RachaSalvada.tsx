import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { fechaLinda } from '@nucleo/fechas';
import { T } from '@nucleo/textos';
import { plataforma } from '@plataforma';
import { C } from './colores';

/**
 * "FALTASTE Y LA RACHA SIGUIÓ." La ventana del día siguiente, en nativo.
 *
 * LAS MISMAS DECISIONES QUE LA WEB (`src/components/RachaSalvada.tsx`): toma la
 * pantalla porque es el único momento en que la app te salva de algo; no
 * felicita, porque faltar no es un mérito; "Entendido" se lleva el botón
 * sólido y "Guardarla para después" va en voz baja, porque cuesta diez días; y
 * el precio se dice con el número recién en la confirmación.
 *
 * FALTA EL GESTO: en la web el cuerpo celeste se deshace y se vuelve a armar
 * atrás del texto. Eso es el motor, que no está portado; la ventana dice
 * exactamente lo mismo sin él, igual que en la web cuando el motor no carga.
 */
export default function RachaSalvada({
  dias,
  quedan,
  total,
  rachaSiGuarda,
  alGuardar,
  alCerrar,
}: {
  dias: string[];
  quedan: number;
  total: number;
  rachaSiGuarda: number;
  /** `false` si la base no lo guardó: la ventana no puede decir que sí. */
  alGuardar: () => Promise<boolean>;
  alCerrar: () => void;
}) {
  const [paso, setPaso] = useState<'aviso' | 'confirmar' | 'guardando' | 'guardada'>('aviso');
  const [fallo, setFallo] = useState(false);

  useEffect(() => {
    plataforma.haptica.pulso();
  }, []);

  async function guardar() {
    setPaso('guardando');
    setFallo(false);
    // SOLO SI LA BASE LO GUARDÓ (bug del 15/9). Antes decía "quedó para después"
    // aunque la llamada hubiera fallado; al cerrar se marcaba vista, y la vida no
    // volvía nunca: pasados siete días ya no se puede devolver.
    const ok = await alGuardar();
    setFallo(!ok);
    setPaso(ok ? 'guardada' : 'confirmar');
  }

  const uno = dias.length === 1;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={alCerrar} statusBarTranslucent>
      <View style={estilos.fondo}>
        <View style={estilos.texto}>
          {paso === 'guardada' ? (
            <>
              <Text style={estilos.titulo}>{T.impulso.salvada.guardada(dias.length)}</Text>
              <Text style={estilos.detalle}>{T.inicio.perdida}</Text>
            </>
          ) : (
            <>
              <Text style={estilos.titulo}>{T.impulso.salvada.titulo}</Text>
              <Text style={estilos.detalle}>
                {uno ? T.impulso.faltasteUno(fechaLinda(dias[0])) : T.impulso.faltasteVarios(dias.length)}
              </Text>
              <View style={estilos.quedan}>
                <Text style={estilos.quedanTexto}>{T.impulso.quedan(quedan)}</Text>
                {Array.from({ length: total }, (_, i) => (
                  <View key={i} style={[estilos.vida, i < quedan && estilos.vidaViva]} />
                ))}
              </View>
            </>
          )}
        </View>

        <View style={estilos.botones}>
          {paso === 'aviso' && (
            <>
              <Pressable style={estilos.solido} onPress={alCerrar}>
                <Text style={estilos.solidoTexto}>{T.general.entendido}</Text>
              </Pressable>
              <Pressable style={estilos.secundario} onPress={() => setPaso('confirmar')}>
                <Text style={estilos.secundarioTexto}>{T.impulso.salvada.guardar(dias.length)}</Text>
              </Pressable>
            </>
          )}
          {(paso === 'confirmar' || paso === 'guardando') && (
            <>
              <Text style={estilos.precio}>{T.impulso.salvada.precio(dias.length, rachaSiGuarda)}</Text>
              {fallo && <Text style={[estilos.precio, estilos.peligro]}>{T.impulso.salvada.noSeGuardo}</Text>}
              <Pressable style={estilos.solido} onPress={() => setPaso('aviso')} disabled={paso === 'guardando'}>
                <Text style={estilos.solidoTexto}>{T.impulso.salvada.volver}</Text>
              </Pressable>
              <Pressable style={estilos.secundario} onPress={guardar} disabled={paso === 'guardando'}>
                <Text style={[estilos.secundarioTexto, estilos.peligro]}>
                  {paso === 'guardando' ? T.sesion.guardando : T.impulso.salvada.confirmar}
                </Text>
              </Pressable>
            </>
          )}
          {paso === 'guardada' && (
            <Pressable style={estilos.solido} onPress={alCerrar}>
              <Text style={estilos.solidoTexto}>{T.general.entendido}</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: 'rgba(5,6,10,0.96)', paddingHorizontal: 28, paddingTop: 110, paddingBottom: 40, justifyContent: 'space-between' },
  texto: {},
  titulo: { color: C.tinta, fontSize: 30, fontWeight: '300', marginBottom: 14 },
  detalle: { color: C.sub, fontSize: 16, lineHeight: 23 },
  quedan: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 18 },
  quedanTexto: { color: C.sub, fontSize: 14, marginRight: 4 },
  vida: { width: 8, height: 8, borderRadius: 4, borderWidth: 1, borderColor: C.apagado },
  vidaViva: { backgroundColor: C.claro, borderColor: C.claro },
  botones: { gap: 4 },
  precio: { color: C.sub, fontSize: 14, lineHeight: 20, marginBottom: 14, textAlign: 'center' },
  solido: { backgroundColor: C.claro, borderRadius: 2, paddingVertical: 16, alignItems: 'center' },
  solidoTexto: { color: C.fondo, fontSize: 16, fontWeight: '600' },
  secundario: { paddingVertical: 14, alignItems: 'center' },
  secundarioTexto: { color: C.sub, fontSize: 14 },
  peligro: { color: C.error },
});
