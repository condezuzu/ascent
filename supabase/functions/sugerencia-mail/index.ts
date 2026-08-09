// Edge Function de Supabase: avisa por correo cada vez que entra una
// sugerencia nueva. La dispara un Database Webhook sobre INSERT en `feedback`.
//
// Manda con Resend, que es el mismo servicio que va a usar Auth como SMTP
// para la beta: se configura una sola vez.
//
// Secretos que necesita (Edge Functions -> Secrets):
//   RESEND_API_KEY     la clave de Resend
//   MAIL_DESTINO       a quién le llegan las sugerencias
//   MAIL_REMITENTE     de qué dirección salen (dominio verificado en Resend)
//   WEBHOOK_SECRET     cadena inventada, la misma que va en el header del webhook

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const DESTINO = Deno.env.get('MAIL_DESTINO');
const REMITENTE = Deno.env.get('MAIL_REMITENTE') ?? 'Ascent <onboarding@resend.dev>';
const SECRETO = Deno.env.get('WEBHOOK_SECRET');

function escapar(s: unknown): string {
  return String(s ?? '—')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

Deno.serve(async (req) => {
  // Sin esto cualquiera que descubra la URL puede hacernos mandar correos.
  if (!SECRETO || req.headers.get('x-ascent-secreto') !== SECRETO) {
    return new Response('no autorizado', { status: 401 });
  }
  if (!RESEND_API_KEY || !DESTINO) {
    return new Response('faltan secretos', { status: 500 });
  }

  let fila: Record<string, unknown> = {};
  try {
    const cuerpo = await req.json();
    fila = cuerpo?.record ?? {};
  } catch {
    return new Response('cuerpo inválido', { status: 400 });
  }

  const tipo = String(fila.tipo ?? 'idea');
  const asunto = `Ascent · ${tipo === 'bug' ? 'bug' : 'idea'} de ${fila.user_id ?? 'alguien'}`;

  const html = `
    <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px">
      <p style="font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#8a93a8;margin:0 0 12px">
        Ascent · sugerencia nueva
      </p>
      <p style="font-size:16px;line-height:1.5;white-space:pre-wrap;margin:0 0 20px">${escapar(fila.texto)}</p>
      <table style="font-size:13px;color:#555;border-collapse:collapse">
        <tr><td style="padding:2px 12px 2px 0">Tipo</td><td>${escapar(fila.tipo)}</td></tr>
        <tr><td style="padding:2px 12px 2px 0">Usuario</td><td>${escapar(fila.user_id)}</td></tr>
        <tr><td style="padding:2px 12px 2px 0">Pantalla</td><td>${escapar(fila.pantalla_origen)}</td></tr>
        <tr><td style="padding:2px 12px 2px 0">Plataforma</td><td>${escapar(fila.plataforma)}</td></tr>
        <tr><td style="padding:2px 12px 2px 0">Versión</td><td>${escapar(fila.version_app)}</td></tr>
        <tr><td style="padding:2px 12px 2px 0">Fecha</td><td>${escapar(fila.fecha)}</td></tr>
      </table>
    </div>`;

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: REMITENTE, to: [DESTINO], subject: asunto, html }),
  });

  if (!r.ok) {
    // Se devuelve el detalle para que quede en los logs de la función.
    return new Response(`resend falló: ${await r.text()}`, { status: 502 });
  }
  return new Response('ok');
});
