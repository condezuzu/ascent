import { useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { codigoDeVinculo } from '@nucleo/vinculoConMoss';
import { irAPestana } from '../../src/irAPestana';
import { pedirRecibirMoss } from '../../src/recibirMoss';

/**
 * `https://…/vincular/<código>` (18/11): el enlace universal que abre Moss con un código de un uso. Va a
 * Stats y abre Moss ahí con «Vincular»; no es una pantalla propia.
 */
export default function Pantalla() {
  const router = useRouter();
  const { codigo } = useLocalSearchParams<{ codigo: string }>();
  useEffect(() => {
    // Lo que viene en la URL lo escribió cualquiera: solo pasa si tiene forma de código.
    pedirRecibirMoss(codigoDeVinculo(codigo));
    irAPestana('stats');
    router.replace('/');
  }, [router, codigo]);
  return null;
}
