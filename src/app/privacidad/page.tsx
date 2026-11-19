import type { Metadata } from 'next';

/**
 * LA POLÍTICA DE PRIVACIDAD, que App Store Connect pide por URL.
 *
 * NO ES UN TEXTO DE ABOGADO COPIADO: dice lo que la app guarda de verdad,
 * tabla por tabla, y el texto se escribió leyendo `supabase/schema.sql`. Si
 * mañana se guarda algo más, esto cambia en el mismo commit — una política que
 * describe una app que ya no existe es peor que no tenerla, porque parece
 * revisada.
 *
 * ES PÚBLICA Y SIN SESIÓN (ver `RUTAS_PUBLICAS` en el middleware): Apple la
 * abre sin cuenta, y quien todavía no se registró tiene derecho a leer qué le
 * van a guardar ANTES de registrarse.
 *
 * EL CORREO DE CONTACTO lo eligió el dueño (22/9). Estuvo vacío hasta que lo
 * dijo: publicar una dirección es decisión de quien la va a recibir, y una
 * política que inventa un canal que nadie lee es peor que una sin contacto.
 */
const CORREO = 'agustinconde@icloud.com';

export const metadata: Metadata = {
  title: 'Privacidad · Ascent',
  description: 'Qué guarda Ascent, dónde, y cómo se borra.',
};

const ACTUALIZADO = '19 de noviembre de 2026';

export default function Privacidad() {
  return (
    <main className="pantalla legal">
      <h1>Privacidad</h1>
      <p className="sub">Última actualización: {ACTUALIZADO}</p>

      <p>
        Ascent es una app para llevar la racha de tus entrenamientos. Lo que sigue es todo lo que guarda,
        por qué, y qué puedes hacer con eso. No hay publicidad, no hay rastreo y no se le vende ni se le
        pasa nada a nadie.
      </p>

      <h2>Qué se guarda</h2>
      <ul>
        <li>
          <strong>Tu cuenta.</strong> El correo con el que entras y tu contraseña, que se guarda cifrada y
          que nadie —tampoco nosotros— puede leer.
        </li>
        <li>
          <strong>Tu perfil.</strong> El nombre de usuario que eliges, tu foto de perfil si pones una, y
          tus preferencias: unidad de peso, días de descanso, duración del descanso y zona horaria.
        </li>
        <li>
          <strong>Tu entrenamiento.</strong> Los días que registras, las sesiones con su hora de inicio y
          fin, las series de cada bloque con su ejercicio, su peso, sus repeticiones y, si las anotas, las que
          te quedaban, y tus marcas personales.
        </li>
        <li>
          <strong>Tu peso corporal</strong>, si lo anotas. Es privado siempre: no se comparte con nadie y
          no se muestra en ninguna pantalla que vean tus amigos.
        </li>
        <li>
          <strong>Tu sexo</strong>, si lo cargas. Es opcional y sirve para una sola cosa: elegir los
          coeficientes con los que se calcula el DOTS, que es una fórmula de fuerza relativa.
        </li>
        <li>
          <strong>Las fotos que sacas</strong> para sumar al día. Nacen privadas salvo que elijas lo
          contrario, y cada foto tiene su propia visibilidad.
        </li>
        <li>
          <strong>La ubicación de tu gimnasio</strong>, si decides marcarlo. Más abajo hay un apartado
          entero, porque es el dato más delicado.
        </li>
        <li>
          <strong>Tus amistades dentro de la app</strong>: a quién le mandaste solicitud y quién te la
          aceptó.
        </li>
        <li>
          <strong>Lo que nos escribas</strong> desde Ajustes, junto con la versión de la app y la
          pantalla desde donde escribiste.
        </li>
      </ul>

      <h2>La ubicación, en detalle</h2>
      <p>
        Si marcas tu gimnasio, se guarda <strong>un punto</strong>: la latitud y la longitud de ese lugar,
        con el radio que elegiste. Eso es una coordenada precisa y queremos que lo sepas con esa palabra.
      </p>
      <p>
        Lo que <strong>no</strong> se guarda es por dónde andas. La app compara tu posición con ese único
        punto y se queda con la distancia, nunca con dónde estabas. No hay un historial de ubicación, ni
        en el servidor ni en el teléfono.
      </p>
      <p>
        El permiso se pide cuando vas a marcar el gimnasio, no al abrir la app, y puedes borrar el punto
        cuando quieras desde Ajustes. Sin punto marcado, la app no mira la ubicación nunca.
      </p>

      {/* Lo mismo que dice la privacidad de Moss de Ascent (19/11, con su 0017): las dos tienen que coincidir. */}
      <h2>Si vinculas Moss</h2>
      <p>
        Moss es otra app nuestra, de hábitos, sueño y comida. Puedes vincularla con Ascent si quieres: Ascent
        funciona igual sin ella. Son dos cuentas, cada una con su información; vincular las conecta para que
        compartan estos datos, no las junta en una.
      </p>
      <ul>
        <li>
          <strong>Ascent le pasa a Moss:</strong> tus entrenamientos (el día, la hora en que empezaste, los
          minutos, los ejercicios con su grupo muscular y las series con el peso, las repeticiones y, si las
          anotas, las que te quedaban), tus marcas, el peso que anotas en Ascent y tu nombre de usuario.
        </li>
        <li>
          <strong>Moss le pasa a Ascent:</strong> cuánto dormiste, cuánto necesitas dormir y cómo dijiste que
          dormiste, tu deuda de sueño, tu energía del día, lo que comes por día y por comida (las calorías, la
          proteína, los carbohidratos y las grasas, con la hora de cada comida) y tus metas de cada día, tu
          peso, cuánto bajas por semana, tu objetivo (bajar, mantener o subir) y tu experiencia entrenando
          (principiante, intermedio o avanzado).
        </li>
        <li>
          <strong>Tus metas de fuerza</strong> (por ejemplo, 100 kg en press de banca) se guardan en tu cuenta
          de Moss, las ven y las cambian las dos apps mientras están vinculadas, y se borran al desvincular.
        </li>
      </ul>
      <p>
        Ascent lo usa para mostrarte tus músculos, cuáles se recuperan, por qué un ejercicio puede estar
        estancado y cuándo llegas a una meta. Nada se copia de una cuenta a la otra: cada app lee lo de la
        otra mientras están vinculadas. Se vincula solo si tú lo eliges, al tocar «Vincular», y se deshace
        en Stats › Moss › Desvincular o desde Moss. Si borras tu cuenta de Ascent, el vínculo se borra con
        ella y tu cuenta de Moss sigue intacta.
      </p>

      <h2>Qué NO se guarda</h2>
      <ul>
        <li>No hay publicidad ni perfiles publicitarios.</li>
        <li>No hay rastreo entre apps ni entre sitios, ni identificadores para eso.</li>
        <li>No se leen tus contactos, tu agenda, tu historial de navegación ni tus otras fotos.</li>
        <li>No hay analíticas de terceros mirando lo que haces adentro de la app.</li>
      </ul>

      <h2>Quién lo ve</h2>
      <p>
        Tus datos son tuyos. Tus amigos dentro de la app ven lo que la app dice que ven: tu nombre, tu
        racha, tu rango y las fotos que marcaste como compartidas. Tu peso, tu sexo, tu correo y la
        ubicación de tu gimnasio <strong>no los ve nadie más que tú</strong>.
      </p>
      <p>
        La base de datos y las fotos están en Supabase, y la app está publicada en Vercel. Las dos son
        proveedores que guardan los datos por nosotros y no los usan para nada propio.
      </p>

      <h2>Borrar todo</h2>
      <p>
        Desde Ajustes puedes <strong>eliminar tu cuenta</strong>. Se va el perfil, los días, las
        sesiones, las marcas, el peso y las amistades, y se quitan todas tus fotos. No queda una copia
        esperando.
      </p>
      <p>
        También puedes <strong>exportar tus datos</strong> y quedarte con ellos antes de irte. Eso está
        en Ajustes, por ahora en la versión web.
      </p>

      {CORREO && (
        <>
          <h2>Contacto</h2>
          <p>
            Cualquier duda sobre esto, escribe a <a href={`mailto:${CORREO}`}>{CORREO}</a>.
          </p>
        </>
      )}
    </main>
  );
}
