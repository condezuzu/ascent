import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Canjea el `code` del correo/OAuth por una sesión y manda al destino.
// Cada flujo tiene su propia ruta con destino fijo (en vez de un ?next=...):
// así las Redirect URLs de Supabase son rutas limpias, sin query string, y
// no hay ningún destino que venga de afuera.
export async function intercambiarYRedirigir(request: Request, destino: string) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  // Supabase manda ?error=... cuando el enlace venció o ya se usó
  if (searchParams.get('error')) {
    return NextResponse.redirect(`${origin}/login`);
  }
  if (!code) {
    return NextResponse.redirect(`${origin}/login`);
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
  if (error) return NextResponse.redirect(`${origin}/login`);

  return NextResponse.redirect(`${origin}${destino}`);
}
