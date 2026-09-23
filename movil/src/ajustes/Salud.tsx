import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { plataforma } from '@plataforma';
import { yaSePidio } from '../plataforma/salud';
import { hoyISO } from '@nucleo/fechas';
import { T } from '@nucleo/textos';
import { C } from '../colores';

/**
 * LA SALUD DEL TELÉFONO (§13c). La sección que en la web no puede existir.
 *
 * NO ESTÁ EN AJUSTES DE LA WEB y no es un olvido: el navegador no tiene
 * ninguna API que vea Apple Health, así que ahí el puerto contesta "no sé" a
 * todo y una sección que no puede hacer nada sería una promesa vacía. Es el
 * primer lugar de Ajustes donde las dos apps se separan de verdad.
 *
 * POR QUÉ EL PERMISO SE PIDE ACÁ Y NO AL ARRANCAR. Una ventana de permisos
 * apenas abrís la app se dice que no sin leerla. Acá la persona vino a buscar
 * esto, y lo de arriba dice para qué sirve antes de pedir nada. Es la misma
 * regla del punto del gimnasio.
 *
 * NO SE DICE "CONECTADO" AUNQUE PAREZCA. iOS **no informa** qué se concedió
 * para lectura —decirlo sería filtrar que tenés o no datos de algo—, así que
 * lo único honesto es mandar a Salud, donde sí se ve. Poner "conectado" y que
 * después no entre nada sería el peor de los dos mundos.
 *
 * LOS PASOS SE MUESTRAN Y NADA MÁS. No registran el día: un día de caminata
 * tiene más pasos que uno de fuerza (ver `plataforma/salud.ts`). Están porque
 * son el dato que el teléfono tiene siempre, sin reloj y sin otra app, y
 * porque son la única forma de comprobar de un vistazo que esto quedó andando.
 */
export default function Salud() {
  const hay = plataforma.salud.disponible();
  const [pidiendo, setPidiendo] = useState(false);
  const [aviso, setAviso] = useState('');
  const [pasos, setPasos] = useState<number | null>(null);
  // SI YA SE PIDIO EL PERMISO. `null` mientras se averigua: sin eso, la
  // seccion parpadea entre "Conectar" y "Conectado" en cada visita.
  const [conectado, setConectado] = useState<boolean | null>(null);

  const mirar = useCallback(async () => {
    const ya = await yaSePidio();
    setConectado(ya);
    // Los pasos solo se piden si ya se pregunto: consultar antes tira la
    // app abajo (ver `plataforma/salud.ts`).
    if (ya) setPasos(await plataforma.salud.pasosDe(hoyISO()));
  }, []);

  useEffect(() => {
    if (hay) void mirar();
  }, [hay, mirar]);

  if (!hay) {
    return (
      <View style={estilos.seccion}>
        <Text style={estilos.titulo}>{T.ajustes.salud}</Text>
        <Text style={estilos.nota}>{T.ajustes.saludNoHay}</Text>
      </View>
    );
  }

  async function conectar() {
    setPidiendo(true);
    const ok = await plataforma.salud.pedirPermiso();
    setPidiendo(false);
    setAviso(ok ? T.ajustes.saludListo : T.general.noSePudo);
    await mirar();
  }

  return (
    <View style={estilos.seccion}>
      <Text style={estilos.titulo}>{T.ajustes.salud}</Text>

      {/* EL BOTON SOLO APARECE SI FALTA PREGUNTAR. iOS no vuelve a mostrar
          la ventana una vez contestada, asi que dejarlo despues es un boton
          que no hace nada — que es como se reporto el 23/9. */}
      {conectado === false && (
        <Pressable style={estilos.boton} onPress={conectar} disabled={pidiendo}>
          <Text style={estilos.botonTexto}>
            {pidiendo ? T.ajustes.saludConectando : T.ajustes.saludConectar}
          </Text>
        </Pressable>
      )}

      {conectado === true && <Text style={estilos.conectado}>{T.ajustes.saludConectado}</Text>}

      <Text style={estilos.nota}>{T.ajustes.saludPara}</Text>
      {aviso !== '' && <Text style={estilos.nota}>{aviso}</Text>}

      {/* LOS PASOS SON LA PRUEBA DE QUE ESTA LEYENDO DE VERDAD. Mientras se
          averigua no se dice nada: "todavia no hay pasos" y "no pregunte
          todavia" no son lo mismo y se veian igual. */}
      {conectado === true && (
        <>
          <Text style={estilos.nota}>
            {pasos === null ? T.ajustes.saludSinDatos : T.ajustes.saludPasos(pasos.toLocaleString('es-UY'))}
          </Text>
          <Text style={estilos.nota}>{T.ajustes.saludPasosNota}</Text>
        </>
      )}
    </View>
  );
}
const estilos = StyleSheet.create({
  seccion: { marginTop: 30 },
  // El mismo rótulo que el resto de Ajustes: chico, en versalitas y apagado.
  titulo: { color: C.sub, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 },
  boton: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.lineaFuerte,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 10,
  },
  botonTexto: { color: C.tinta, fontSize: 14 },
  nota: { color: C.apagado, fontSize: 12, lineHeight: 17, marginTop: 8 },
  conectado: { color: C.sub, fontSize: 14, marginTop: 10 },
});
