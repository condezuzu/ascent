import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { irAPestana } from '../../src/irAPestana';
import { pedirRecibirMoss } from '../../src/recibirMoss';

/** `ascent://vincular`, sin código: abre Moss en Stats, como entrar tirando para abajo. */
export default function Pantalla() {
  const router = useRouter();
  useEffect(() => {
    pedirRecibirMoss(null);
    irAPestana('stats');
    router.replace('/');
  }, [router]);
  return null;
}
