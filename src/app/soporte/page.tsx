import type { Metadata } from 'next';

/**
 * SOPORTE, que App Store Connect pide aparte de la privacidad.
 *
 * SON DOS URL DISTINTAS Y NO ES BUROCRACIA: la de privacidad dice qué se
 * guarda, esta dice a quién escribirle cuando algo no anda. Apple no acepta la
 * misma en los dos campos, y tiene razón — el que busca ayuda no quiere leer
 * una política.
 *
 * ES CORTA A PROPÓSITO. Quien llega acá tiene un problema y no vino a leer:
 * qué es la app, cómo avisar, cómo darse de baja y cómo frenar a alguien.
 */
const CORREO = 'agusconde20@gmail.com';

export const metadata: Metadata = {
  title: 'Soporte · Ascent',
  description: 'Cómo pedir ayuda, darte de baja o reportar a alguien en Ascent.',
};

export default function Soporte() {
  return (
    <main className="pantalla legal">
      <h1>Soporte</h1>
      <p className="sub">Ascent — Streak &amp; Strength</p>

      <p>
        Ascent cuenta tu racha de días de gimnasio y tu fuerza, y te compara con tus amigos. Un
        toque por día que fuiste; el resto lo lleva la app.
      </p>

      <h2>Por correo</h2>
      <p>
        <a href={`mailto:${CORREO}`}>{CORREO}</a>. Se responde en unos días; si es algo que te deja
        sin usar la app, antes.
      </p>

      <h2>Desde la app</h2>
      <p>
        <strong>Ajustes → Sugerencias.</strong> Es el camino más corto y llega con la versión de la
        app puesta, así que no hace falta que la busques.
      </p>

      <h2>Qué ayuda contar</h2>
      <ul>
        <li>Qué estabas haciendo cuando pasó, en una línea.</li>
        <li>Qué esperabas que pasara y qué pasó.</li>
        <li>Tu nombre de usuario, si el problema es con tus datos.</li>
      </ul>

      <h2>Reportar o bloquear a alguien</h2>
      <p>
        En el perfil de la persona toca <strong>Denunciar o bloquear</strong> (o mantén apretado su
        nombre en el ranking). <strong>Denunciar</strong> nos avisa con el motivo;{' '}
        <strong>Bloquear</strong> corta la amistad, evita nuevas solicitudes en las dos direcciones y
        la saca de tu ranking y del buscador. A quién bloqueaste lo ves y lo reviertes en{' '}
        <strong>Ajustes → Cuentas bloqueadas → Desbloquear</strong>.
      </p>

      <h2>Eliminar tu cuenta</h2>
      <p>
        Desde la app, en <strong>Ajustes → Eliminar mi cuenta</strong>, sin pedírselo a nadie. Se van
        tu perfil, tus días, tus sesiones, tus marcas, tu peso y tus amistades, y se quitan tus fotos.
        Qué se guarda y qué se elimina está en <a href="/privacidad">privacidad</a>.
      </p>
    </main>
  );
}
