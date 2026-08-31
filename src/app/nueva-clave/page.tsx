'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { crearCliente } from '@/lib/supabase/client';
import FondoEspacial from '@/components/FondoEspacial';
import { T } from '@nucleo/textos';

// Se llega acá desde el correo de recuperación (con la sesión ya abierta por
// el callback) o desde Ajustes para cambiar la contraseña estando adentro.
export default function NuevaClave() {
  const router = useRouter();
  const [supabase] = useState(() => crearCliente());
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [error, setError] = useState('');
  const [listo, setListo] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [haySesion, setHaySesion] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setHaySesion(!!data.user));
  }, [supabase]);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (pass.length < 6) return setError(T.clave.corta);
    if (pass !== pass2) return setError(T.clave.noCoinciden);
    setCargando(true);
    const { error } = await supabase.auth.updateUser({ password: pass });
    setCargando(false);
    if (error) {
      if (/same/i.test(error.message)) return setError(T.clave.esLaMisma);
      return setError(T.clave.noSePudo);
    }
    setListo(true);
    setTimeout(() => {
      router.push('/');
      router.refresh();
    }, 1400);
  }

  return (
    <>
      <FondoEspacial rango={1} vacio esquina="centro" velo={0.55} />
      <div className="centrado">
        <div className="marca">{T.entrar.marca}</div>

        {haySesion === false ? (
          <>
            <p style={{ color: 'var(--sub)', fontSize: 14, textAlign: 'center', lineHeight: 1.6 }}>
              {T.clave.enlaceVencido}
              <br />
              {T.clave.enlaceVencidoPie}
            </p>
            <button
              className="boton-solido"
              style={{ marginTop: 20 }}
              onClick={() => router.push('/login')}
            >
              {T.clave.irAEntrar}
            </button>
          </>
        ) : listo ? (
          <p className="ok-msg" style={{ fontSize: 15 }}>
            {T.clave.cambiada}
          </p>
        ) : (
          <>
            <h1 style={{ fontSize: 22, fontWeight: 400, marginBottom: 6 }}>{T.clave.titulo}</h1>
            <p style={{ color: 'var(--sub)', fontSize: 14, marginBottom: 22 }}>
              {T.clave.sub}
            </p>
            <form onSubmit={guardar}>
              <div className="campo">
                <input
                  type="password"
                  placeholder={T.clave.nueva}
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  autoComplete="new-password"
                  autoFocus
                />
              </div>
              <div className="campo">
                <input
                  type="password"
                  placeholder={T.clave.repetir}
                  value={pass2}
                  onChange={(e) => setPass2(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <button className="boton-solido" disabled={cargando}>
                {cargando ? T.sesion.guardando : T.general.guardar}
              </button>
            </form>
            {error && <p className="error-msg">{error}</p>}
          </>
        )}
      </div>
    </>
  );
}
