'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { crearCliente } from '@/lib/supabase/client';
import FondoEspacial from '@/components/FondoEspacial';

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
    if (pass.length < 6) return setError('Mínimo 6 caracteres.');
    if (pass !== pass2) return setError('Las dos no coinciden.');
    setCargando(true);
    const { error } = await supabase.auth.updateUser({ password: pass });
    setCargando(false);
    if (error) {
      if (/same/i.test(error.message)) return setError('Esa ya es tu contraseña actual.');
      return setError('No se pudo cambiar. Pedí el correo de nuevo.');
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
        <div className="marca">Ascent</div>

        {haySesion === false ? (
          <>
            <p style={{ color: 'var(--sub)', fontSize: 14, textAlign: 'center', lineHeight: 1.6 }}>
              El enlace ya venció o se abrió en otro navegador.
              <br />
              Pedí uno nuevo desde la pantalla de entrada.
            </p>
            <button
              className="boton-solido"
              style={{ marginTop: 20 }}
              onClick={() => router.push('/login')}
            >
              Ir a entrar
            </button>
          </>
        ) : listo ? (
          <p className="ok-msg" style={{ fontSize: 15 }}>
            Contraseña cambiada.
          </p>
        ) : (
          <>
            <h1 style={{ fontSize: 22, fontWeight: 400, marginBottom: 6 }}>Contraseña nueva</h1>
            <p style={{ color: 'var(--sub)', fontSize: 14, marginBottom: 22 }}>
              Elegí una de al menos 6 caracteres.
            </p>
            <form onSubmit={guardar}>
              <div className="campo">
                <input
                  type="password"
                  placeholder="Contraseña nueva"
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  autoComplete="new-password"
                  autoFocus
                />
              </div>
              <div className="campo">
                <input
                  type="password"
                  placeholder="Repetila"
                  value={pass2}
                  onChange={(e) => setPass2(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <button className="boton-solido" disabled={cargando}>
                {cargando ? 'Guardando…' : 'Guardar'}
              </button>
            </form>
            {error && <p className="error-msg">{error}</p>}
          </>
        )}
      </div>
    </>
  );
}
