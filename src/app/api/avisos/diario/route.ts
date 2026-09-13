import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';
import { avisoDiario } from '@nucleo/avisoDiario';

/**
 * EL AVISO DE LAS 20:30. La llama el cron de Vercel una vez por día (ver
 * `vercel.json`) y a nadie más le contesta.
 *
 * QUÉ HACE, en orden:
 *  1. Comprueba el secreto. Sin `CRON_SECRET` configurado NO corre: una ruta
 *     que manda notificaciones a todos no puede quedar abierta por olvidarse
 *     una variable.
 *  2. Le pide a la base a quién avisarle. `tomar_avisos_del_dia` ya anota el
 *     día en la misma sentencia, así que si Vercel reintenta, la segunda vez
 *     no encuentra a nadie: uno por día, nunca dos.
 *  3. Manda. Si el servicio de push dice que la dirección no existe más
 *     (404/410: desinstalaron la app, revocaron el permiso), se borra.
 *
 * LO QUE SE ELIGIÓ PERDER: como el día se anota ANTES de mandar, un fallo de
 * red justo en ese envío hace que ese día no llegue. La otra opción era
 * reintentar, y un reintento mal hecho es mandar el aviso dos veces. Entre no
 * avisar una noche y avisar dos veces, lo segundo le enseña a la persona a
 * apagar las notificaciones.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto) {
    return NextResponse.json({ error: 'falta CRON_SECRET' }, { status: 500 });
  }
  if (request.headers.get('authorization') !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const servicio = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const publica = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privada = process.env.VAPID_PRIVATE_KEY;
  const sujeto = process.env.VAPID_SUBJECT;
  const faltan = Object.entries({
    NEXT_PUBLIC_SUPABASE_URL: url,
    SUPABASE_SERVICE_ROLE_KEY: servicio,
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: publica,
    VAPID_PRIVATE_KEY: privada,
    VAPID_SUBJECT: sujeto,
  })
    .filter(([, v]) => !v)
    .map(([k]) => k);
  // Se dicen los NOMBRES de lo que falta, nunca los valores.
  if (faltan.length) {
    return NextResponse.json({ error: 'faltan variables', faltan }, { status: 500 });
  }

  const base = createClient(url!, servicio!, { auth: { persistSession: false } });
  webpush.setVapidDetails(sujeto!, publica!, privada!);

  const { data, error } = await base.rpc('tomar_avisos_del_dia');
  if (error) {
    return NextResponse.json({ error: 'la base no contestó', detalle: error.message }, { status: 502 });
  }

  const filas = (data ?? []) as { endpoint: string; p256dh: string; auth: string; racha: number }[];
  let mandados = 0;
  let olvidados = 0;
  let fallidos = 0;

  await Promise.all(
    filas.map(async (f) => {
      try {
        await webpush.sendNotification(
          { endpoint: f.endpoint, keys: { p256dh: f.p256dh, auth: f.auth } },
          JSON.stringify(avisoDiario(f.racha)),
          // Tres horas y no más: a la medianoche el día ya cambió, y un aviso
          // de "hoy no fuiste" que llega mañana a la mañana es mentira.
          { TTL: 3 * 60 * 60, urgency: 'normal' }
        );
        mandados++;
      } catch (e) {
        const codigo = (e as { statusCode?: number }).statusCode;
        if (codigo === 404 || codigo === 410) {
          await base.rpc('olvidar_suscripcion_push', { p_endpoint: f.endpoint });
          olvidados++;
        } else {
          fallidos++;
        }
      }
    })
  );

  // Solo cuentas: ninguna dirección de push sale de acá.
  return NextResponse.json({ candidatos: filas.length, mandados, olvidados, fallidos });
}
