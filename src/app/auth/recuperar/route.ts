import { intercambiarYRedirigir } from '@/lib/supabase/intercambiar';

// Recuperar contraseña: el enlace del correo abre sesión y cae en la pantalla
// para elegir una nueva. Ruta propia para que la Redirect URL sea limpia.
export async function GET(request: Request) {
  return intercambiarYRedirigir(request, '/nueva-clave');
}
