import type { Metadata, Viewport } from 'next';
import { Instrument_Serif, Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import RegistroPWA from '@/components/RegistroPWA';

// Tres familias, cada una con su trabajo. La fuente del sistema es lo que
// delata a una interfaz sin decisiones tomadas.
//
// Instrument Serif: SOLO los números grandes. Una serif de contraste alto en
// el número de una racha es lo último que se espera en una app de gimnasio,
// y es justamente por eso que se recuerda.
const serif = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  variable: '--f-serif',
  display: 'swap',
});

// Geist: el texto que se lee de corrido.
const sans = Geist({
  subsets: ['latin'],
  variable: '--f-sans',
  display: 'swap',
});

// Geist Mono: etiquetas cortas y datos, nunca párrafos. En textos largos
// cansa y termina pareciendo una herramienta de programador.
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
    <html lang="es" className={`${serif.variable} ${sans.variable} ${mono.variable}`}>
      <body>
        {children}
        <RegistroPWA />
      </body>
    </html>
  );
}
