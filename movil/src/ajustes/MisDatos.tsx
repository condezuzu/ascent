import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { juntarMisDatos } from '@compartido/cuenta';
import type { Perfil } from '@nucleo/tipos';
import { T } from '@nucleo/textos';
import { supabase } from '../supabase';
import { C } from '../colores';

/**
 * LLEVARSE TODO: el historial entero en un archivo.
 *
 * EN LA WEB ES UNA DESCARGA. Acá no hay carpeta de descargas: el archivo se
 * escribe en el espacio de la app y se abre la hoja de compartir, que es de
 * donde sale "Guardar en Archivos", mandarlo por correo o pasarlo a la
 * computadora. Es el camino del sistema, no uno nuestro.
 *
 * LO QUE SE LLEVA LO DECIDE `compartido/cuenta.ts`, el mismo archivo que usa la
 * web: los días, las sesiones, las marcas, los pesos, las fotos —los caminos,
 * no las imágenes— y de los amigos SOLO el nombre. Es mi lista de amigos, no un
 * volcado de los datos de otra gente.
 *
 * SE GUARDA EN EL DIRECTORIO DE CACHÉ y no en el de documentos: es un archivo
 * de salida, no algo que la app tenga que conservar. El sistema lo limpia solo
 * cuando necesita lugar, y así un volcado viejo no queda ocupando el teléfono
 * para siempre.
 */
export default function MisDatos({ perfil }: { perfil: Perfil }) {
  const [exportando, setExportando] = useState(false);
  const [error, setError] = useState('');

  async function exportar() {
    setError('');
    setExportando(true);
    try {
      const datos = await juntarMisDatos(supabase, perfil.id);
      const nombre = `ascent-${perfil.username ?? 'mis-datos'}-${new Date().toISOString().slice(0, 10)}.json`;
      const ruta = `${FileSystem.cacheDirectory}${nombre}`;
      await FileSystem.writeAsStringAsync(ruta, JSON.stringify(datos, null, 2));
      // Si el sistema no puede compartir —pasa en la vista web de desarrollo—
      // se dice en vez de dejar un archivo escrito que nadie va a ver.
      if (!(await Sharing.isAvailableAsync())) throw new Error('sin compartir');
      await Sharing.shareAsync(ruta, { mimeType: 'application/json', UTI: 'public.json' });
    } catch {
      setError(T.ajustes.exportarError);
    } finally {
      setExportando(false);
    }
  }

  return (
    <View style={estilos.seccion}>
      <Text style={estilos.titulo}>{T.ajustes.misDatos}</Text>
      <Pressable style={[estilos.boton, exportando && estilos.apagado]} onPress={exportar} disabled={exportando}>
        <Text style={estilos.botonTexto}>{exportando ? T.ajustes.exportando : T.ajustes.exportar}</Text>
      </Pressable>
      <Text style={estilos.nota}>{T.ajustes.exportarNota}</Text>
      {error !== '' && <Text style={estilos.error}>{error}</Text>}
    </View>
  );
}

const estilos = StyleSheet.create({
  seccion: { marginTop: 30 },
  titulo: { color: C.sub, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 },
  boton: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.lineaFuerte,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  apagado: { opacity: 0.45 },
  botonTexto: { color: C.tinta, fontSize: 14 },
  nota: { color: C.apagado, fontSize: 12, lineHeight: 17, marginTop: 8 },
  error: { color: C.error, fontSize: 13, marginTop: 8 },
});
