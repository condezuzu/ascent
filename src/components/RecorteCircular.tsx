'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { T } from '@/textos';

const LADO_SALIDA = 512; // el avatar más grande que muestra la app es 104px
const ZOOM_MIN = 1;
const ZOOM_MAX = 4;

type Punto = { x: number; y: number };

/**
 * Recorte circular de la foto de perfil (§9).
 *
 * Se ve el círculo, se arrastra y se hace zoom para encuadrar. El recorte se
 * hace ACÁ, en el teléfono, y lo que sale es un cuadrado de 512 px en jpeg:
 * al storage nunca se manda la foto original de la cámara, que pesa varios
 * megas para terminar mostrándose en 104 píxeles.
 *
 * Sale cuadrado y no redondo a propósito: el círculo es el encuadre, y la
 * app ya redondea el avatar por CSS en todos lados. Un png con las esquinas
 * transparentes pesaría más y se vería igual.
 */
export default function RecorteCircular({
  archivo,
  alConfirmar,
  alCancelar,
}: {
  archivo: File;
  alConfirmar: (recorte: Blob) => void;
  alCancelar: () => void;
}) {
  const [url, setUrl] = useState('');
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [lado, setLado] = useState(300);
  const [zoom, setZoom] = useState(1);
  const [centro, setCentro] = useState<Punto>({ x: 0, y: 0 });
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState('');
  const marco = useRef<HTMLDivElement>(null);
  const punteros = useRef(new Map<number, Punto>());
  const arrastre = useRef<{ desde: Punto; centro: Punto } | null>(null);
  const pellizco = useRef<{ distancia: number; zoom: number } | null>(null);

  // El objeto de la imagen vive lo que vive el recorte: si no se revoca, cada
  // foto que el usuario descarta se queda en memoria hasta recargar la página.
  useEffect(() => {
    const u = URL.createObjectURL(archivo);
    setUrl(u);
    const im = new Image();
    im.onload = () => setImg(im);
    im.onerror = () => setError(T.recorte.noSeAbre);
    im.src = u;
    return () => URL.revokeObjectURL(u);
  }, [archivo]);

  useEffect(() => {
    const medir = () => {
      const ancho = marco.current?.clientWidth ?? 300;
      if (ancho > 0) setLado(ancho);
    };
    medir();
    window.addEventListener('resize', medir);
    return () => window.removeEventListener('resize', medir);
  }, [img]);

  // Escala mínima para que la foto TAPE el cuadro: por debajo de esto se
  // verían huecos, y un avatar con una franja vacía no es un avatar.
  const base = img ? Math.max(lado / img.naturalWidth, lado / img.naturalHeight) : 1;
  const anchoMostrado = img ? img.naturalWidth * base * zoom : 0;
  const altoMostrado = img ? img.naturalHeight * base * zoom : 0;

  // El desplazamiento nunca puede destapar un borde.
  const limitar = useCallback(
    (c: Punto, anchoAct: number, altoAct: number): Punto => {
      const topeX = Math.max(0, (anchoAct - lado) / 2);
      const topeY = Math.max(0, (altoAct - lado) / 2);
      return {
        x: Math.min(topeX, Math.max(-topeX, c.x)),
        y: Math.min(topeY, Math.max(-topeY, c.y)),
      };
    },
    [lado]
  );

  useEffect(() => {
    setCentro((c) => limitar(c, anchoMostrado, altoMostrado));
  }, [anchoMostrado, altoMostrado, limitar]);

  function distanciaEntrePunteros(): number {
    const [a, b] = [...punteros.current.values()];
    if (!a || !b) return 0;
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function alBajar(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    punteros.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (punteros.current.size === 2) {
      pellizco.current = { distancia: distanciaEntrePunteros(), zoom };
      arrastre.current = null;
    } else {
      arrastre.current = { desde: { x: e.clientX, y: e.clientY }, centro };
    }
  }

  function alMover(e: React.PointerEvent) {
    if (!punteros.current.has(e.pointerId)) return;
    punteros.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pellizco.current && punteros.current.size === 2) {
      const d = distanciaEntrePunteros();
      if (pellizco.current.distancia > 0) {
        const nuevo = Math.min(
          ZOOM_MAX,
          Math.max(ZOOM_MIN, (pellizco.current.zoom * d) / pellizco.current.distancia)
        );
        setZoom(nuevo);
      }
      return;
    }

    if (!arrastre.current || !img) return;
    const dx = e.clientX - arrastre.current.desde.x;
    const dy = e.clientY - arrastre.current.desde.y;
    setCentro(
      limitar(
        { x: arrastre.current.centro.x + dx, y: arrastre.current.centro.y + dy },
        anchoMostrado,
        altoMostrado
      )
    );
  }

  function alSoltar(e: React.PointerEvent) {
    punteros.current.delete(e.pointerId);
    if (punteros.current.size < 2) pellizco.current = null;
    if (punteros.current.size === 0) arrastre.current = null;
  }

  function confirmar() {
    if (!img) return;
    setTrabajando(true);
    setError('');
    const lienzo = document.createElement('canvas');
    lienzo.width = LADO_SALIDA;
    lienzo.height = LADO_SALIDA;
    const ctx = lienzo.getContext('2d');
    if (!ctx) {
      setTrabajando(false);
      return setError(T.recorte.noSeRecorta);
    }

    // De píxeles de pantalla a píxeles de la foto original.
    const escala = base * zoom;
    const ladoOrigen = lado / escala;
    const sx = img.naturalWidth / 2 - centro.x / escala - ladoOrigen / 2;
    const sy = img.naturalHeight / 2 - centro.y / escala - ladoOrigen / 2;

    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, sx, sy, ladoOrigen, ladoOrigen, 0, 0, LADO_SALIDA, LADO_SALIDA);
    lienzo.toBlob(
      (blob) => {
        setTrabajando(false);
        if (!blob) return setError(T.recorte.noSeRecorta);
        alConfirmar(blob);
      },
      'image/jpeg',
      0.86
    );
  }

  return (
    <>
      <div className="hoja-fondo" onClick={alCancelar} />
      <div className="hoja" role="dialog" aria-label={T.recorte.etiqueta}>
        <h2>{T.recorte.titulo}</h2>
        <p className="sub">{T.recorte.sub}</p>

        <div
          className="recorte-marco"
          ref={marco}
          onPointerDown={alBajar}
          onPointerMove={alMover}
          onPointerUp={alSoltar}
          onPointerCancel={alSoltar}
        >
          {url && img && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt=""
              draggable={false}
              style={{
                width: anchoMostrado,
                height: altoMostrado,
                left: `calc(50% + ${centro.x}px)`,
                top: `calc(50% + ${centro.y}px)`,
              }}
            />
          )}
          <div className="recorte-mascara" />
        </div>

        <input
          className="recorte-zoom"
          type="range"
          min={ZOOM_MIN}
          max={ZOOM_MAX}
          step={0.01}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          aria-label={T.recorte.acercar}
        />

        {error && <p className="error-msg">{error}</p>}

        <button className="boton-solido" onClick={confirmar} disabled={!img || trabajando}>
          {trabajando ? T.recorte.trabajando : T.recorte.usar}
        </button>
        <button className="boton-texto" onClick={alCancelar}>
          {T.general.cancelar}
        </button>
      </div>
    </>
  );
}
