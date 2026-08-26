'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { T } from '@/textos';

const ITEMS = [
  {
    href: '/',
    label: T.nav.inicio,
    icono: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 11.5 12 4l9 7.5" />
        <path d="M5.5 10.5V20h13v-9.5" />
      </svg>
    ),
  },
  {
    href: '/social',
    // "Ranking" y no "Leaderboard": más corto y en español, como el resto de
    // la app. Se quedó aunque la barra volviera a cinco: era mejor nombre
    // igual, no una concesión para que entrara.
    label: T.nav.ranking,
    icono: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
        <circle cx="12" cy="12" r="2.4" />
        <ellipse cx="12" cy="12" rx="9.5" ry="4" />
        <circle cx="20" cy="14" r="1.4" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    href: '/album',
    label: T.nav.album,
    icono: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="5" width="16" height="14" rx="2" />
        <circle cx="9.5" cy="10" r="1.6" />
        <path d="M4 16.5 9 12l4.5 4L16 14l4 3.5" />
      </svg>
    ),
  },
  {
    href: '/stats',
    label: T.nav.stats,
    icono: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
        <path d="M5 20V13" />
        <path d="M10.5 20V8" />
        <path d="M16 20v-4.5" />
        <path d="M21 20V4.5" transform="translate(-1.5 0)" />
      </svg>
    ),
  },
  {
    href: '/ajustes',
    label: T.nav.ajustes,
    icono: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5 5l2.1 2.1M16.9 16.9 19 19M19 5l-2.1 2.1M7.1 16.9 5 19" />
      </svg>
    ),
  },
];

export default function Nav() {
  const ruta = usePathname();
  return (
    <nav className="nav">
      {ITEMS.map((it) => (
        <Link key={it.href} href={it.href} className={ruta === it.href ? 'activo' : ''}>
          <span className="nav-icono">{it.icono}</span>
          <span className="nav-label">{it.label}</span>
        </Link>
      ))}
    </nav>
  );
}
