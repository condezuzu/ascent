'use client';

import { useEffect, useRef } from 'react';
import { brilloEn, cielo, cuantasPara, type Estrella } from '@/lib/estrellas';

/**
 * EL FONDO DE LAS TRES PRIMERAS PANTALLAS: estrellas, en canvas 2D.
 *
 * NO ES EL MOTOR y no lo espera: three.js tarda ~3 s en arrancar y estas tres
 * pantallas existen justamente para que ese rato no se note. Doscientos puntos
 * en 2D salen en el primer cuadro.
 *
 * `desplazamiento` corre las capas a distinta velocidad —el paralaje— cuando
 * se cambia de pantalla: es lo que hace que el texto parezca moverse POR
 * DELANTE de algo, en vez de encima de una textura.
 *
 * Con "reducir movimiento" el cielo se dibuja UNA vez y no vuelve a tocarse.
 */
export default function Cielo({
  paso,
  quieto = false,
  densidad = 1,
  surge = false,
}: {
  paso: number;
  quieto?: boolean;
  /** Multiplica cuántas estrellas hay. El cielo del final va más poblado. */
  densidad?: number;
  /**
   * Que APAREZCAN, una detrás de otra, en vez de estar puestas. Es para el
   * final: después de que el agujero negro se traga todo, el espacio tiene
   * que volver a existir, no estar ahí de golpe.
   */
  surge?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const objetivo = useRef(paso);
  objetivo.current = paso;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let estrellas: Estrella[] = [];
    let ancho = 0;
    let alto = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const medir = () => {
      ancho = canvas.clientWidth;
      alto = canvas.clientHeight;
      canvas.width = Math.round(ancho * dpr);
      canvas.height = Math.round(alto * dpr);
      estrellas = cielo(Math.round(cuantasPara(ancho, alto) * densidad));
    };
    medir();
    window.addEventListener('resize', medir);

    let vivo = true;
    let pedido = 0;
    // El corrimiento llega a su destino de a poco: si saltara con el paso, el
    // cielo se movería de golpe justo cuando el texto está entrando.
    let corrimiento = paso;
    const t0 = performance.now();

    const pintar = (ahora: number) => {
      if (!vivo) return;
      const t = (ahora - t0) / 1000;
      corrimiento += (objetivo.current - corrimiento) * 0.045;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, ancho, alto);
      for (let i = 0; i < estrellas.length; i++) {
        const e = estrellas[i];
        const x = e.x * ancho - corrimiento * e.capa * 26;
        const y = e.y * alto;
        if (x < -4 || x > ancho + 4) continue;
        // Al surgir, cada una tiene su propio momento: todas juntas es un
        // interruptor, escalonadas es un cielo que aparece.
        const cuando = surge ? ((i * 37) % 100) / 100 : 0;
        const nacida = surge ? Math.min(1, Math.max(0, (t - cuando * 0.75) / 0.5)) : 1;
        if (nacida <= 0) continue;
        ctx.globalAlpha = (quieto ? e.brillo : brilloEn(e, t)) * nacida;
        ctx.fillStyle = '#cfd8f0';
        ctx.beginPath();
        ctx.arc(x, y, e.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (!quieto) pedido = requestAnimationFrame(pintar);
    };
    pedido = requestAnimationFrame(pintar);

    return () => {
      vivo = false;
      cancelAnimationFrame(pedido);
      window.removeEventListener('resize', medir);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quieto, densidad, surge]);

  return <canvas ref={ref} className="bienv-cielo" aria-hidden />;
}
