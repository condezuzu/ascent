import { intercambiarYRedirigir } from '@/lib/supabase/intercambiar';

// Entrada normal: alta por correo y login con Google.
export async function GET(request: Request) {
  return intercambiarYRedirigir(request, '/');
}
