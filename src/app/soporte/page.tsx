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
 * cómo avisar, qué mandar, y cuánto va a tardar la respuesta.
 */
const CORREO = 'agustinconde@icloud.com';

export const metadata: Metadata = {
  title: 'Soporte · Ascent',
  description: 'Cómo reportar algo que no anda en Ascent.',
};

export default function Soporte() {
  return (
    <main className="pantalla legal">
      <h1>Soporte</h1>
      <p className="sub">Ascent — Streak &amp; Strength</p>

      <p>
        ¿Algo no anda, o algo te parece que está mal pensado? Las dos cosas sirven y se contestan
        igual.
      </p>

      <h2>Desde la app</h2>
      <p>
        <strong>Ajustes → Sugerencias.</strong> Es el camino más corto y llega con la versión de la
        app puesta, así que no hace falta que la busques.
      </p>

      <h2>Por correo</h2>
      <p>
        <a href={`mailto:${CORREO}`}>{CORREO}</a>. Se responde en unos días; si es algo que te deja
        sin usar la app, antes.
      </p>

      <h2>Qué ayuda contar</h2>
      <ul>
        <li>Qué estabas haciendo cuando pasó, en una línea.</li>
        <li>Qué esperabas que pasara y qué pasó.</li>
        <li>Tu nombre de usuario, si el problema es con tus datos.</li>
        <li>
          Si un número dice una cosa en una pantalla y otra cosa en otra: abre el botón
          <strong> Diagnóstico</strong> —abajo a la derecha— y manda esa captura. Ahí está qué
          muestra la pantalla, qué guardó el teléfono y qué tiene el servidor.
        </li>
      </ul>

      <h2>Tu cuenta</h2>
      <p>
        Puedes eliminarla desde <strong>Ajustes</strong>, dentro de la app, sin pedírselo a nadie.
        Qué se guarda y qué se borra está en <a href="/privacidad">privacidad</a>.
      </p>
    </main>
  );
}
