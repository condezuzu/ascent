import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import RegistroPWA from '@/components/RegistroPWA';

// PROVISORIO: la familia definitiva se está eligiendo en /tipografias.
// Mientras tanto el número grande usa la misma sans que el resto, para que
// nada quede roto. La fuente del sistema no se usa en ningún lado.
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
    <html lang="es" className={`${sans.variable} ${mono.variable}`}>
      <body>
        {children}
        <RegistroPWA />
      </body>
    </html>
  );
}
