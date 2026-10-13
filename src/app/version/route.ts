// QUÉ COMMIT ESTÁ SIRVIENDO ESTE DEPLOY. Lo lee `npm run verificar:deploy`.
//
// Vercel pone el commit en el entorno de cada deploy. Antes la sonda buscaba
// una MARCA elegida a mano en cada tanda, y casi nunca había una que sirviera:
// dio "no concluyente" tres veces seguidas. Esto no hay que acordarse de
// cambiarlo. Fuera de Vercel (el dev server) contesta `null`.
export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json({ commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null }, { headers: { 'cache-control': 'no-store' } });
}
