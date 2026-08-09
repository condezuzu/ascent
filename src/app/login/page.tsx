'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { crearCliente } from '@/lib/supabase/client';
import { borrarPerfilCache } from '@/lib/cache';
import FondoEspacial from '@/components/FondoEspacial';

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
      if (error) return setError('No pudimos entrar con esos datos.');
      // La caché puede ser de otra cuenta (teléfono compartido, sesión que
      // venció sin cerrar): si no se limpia, la primera pantalla muestra
      // por un instante la racha de otra persona.
      borrarPerfilCache();
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
      if (error) return setError(error.message);
      // Si Supabase no exige confirmar el correo, el alta ya devuelve sesión:
      // hay que entrar derecho. Mandarlo a revisar un correo que nunca va a
      // llegar lo deja mirando el login estando ya adentro.
      if (data.session) {
        router.push('/');
        router.refresh();
        return;
      }
      setAviso('Listo. Revisá tu correo para confirmar la cuenta.');
      return;
    }

    // recuperar: el mail lleva a /nueva-clave con la sesión ya abierta
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/auth/recuperar`,
    });
    setCargando(false);
    // No se distingue si el mail existe o no: decirlo filtra quién tiene cuenta.
    if (error && !/rate|limit/i.test(error.message)) {
      return setError('No pudimos enviar el correo. Probá de nuevo en un rato.');
    }
    if (error) return setError('Demasiados intentos. Esperá unos minutos.');
    setAviso('Si esa dirección tiene cuenta, le llega un correo para cambiar la contraseña.');
  }

  const titulo =
    modo === 'entrar' ? 'Entrar' : modo === 'crear' ? 'Crear cuenta' : 'Enviar correo';

  return (
    <>
      <FondoEspacial rango={1} vacio esquina="centro" velo={0.55} />
      <div className="centrado">
        <div className="marca">Ascent</div>

        {modo === 'recuperar' && (
          <p style={{ color: 'var(--sub)', fontSize: 14, marginBottom: 18, textAlign: 'center' }}>
            Te mandamos un enlace para elegir una contraseña nueva.
          </p>
        )}

        <form onSubmit={enviar}>
          <div className="campo">
            <input
              type="email"
              placeholder="Correo"
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
                placeholder="Contraseña"
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

        {modo === 'entrar' && (
          <>
            <div className="separador">o</div>
            <button className="boton-fantasma" onClick={conGoogle}>
              Continuar con Google
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
              ¿Primera vez? Crear cuenta
            </button>
            <button className="boton-texto" onClick={() => cambiarModo('recuperar')}>
              Olvidé mi contraseña
            </button>
          </>
        ) : (
          <button
            className="boton-texto"
            onClick={() => cambiarModo('entrar')}
            style={{ marginTop: 14 }}
          >
            Volver a entrar
          </button>
        )}

        {error && <p className="error-msg">{error}</p>}
        {aviso && <p className="ok-msg">{aviso}</p>}
      </div>
    </>
  );
}
