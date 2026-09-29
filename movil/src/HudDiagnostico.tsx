import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { eventos } from '@compartido/eventos';
import { plataforma } from '@plataforma';
import { consultasDeSalud } from './plataforma/salud';

/**
 * EL MEDIDOR EN PANTALLA, para cazar el lag EN EL TELÉFONO (28/9).
 *
 * El `medirCuadros` de Diagnóstico es de una corrida y no dibuja nada mientras
 * mide. Esto es lo contrario: un cartelito SIEMPRE visible con los cuadros por
 * segundo, el peor cuadro del último medio segundo, y la última consulta a
 * Salud —qué fue y cuánto tardó—. Así, entrando a Stats en el gimnasio, se ve
 * al toque si el tirón coincide con una lectura de HealthKit.
 *
 * VA DETRÁS DE UN INTERRUPTOR EN AJUSTES (Diagnóstico): no es un dato de
 * producto, es un banco de trabajo. Prendido, lee la preferencia y escucha el
 * evento; apagado, no monta el bucle de `requestAnimationFrame`, así que no
 * cuesta nada cuando no se usa.
 *
 * `pointerEvents="none"`: el cartel no se puede tocar, no tapa ningún botón.
 */
export const CLAVE_HUD = 'ascent:hud-diagnostico';
export const HUD_CAMBIO = 'hud:cambio';

export default function HudDiagnostico() {
  const [prendido, setPrendido] = useState(false);

  useEffect(() => {
    let vivo = true;
    plataforma.almacenamiento
      .leer(CLAVE_HUD)
      .then((v) => {
        if (vivo) setPrendido(v === '1');
      })
      .catch(() => {});
    // El interruptor de Ajustes avisa por el bus: prende/apaga sin reiniciar.
    const off = eventos.escuchar(HUD_CAMBIO, (d) => setPrendido(d === true));
    return () => {
      vivo = false;
      off();
    };
  }, []);

  if (!prendido) return null;
  return <Medidor />;
}

function Medidor() {
  const [texto, setTexto] = useState('midiendo…');
  const cuadros = useRef(0);
  const desde = useRef(Date.now());
  const anterior = useRef(Date.now());
  const peor = useRef(0);

  useEffect(() => {
    let vivo = true;
    let id = 0;
    const paso = () => {
      if (!vivo) return;
      const ahora = Date.now();
      const hueco = ahora - anterior.current;
      anterior.current = ahora;
      if (hueco > peor.current) peor.current = hueco;
      cuadros.current++;
      // Se redibuja el cartel dos veces por segundo, no por cuadro: un setState
      // por cuadro sería el medidor midiéndose a sí mismo.
      const transcurrido = ahora - desde.current;
      if (transcurrido >= 500) {
        const fps = Math.round((cuadros.current / transcurrido) * 1000);
        const s = consultasDeSalud();
        const salud = s ? `Salud ${s.tipo} ${s.ms}ms (${s.total})` : 'Salud —';
        setTexto(`${fps} fps · peor ${Math.round(peor.current)}ms · ${salud}`);
        cuadros.current = 0;
        desde.current = ahora;
        peor.current = 0;
      }
      id = requestAnimationFrame(paso);
    };
    id = requestAnimationFrame(paso);
    return () => {
      vivo = false;
      cancelAnimationFrame(id);
    };
  }, []);

  return (
    <View pointerEvents="none" style={estilos.hud}>
      <Text style={estilos.texto}>{texto}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  hud: {
    position: 'absolute',
    top: 54,
    left: 8,
    right: 8,
    zIndex: 9999,
    alignItems: 'flex-start',
  },
  texto: {
    color: '#9dff9d',
    backgroundColor: 'rgba(0,0,0,0.6)',
    fontSize: 11,
    fontFamily: 'Courier',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 5,
    overflow: 'hidden',
  },
});
