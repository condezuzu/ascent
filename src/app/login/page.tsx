'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { crearCliente, configuracionValida } from '@/lib/supabase/client';
import { mensajeDeAuth } from '@/lib/errores';
import { borrarPerfilCache } from '@/lib/cache';
import FondoEspacial from '@/components/FondoEspacial';
import { T } from '@nucleo/textos';

type Modo = 'entrar' | 'crear' | 'recuperar';

// Google está apagado hasta que el proveedor esté configurado en Supabase
// (Authentication → Providers → Google, con las credenciales de Google Cloud).
// Un botón que falla es peor que no tenerlo: el usuario cree que la app está
// rota. Para encenderlo alcanza con poner esto en true.
const GOOGLE_LISTO = false;

export default function Login() {
  const router = useRouter();
  const supabase = crearCliente();
  const [modo, setModo] = useState<Modo>('entrar');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [cargando, setCargando] = useState(false);

  function cambiarModo(m: Modo) {
    setModo(m);
    setError('');
    setAviso('');
  }

  async function conGoogle() {
    setError('');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/auth/callback` },
    });
    if (error) setError(error.message);
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

  return (
    <>
      <FondoEspacial rango={1} vacio esquina="centro" velo={0.55} />
      <div className="centrado">
        <div className="marca">{T.entrar.marca}</div>

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

        {modo === 'entrar' && GOOGLE_LISTO && (
          <>
            <div className="separador">{T.entrar.o}</div>
            <button className="boton-fantasma" onClick={conGoogle}>
              {T.entrar.conGoogle}
            </button>
          </>
        )}

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
