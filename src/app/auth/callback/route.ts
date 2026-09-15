import { intercambiarYRedirigir } from '@/lib/supabase/intercambiar';

// Entrada normal: el enlace del correo de alta.
export async function GET(request: Request) {
  return intercambiarYRedirigir(request, '/');
}
