import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { supabase } from './supabase';
import type { Perfil } from '@nucleo/tipos';
import { T } from '@nucleo/textos';
import Inicio from './Inicio';
import Stats from './Stats';
import Ranking from './Ranking';
import Album from './Album';
import Ajustes from './Ajustes';
import { despertarMotor } from './despertarMotor';
import FondoRaiz from './FondoRaiz';
import { eventos } from '@compartido/eventos';
import { IR_A_PESTANA, type Pestana } from './irAPestana';

/**
 * LA BARRA DE ABAJO, con las pantallas que ya existen en nativo.
 *
 * LAS QUE YA EXISTEN, NI UNA MÁS. Una pestaña que abre "próximamente" es un
 * botón que miente en el lugar más tocado de la app. Cada pantalla entra
 * cuando entra, en el mismo orden que la web (Ranking y Álbum desde el 18/9).
 *
 * TODAVÍA SIN ROUTER, y ahora es una decisión más fina que antes: con
 * pestañas planas, sin pantallas apiladas ni enlaces que abran una pantalla
 * del medio, un router contesta lo mismo que este `useState`. La pregunta se
 * vuelve de verdad con la primera pantalla que se apila (el perfil de un
 * amigo, el día abierto) — ahí entra Expo Router, y esto se reemplaza entero.
 *
 * SOLO SE MONTA LA PESTAÑA ACTIVA: volver a Inicio lo vuelve a cargar. Es lo
 * que hacía "volver de Ajustes" antes, y por la misma razón: cambiar los días
 * de descanso cambia qué días cortan la racha.
 */
export default function Pestanas({
  alSalir,
  alFaltarNombre,
}: {
  alSalir: () => void;
  alFaltarNombre: () => void;
}) {
  const [pestana, setPestana] = useState<Pestana>('inicio');
  const [perfil, setPerfil] = useState<Perfil | null>(null);

  // Ajustes necesita el perfil entero; se pide al entrar, no antes: Inicio ya
  // lo pide para lo suyo, y pedirlo dos veces al abrir la app es un viaje más
  // en el momento en que más se nota.
  const cargarPerfil = useCallback(async () => {
    const { data: sesion } = await supabase.auth.getSession();
    const uid = sesion.session?.user?.id;
    if (!uid) return alSalir();
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).single();
    if (data) setPerfil(data as Perfil);
  }, [alSalir]);

  useEffect(() => {
    if (pestana === 'ajustes') cargarPerfil();
  }, [pestana, cargarPerfil]);

  // "Ir a Ajustes" desde el texto de otra pantalla: ver `irAPestana.ts`.
  useEffect(() => eventos.escuchar(IR_A_PESTANA, (p) => setPestana(p as Pestana)), []);

  return (
    // CADA TOQUE DESPIERTA AL MOTOR. En la web lo escucha el `window`; acá no
    // hay `window`, y los toques los ve la vista que los recibe. `onTouchStart`
    // en la raíz los ve todos —sube desde cualquier hijo— sin quitárselos a
    // nadie. Ver `despertarMotor.ts`.
    <View style={estilos.todo} onTouchStart={despertarMotor}>
      <View style={estilos.pantalla}>
        {/* EL MOTOR VIVE ACÁ y no adentro de Inicio: un solo contexto de GL
            para toda la sesión. Inicio lo pide; las otras pestañas no, y
            mientras tanto la escena queda guardada en pausa. Ocupa el área de
            las pantallas, no la de la barra. Ver `FondoRaiz.tsx`. */}
        <FondoRaiz />
        {pestana === 'inicio' && <Inicio alSalir={alSalir} alFaltarNombre={alFaltarNombre} />}
        {pestana === 'ranking' && <Ranking alSalir={alSalir} />}
        {pestana === 'album' && <Album alSalir={alSalir} />}
        {pestana === 'stats' && <Stats alSalir={alSalir} />}
        {pestana === 'ajustes' &&
          (perfil ? (
            <Ajustes
              perfil={perfil}
              alCambiar={(parcial) => setPerfil((p) => (p ? { ...p, ...parcial } : p))}
              alSalir={alSalir}
            />
          ) : (
            <View style={estilos.centrado}>
              <ActivityIndicator color="#8a93a8" />
            </View>
          ))}
      </View>

      <View style={estilos.barra} accessibilityRole="tablist">
        {/* El orden de la web: Inicio, Ranking, Álbum, Stats, Ajustes. */}
        {(['inicio', 'ranking', 'album', 'stats', 'ajustes'] as Pestana[]).map((p) => (
          <Pressable
            key={p}
            style={estilos.boton}
            onPress={() => setPestana(p)}
            accessibilityRole="tab"
            accessibilityState={{ selected: pestana === p }}
          >
            <Text style={[estilos.texto, pestana === p && estilos.activo]}>{T.nav[p]}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  todo: { flex: 1, backgroundColor: '#05060a' },
  pantalla: { flex: 1 },
  centrado: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  barra: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#1d2230',
    paddingBottom: 22,
    paddingTop: 10,
    backgroundColor: '#05060a',
  },
  boton: { flex: 1, alignItems: 'center', paddingVertical: 6, minHeight: 44, justifyContent: 'center' },
  texto: { color: '#4a5163', fontSize: 12, letterSpacing: 0.5 },
  activo: { color: '#e8ecf6' },
});
