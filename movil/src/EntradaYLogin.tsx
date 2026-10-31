import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { anotarEntradaVista, vioLaEntrada } from '@compartido/entradaVista';
import Bienvenida from './Bienvenida';
import Login from './Login';
import { C, conTema } from './colores';
import { useTema } from './useTema';
import { LLEGA, LLENA } from './movimiento';

/**
 * LA ENTRADA: primero la bienvenida, después el login.
 *
 * DESDE EL 15/10 SOLO LA PRIMERA VEZ en este aparato, igual que la web: se anota al
 * terminarla, y también cuando hay una sesión (`app/_layout.tsx`), así que las
 * cuentas que ya existían no la ven al salir. Hasta el 15/10 se mostraba en cada
 * login.
 *
 * Lo que se eligió al final (crear vs entrar) abre el formulario en ese modo.
 *
 * EL PASO AL FORMULARIO TIENE TRANSICIÓN (16/10): aparecía de golpe. La entrada se
 * apaga y el formulario entra como entra cada pantalla de la bienvenida (se
 * desliza 18 puntos y aparece, con la misma curva), sobre el mismo negro.
 */
const CURVA = LLENA;
export default function EntradaYLogin({ alEntrar }: { alEntrar: () => void }) {
  useTema();
  // `null` mientras se averigua: con `true` de entrada, quien ya la vio la vería parpadear.
  const [verSlides, setVerSlides] = useState<boolean | null>(null);
  const [modo, setModo] = useState<'entrar' | 'crear'>('entrar');
  const sale = useRef(new Animated.Value(1)).current;
  const entra = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let vivo = true;
    void vioLaEntrada().then((vista) => vivo && setVerSlides(!vista));
    return () => {
      vivo = false;
    };
  }, []);

  if (verSlides === null) return null;
  if (verSlides) {
    return (
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: sale }]}>
        <Bienvenida
          alSalir={(destino) => {
            // Se anota al SALIR: si cierra la app a la mitad, la próxima vez la ve entera.
            void anotarEntradaVista();
            setModo(destino);
            Animated.timing(sale, { toValue: 0, duration: 200, easing: LLEGA, useNativeDriver: true }).start(() => {
              entra.setValue(0);
              setVerSlides(false);
              Animated.timing(entra, { toValue: 1, duration: 450, easing: CURVA, useNativeDriver: true }).start();
            });
          }}
        />
      </Animated.View>
    );
  }
  return (
    <Animated.View
      style={[estilos.todo, { opacity: entra, transform: [{ translateX: entra.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] }]}
    >
      <Login alEntrar={alEntrar} modoInicial={modo} />
    </Animated.View>
  );
}

const estilos = conTema(() => StyleSheet.create({
  todo: { flex: 1, backgroundColor: C.fondo },
}));
