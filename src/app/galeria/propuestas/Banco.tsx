import type { ReactNode } from 'react';
import Link from 'next/link';

// EL BANCO DE PROPUESTAS. Cada propuesta se arma acá, al lado de lo que hay
// hoy, y la app no se toca: lo que existe es el piso a superar, y solo con las
// dos a la vista se puede decidir si la nueva lo supera.

export function Banco({ titulo, queEs, children }: { titulo: string; queEs: string; children: ReactNode }) {
  return (
    // A la izquierda y no centrado: en una pantalla ancha el cuerpo del fondo
    // vive abajo a la derecha, y centrado quedaba debajo de lo que se compara.
    <main style={{ position: 'relative', zIndex: 1, maxWidth: 900, padding: '18px 20px 70px max(20px, 5vw)' }}>
      <Link
        href="/galeria/propuestas"
        className="boton-texto"
        style={{ display: 'inline-block', width: 'auto', textAlign: 'left', padding: '0 0 10px' }}
      >
        ← Propuestas
      </Link>
      <div className="titulo-pantalla" style={{ marginLeft: 0 }}>
        {titulo}
      </div>
      <p style={{ color: 'var(--sub)', fontSize: 14, lineHeight: 1.5, margin: '0 0 22px', maxWidth: 620 }}>{queEs}</p>
      {children}
    </main>
  );
}

export function Comparar({ children }: { children: ReactNode }) {
  return <div style={{ display: 'flex', flexWrap: 'wrap', gap: 28, alignItems: 'flex-start' }}>{children}</div>;
}

// Cada lado tiene el ancho de un teléfono: comparar dos listas a media
// pantalla cada una sería comparar otra cosa.
export function Lado({ rotulo, nota, children }: { rotulo: string; nota?: string; children: ReactNode }) {
  return (
    <section style={{ flex: '1 1 340px', maxWidth: 390, minWidth: 0 }}>
      <div style={{ fontSize: 11, letterSpacing: '0.24em', textTransform: 'uppercase', color: 'var(--sub)', marginBottom: 8 }}>
        {rotulo}
      </div>
      <div
        style={{
          border: '1px solid var(--linea)',
          padding: '18px var(--sangria) 22px calc(var(--sangria) + var(--saliente))',
          background: 'color-mix(in srgb, var(--fondo) 62%, transparent)',
        }}
      >
        {children}
      </div>
      {nota && (
        <p className="nota-privada" style={{ marginTop: 8, lineHeight: 1.5 }}>
          {nota}
        </p>
      )}
    </section>
  );
}
