'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { crearCliente, configuracionValida } from '@/lib/supabase/client';
import { mensajeDeAuth } from '@nucleo/errores';
import { borrarPerfilCache } from '@compartido/cache';
import { borrarTema } from '@/plataforma/web/tema';
import FondoEspacial from '@/components/FondoEspacial';
import Bienvenida from '@/components/bienvenida/Bienvenida';
import { anotarEntradaVista, vioLaEntrada } from '@/lib/entradaVista';
import { T } from '@nucleo/textos';

type Modo = 'entrar' | 'crear' | 'recuperar';

export default function Login() {
  const router = useRouter();
  const supabase = crearCliente();
  const [modo, setModo] = useState<Modo>('entrar');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [cargando, setCargando] = useState(false);
  // LA ENTRADA VA ACÁ Y NO EN SU PROPIA RUTA: termina en negro, que es el
  // fondo de esta pantalla, y así no hay navegación en el medio — la animación
  // se convierte en el formulario sin corte. `null` mientras se averigua: con
  // `false` por omisión, el que ya la vio vería un parpadeo de la entrada.
  const [entrada, setEntrada] = useState<boolean | null>(null);

  useEffect(() => {
    vioLaEntrada().then((vista) => setEntrada(!vista));
  }, []);

  function cambiarModo(m: Modo) {
    setModo(m);
    setError('');
    setAviso('');
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setAviso('');
    setCargando(true);

    if (modo === 'entrar') {
      const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
      setCargando(false);
      if (error) return setError(mensajeDeAuth(error));
      // La caché puede ser de otra cuenta (teléfono compartido, sesión que
      // venció sin cerrar): si no se limpia, la primera pantalla muestra
      // por un instante la racha de otra persona.
      // Se ESPERA: si se navega antes de que el borrado termine, la primera
      // pantalla alcanza a leer la caché vieja, que es justo lo que esto evita.
      await borrarPerfilCache();
      borrarTema(); // y el color de esta cuenta, que se pinta antes de todo
      router.push('/');
      router.refresh();
      return;
    }

    if (modo === 'crear') {
      const { data, error } = await supabase.auth.signUp({
        email,
        password: pass,
        options: { emailRedirectTo: `${location.origin}/auth/callback` },
      });
      setCargando(false);
      if (error) return setError(mensajeDeAuth(error));
      // Si Supabase no exige confirmar el correo, el alta ya devuelve sesión:
      // hay que entrar derecho. Mandarlo a revisar un correo que nunca va a
      // llegar lo deja mirando el login estando ya adentro.
      //
      // Y va DERECHO A ONBOARDING, no a Inicio. Pasar por Inicio hacía que una
      // cuenta recién creada cargara la pantalla más pesada de la app —el
      // motor, los shaders, todos los RPC— para que Inicio descubriera que no
      // tiene nombre de usuario y la rebotara acá. Medido en el recorrido de
      // primera vez: entre 54 y 97 segundos hasta ver la primera pantalla, con
      // la app pareciendo colgada todo ese rato. Acá ya sabemos que la cuenta
      // es nueva; no hace falta que lo averigüe la pantalla más cara.
      if (data.session) {
        router.push('/onboarding');
        router.refresh();
        return;
      }
      setAviso(T.entrar.revisaCorreo);
      return;
    }

    // recuperar: el mail lleva a /nueva-clave con la sesión ya abierta
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/auth/recuperar`,
    });
    setCargando(false);
    // No se distingue si el mail existe o no: decirlo filtra quién tiene cuenta.
    // Pero un fallo de configuración o de red sí se dice, porque no es lo mismo.
    if (error) return setError(mensajeDeAuth(error));
    setAviso(T.entrar.siTieneCuenta);
  }

  const titulo =
    modo === 'entrar' ? T.entrar.entrar : modo === 'crear' ? T.entrar.crearCuenta : T.entrar.enviarCorreo;

  // Mientras no se sabe, no se pinta nada: es un instante, y cualquier cosa
  // que se muestre acá aparece para desaparecer.
  if (entrada === null) return null;

  if (entrada) {
    return (
      <Bienvenida
        alSalir={(destino) => {
          // Se anota al SALIR y no al empezar: si cierra la app a la mitad, la
          // próxima vez la ve entera, que es lo que corresponde.
          void anotarEntradaVista();
          setModo(destino === 'crear' ? 'crear' : 'entrar');
          setEntrada(false);
        }}
      />
    );
  }

  return (
    <>
      <FondoEspacial rango={1} vacio esquina="centro" velo={0.55} />
      <div className="centrado">
        <div className="marca-app">{T.entrar.marca}</div>

        {/* Si faltan o están cortadas las variables de entorno, no tiene
            sentido dejar probar contraseñas: nada va a funcionar. */}
        {!configuracionValida() && (
          <div className="aviso-config">
            <strong>{T.entrar.malConfigurada}</strong> {T.entrar.malConfiguradaDetalle}
          </div>
        )}

        {modo === 'recuperar' && (
          <p style={{ color: 'var(--sub)', fontSize: 14, marginBottom: 18, textAlign: 'center' }}>
            {T.entrar.paraRecuperar}
          </p>
        )}

        <form onSubmit={enviar}>
          <div className="campo">
            <input
              type="email"
              placeholder={T.entrar.correo}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          {modo !== 'recuperar' && (
            <div className="campo">
              <input
                type="password"
                placeholder={T.entrar.contrasena}
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                required
                minLength={6}
                autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'}
              />
            </div>
          )}
          <button className="boton-solido" disabled={cargando}>
            {cargando ? '…' : titulo}
          </button>
        </form>

        {modo === 'entrar' ? (
          <>
            <button
              className="boton-texto"
              onClick={() => cambiarModo('crear')}
              style={{ marginTop: 14 }}
            >
              {T.entrar.primeraVez}
            </button>
            <button className="boton-texto" onClick={() => cambiarModo('recuperar')}>
              {T.entrar.olvide}
            </button>
          </>
        ) : (
          <button
            className="boton-texto"
            onClick={() => cambiarModo('entrar')}
            style={{ marginTop: 14 }}
          >
            {T.entrar.volverAEntrar}
          </button>
        )}

        {error && <p className="error-msg">{error}</p>}
        {aviso && <p className="ok-msg">{aviso}</p>}
      </div>
    </>
  );
}
