import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Canjea el `code` del correo/OAuth por una sesión y manda al destino.
// Cada flujo tiene su propia ruta con destino fijo (en vez de un ?next=...):
// así las Redirect URLs de Supabase son rutas limpias, sin query string, y
// no hay ningún destino que venga de afuera.
//
// `siFalla`: a dónde va cuando el enlace no se pudo canjear. El de recuperar la
// contraseña tiene una página que lo dice (4/10): antes caía en la entrada sin
// una palabra, y es el caso de todos los días con la web instalada en el iPhone
// (se pide desde la app y el correo se abre en Safari, que no tiene el
// verificador).
export async function intercambiarYRedirigir(request: Request, destino: string, siFalla = '/login') {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  // Supabase manda ?error=... cuando el enlace venció o ya se usó
  if (searchParams.get('error')) {
    return NextResponse.redirect(`${origin}${siFalla}`);
  }
  if (!code) {
    return NextResponse.redirect(`${origin}${siFalla}`);
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: object }[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(`${origin}${siFalla}`);

  return NextResponse.redirect(`${origin}${destino}`);
}
