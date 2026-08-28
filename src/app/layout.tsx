import type { Metadata, Viewport } from 'next';
import { Inter, Outfit, Geist_Mono } from 'next/font/google';
import './globals.css';
import RegistroPWA from '@/components/RegistroPWA';
import VigilanteDeSesion from '@/components/VigilanteDeSesion';
import AvisoDeFallo from '@/components/AvisoDeFallo';

// Inter: todo lo que se lee. Es la más común de la web justamente porque no
// hace ruido; acá se la elige para eso, no por defecto.
const sans = Inter({
  subsets: ['latin'],
  variable: '--f-sans',
  display: 'swap',
});

// Outfit: SOLO el número grande de la racha. Geométrica, ancha y monolineal.
// Es el único lugar donde la tipografía tiene que tener carácter propio.
const numero = Outfit({
  subsets: ['latin'],
  variable: '--f-numero',
  display: 'swap',
});

// Geist Mono: SOLO datos tabulares —cifras, fechas, columnas—, donde la
// monoespaciada sirve de verdad porque alinea. Nunca en párrafos ni títulos.
const mono = Geist_Mono({
  subsets: ['latin'],
  variable: '--f-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Ascent',
  description: 'Tu racha, a escala del universo.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Ascent',
  },
  icons: {
    icon: '/icons/icono.svg',
    apple: '/icons/icono-192.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#05060a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${sans.variable} ${numero.variable} ${mono.variable}`}>
      <body>
        {children}
        <RegistroPWA />
        {/* No dibuja nada: anota en la bitácora lo que le pasa a la sesión.
            Va acá y no en una pantalla porque el deslogueo puede pasar en
            cualquiera. */}
        <VigilanteDeSesion />
        <AvisoDeFallo />
      </body>
    </html>
  );
}
