import type { Metadata, Viewport } from 'next';
import './globals.css';
import RegistroPWA from '@/components/RegistroPWA';

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
    <html lang="es">
      <body>
        {children}
        <RegistroPWA />
      </body>
    </html>
  );
}
