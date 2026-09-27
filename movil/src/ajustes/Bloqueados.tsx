import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { cargarBloqueados, desbloquear, type Bloqueado } from '@compartido/ranking';
import { T } from '@nucleo/textos';
import { supabase } from '../supabase';
import Avatar from '../Avatar';
import { C } from '../colores';

/**
 * CUENTAS BLOQUEADAS (migración 53). Plegado como "Cómo se compara": el que no
 * bloqueó a nadie no tiene por qué ver la lista. Se carga al abrir, una vez.
 */
export default function Bloqueados() {
  const [abierto, setAbierto] = useState(false);
  const [lista, setLista] = useState<Bloqueado[] | null>(null);

  useEffect(() => {
    if (abierto && lista === null) {
      cargarBloqueados(supabase)
        .then(setLista)
        .catch(() => setLista([]));
    }
  }, [abierto, lista]);

  async function quitar(id: string) {
    // Optimista: sale de la lista al instante; si el RPC falla, la próxima
    // apertura lo vuelve a traer (no se pierde el bloqueo, solo la vista).
    setLista((l) => (l ?? []).filter((b) => b.id !== id));
    await desbloquear(supabase, id);
  }

  return (
    <View style={estilos.seccion}>
      <Pressable
        style={estilos.cabecera}
        onPress={() => setAbierto(!abierto)}
        accessibilityRole="button"
        accessibilityState={{ expanded: abierto }}
      >
        <Text style={estilos.titulo}>{T.ajustes.bloqueados}</Text>
        <Text style={estilos.signo}>{abierto ? '−' : '+'}</Text>
      </Pressable>

      {abierto && (
        <View>
          <Text style={estilos.pie}>{T.ajustes.bloqueadosPie}</Text>
          {lista === null ? null : lista.length === 0 ? (
            <Text style={estilos.vacio}>{T.ajustes.bloqueadosVacio}</Text>
          ) : (
            lista.map((b) => (
              <View key={b.id} style={estilos.fila}>
                <Avatar url={b.avatar_url} nombre={b.username} tam={34} />
                <Text style={estilos.nombre}>{b.username}</Text>
                <Pressable onPress={() => quitar(b.id)} hitSlop={8}>
                  <Text style={estilos.desbloquear}>{T.ajustes.desbloquear}</Text>
                </Pressable>
              </View>
            ))
          )}
        </View>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  seccion: { marginTop: 30 },
  cabecera: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  titulo: { color: C.sub, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase' },
  signo: { color: C.sub, fontSize: 18 },
  pie: { color: C.apagado, fontSize: 13, lineHeight: 19, marginTop: 8, marginBottom: 6 },
  vacio: { color: C.sub, fontSize: 14, marginTop: 12 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  nombre: { color: C.tinta, fontSize: 15, flex: 1 },
  desbloquear: { color: C.sub, fontSize: 14 },
});
