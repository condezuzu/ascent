'use client';

// LA PANTALLA REAL DE FONDO (15/10). Regla: en una propuesta visual el fondo es una
// captura de la app y lo único dibujado es lo que se propone cambiar.
//
// Las capturas las saca `supabase/fotos-nativa.mjs propuestas` de la app nativa
// corriendo en el navegador (Expo web, 390 × 844 a 2x): es el mismo código, no el
// iPhone. Al lado deja `cajas.json`, dónde quedó cada cosa, para dibujar encima en
// el lugar exacto.

import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import cajasJson from '../../../../public/galeria-propuestas/cajas.json';

export type Caja = { x: number; y: number; w: number; h: number };
export const cajas = cajasJson as unknown as Record<string, Record<string, Caja | null>>;

export const ANCHO = 390;
export const ALTO = 844;
const src = (nombre: string) => `/galeria-propuestas/${nombre}.jpg`;

/** Los colores de la app (`movil/src/colores.ts`), para lo que se dibuja encima. */
export const C = { fondo: '#05060a', hoja: '#0b0d13', tinta: '#e8ecf6', sub: '#8a93a8', apagado: '#4a5163', linea: '#1d2230', lineaFuerte: '#2a3040', claro: '#c4c2ba' };
export const FUENTE = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

export function Captura({ nombre, children, estilo }: { nombre: string; children?: ReactNode; estilo?: CSSProperties }) {
  return (
    <div style={{ position: 'relative', width: ANCHO, height: ALTO, overflow: 'hidden', background: C.fondo, fontFamily: FUENTE, ...estilo }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src(nombre)} alt="" width={ANCHO} height={ALTO} style={{ position: 'absolute', inset: 0, display: 'block' }} />
      {children}
    </div>
  );
}

/**
 * TAPA lo que la propuesta cambia, con el fondo de alrededor: cada columna va del
 * color que tiene justo arriba de la caja al que tiene justo abajo. Sobre el cielo
 * no se nota; un rectángulo de color liso sí.
 */
export function Parche({ nombre, caja, margen = 2 }: { nombre: string; caja: Caja; margen?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const img = new Image();
    img.src = src(nombre);
    img.onload = () => {
      const k = img.naturalWidth / ANCHO;
      const lienzo = document.createElement('canvas');
      lienzo.width = img.naturalWidth;
      lienzo.height = img.naturalHeight;
      const cx = lienzo.getContext('2d');
      const c = ref.current?.getContext('2d');
      if (!cx || !c || !ref.current) return;
      cx.drawImage(img, 0, 0);
      const x0 = Math.round(caja.x * k);
      const w = Math.round(caja.w * k);
      const h = Math.round(caja.h * k);
      const arriba = cx.getImageData(x0, Math.max(0, Math.round((caja.y - margen) * k)), w, 1).data;
      const abajo = cx.getImageData(x0, Math.min(lienzo.height - 1, Math.round((caja.y + caja.h + margen) * k)), w, 1).data;
      ref.current.width = w;
      ref.current.height = h;
      const salida = c.createImageData(w, h);
      for (let y = 0; y < h; y++) {
        const t = h > 1 ? y / (h - 1) : 0;
        for (let x = 0; x < w; x++) {
          const i = x * 4;
          const o = (y * w + x) * 4;
          for (let ch = 0; ch < 3; ch++) salida.data[o + ch] = arriba[i + ch] * (1 - t) + abajo[i + ch] * t;
          salida.data[o + 3] = 255;
        }
      }
      c.putImageData(salida, 0, 0);
    };
  }, [nombre, caja.x, caja.y, caja.w, caja.h, margen]);
  return <canvas ref={ref} style={{ position: 'absolute', left: caja.x, top: caja.y, width: caja.w, height: caja.h }} />;
}

/** Un pedazo de la captura, en su mismo lugar: para animar los píxeles reales. */
export function Recorte({ nombre, caja, estilo, className }: { nombre: string; caja: Caja; estilo?: CSSProperties; className?: string }) {
  return (
    <div
      className={className}
      style={{
        position: 'absolute',
        left: caja.x,
        top: caja.y,
        width: caja.w,
        height: caja.h,
        backgroundImage: `url(${src(nombre)})`,
        backgroundSize: `${ANCHO}px ${ALTO}px`,
        backgroundPosition: `${-caja.x}px ${-caja.y}px`,
        ...estilo,
      }}
    />
  );
}

/** El globito de la app (`movil/src/Globito.tsx`), con sus medidas: un renglón que flota. */
export function GlobitoApp({ texto, arriba, izquierda = 24, derecha = 24 }: { texto: string; arriba: number; izquierda?: number; derecha?: number }) {
  return (
    <div
      style={{
        position: 'absolute',
        top: arriba,
        left: izquierda,
        right: derecha,
        borderRadius: 12,
        border: `0.5px solid ${C.lineaFuerte}`,
        background: C.hoja,
        boxShadow: '0 4px 12px rgba(0,0,0,.45)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 14px',
        fontFamily: FUENTE,
      }}
    >
      <span style={{ flex: 1, color: C.tinta, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{texto}</span>
      <span style={{ position: 'relative', width: 12, height: 12, flex: 'none' }}>
        <span style={{ position: 'absolute', left: 0, top: 5.3, width: 12, height: 1.4, borderRadius: 1, background: C.apagado, transform: 'rotate(45deg)' }} />
        <span style={{ position: 'absolute', left: 0, top: 5.3, width: 12, height: 1.4, borderRadius: 1, background: C.apagado, transform: 'rotate(-45deg)' }} />
      </span>
    </div>
  );
}

/** El pin del gimnasio: una gota hueca con su punto, a trazo, del color del texto. */
export function PinGimnasio({ tam = 16, color = 'currentColor' }: { tam?: number; color?: string }) {
  return (
    <svg width={tam * 0.78} height={tam} viewBox="0 0 14 18" aria-hidden style={{ flex: 'none', display: 'block' }}>
      <path d="M7 16.6c-.4-.4-5.6-6-5.6-9.9a5.6 5.6 0 0 1 11.2 0c0 3.9-5.2 9.5-5.6 9.9z" fill="none" stroke={color} strokeWidth="1.4" strokeLinejoin="round" />
      <circle cx="7" cy="6.7" r="2.1" fill="none" stroke={color} strokeWidth="1.4" />
    </svg>
  );
}

/** El marco de una pantalla en la página de la galería, a tamaño real. */
export function Marco({ rotulo, nota, children, ancho = ANCHO }: { rotulo: ReactNode; nota?: ReactNode; children: ReactNode; ancho?: number }) {
  return (
    <section style={{ width: ancho }}>
      <div style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--sub)', marginBottom: 8, minHeight: 26 }}>{rotulo}</div>
      <div style={{ width: ancho, height: ALTO, overflow: 'hidden', borderRadius: 28, border: `1px solid ${C.linea}`, position: 'relative' }}>{children}</div>
      {nota && <p className="nota-privada" style={{ marginTop: 8, lineHeight: 1.5 }}>{nota}</p>}
    </section>
  );
}

export function Fila({ children }: { children: ReactNode }) {
  return <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, marginBottom: 34, width: 'min(1720px, 97vw)' }}>{children}</div>;
}

export function Titulito({ children }: { children: ReactNode }) {
  return <div style={{ fontSize: 11, letterSpacing: '0.24em', textTransform: 'uppercase', color: 'var(--sub)', margin: '6px 0 12px' }}>{children}</div>;
}
