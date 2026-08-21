/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  // Dos procesos de Next sobre la MISMA carpeta la corrompen —es la misma
  // razón por la que no se buildea con el dev server prendido—. `npm run
  // capturas` levanta su propio servidor, así que corre con su propia carpeta
  // y el dev server del humano puede quedar tranquilo donde está.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ];
  },
};

export default nextConfig;
