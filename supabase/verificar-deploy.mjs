// ¿Producción ya sirve el código de este commit? Correr con:
//   npm run verificar:deploy
//
// Entra a producción con un navegador real y mira el CUERPO de los RPC que
// salen. Es la única forma decisiva desde afuera, y hace falta cada vez que
// una migración tiene ORDEN INVERTIDO: primero desplegar, después correrla.
//
// Deducirlo NO funciona, y las dos formas obvias fallan calladas:
//  - El nombre de los chunks cambia por el entorno, no solo por el código, así
//    que "distinto a mi build local" no significa "viejo".
//  - Buscar `localStorage` en el bundle da lo mismo antes y después del puerto
//    de almacenamiento: el módulo de plataforma queda empaquetado ahí igual.
//
// Lo que se mira es una MARCA: algo que el cliente viejo manda y el nuevo no.
import { chromium } from 'playwright';

const BASE = process.env.DEPLOY_URL ?? 'https://ascent-blush-seven.vercel.app';
const correo = process.env.CONEXION_EMAIL;
const clave = process.env.CONEXION_PASSWORD;

if (!correo || !clave) {
  console.log('Falta CONEXION_EMAIL / CONEXION_PASSWORD en .env.local.');
  process.exit(1);
}

// LA MARCA DE ESTA TANDA. Se cambia en cada migración de orden invertido.
//
// Hay dos formas y no siempre sirve la misma:
//  - `rpcViejo`: algo que el cliente anterior MANDABA y el nuevo no. Sirve
//    cuando ese RPC sale solo con abrir la app.
//  - `textoNuevo`: algo que solo existe en el cliente nuevo, en alguna
//    pantalla. Sirve cuando el cambio no se ve en ningún pedido, que es el
//    caso de la 23: agrega un parámetro a `registrar_dia`, y ese RPC sale
//    recién cuando alguien registra un día, no al entrar.
const MARCA = {
  rpcViejo: null,
  // Tanda del DOTS exacto (migración 28, orden invertido). La marca vieja era
  // 'Diagnóstico' en /ajustes, y para esta tanda ya no sirve: ese texto está
  // en el cliente viejo Y en el nuevo, así que daba DESPLEGADO siempre. Una
  // marca que no cambia con el deploy no es una marca, es un adorno.
  //
  // La de ahora es el aviso nuevo al activar el DOTS, que solo existe desde
  // el commit del DOTS exacto. Se cambia otra vez en la próxima migración de
  // orden invertido.
  // Tanda de las vidas. La marca anterior era el aviso del DOTS, que ya
  // estaba vivo desde antes: sirvió para su tanda y no para esta. Ahora es la
  // línea de las vidas en Stats, que solo existe desde el commit de las vidas.
  //
  // ES EL SEGUNDO OLVIDO DEL MISMO TIPO: la marca hay que cambiarla EN EL
  // MISMO COMMIT que la tanda, o el "DESPLEGADO" contesta sobre otra cosa.
  //
  // TANDA DE LA VENTANA DE VIDAS (migración 33): NO HAY MARCA, y decirlo es
  // mejor que dejar la anterior. Todo lo nuevo de esta tanda vive adentro de
  // una ventana que solo aparece si una vida te cubrió un día, y la cuenta de
  // prueba no tiene ninguna: desde afuera, el cliente nuevo y el viejo se ven
  // iguales. Dejar la marca de la tanda pasada habría dado DESPLEGADO
  // contestando sobre otro commit, que es el error que ya cometí dos veces.
  //
  // No hace falta igual: la 33 es ADITIVA —una columna con valor por omisión y
  // funciones que solo SUMAN una clave— así que corre antes o después del
  // deploy sin romper nada. Esta sonda es para las de orden invertido.
  textoNuevo: null,
  porQueNoHayMarca:
    'lo nuevo solo se ve adentro de la ventana de vidas, que la cuenta de prueba no puede abrir',
  /**
   * EL AUTOTEST. Un texto de la misma pantalla que tiene que estar SIEMPRE,
   * con el cliente viejo y con el nuevo.
   *
   * Sin esto la sonda no sabe distinguir "no está" de "no supe mirar", y la
   * primera versión daba TODAVÍA VIEJO de un deploy que ya había salido: leía
   * el texto apenas la red se aquietaba, antes de que Ajustes recibiera el
   * perfil y pintara sus secciones. Dos veredictos falsos seguidos.
   *
   * Se descubrió pidiéndole a mano un texto que con seguridad estaba. Ahora lo
   * hace sola, antes de cada veredicto.
   */
  siempre: 'Racha actual',
};

const navegador = await chromium.launch();
const page = await navegador.newPage();

const viejos = [];
const vistos = [];
page.on('request', (r) => {
  if (!r.url().includes('/rest/v1/rpc/')) return;
  const fn = r.url().split('/rpc/')[1].split('?')[0];
  const cuerpo = r.postData() ?? '';
  vistos.push(fn);
  if (MARCA.rpcViejo && MARCA.rpcViejo.test(cuerpo)) viejos.push(`${fn} ${cuerpo.slice(0, 120)}`);
});

try {
  // `networkidle` acá sí: hasta que React no hidrata, escribir llena el DOM y
  // no el estado, y el submit sale vacío. Ver spec/trampas.md.
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.locator('input[type=email]').fill(correo);
  await page.locator('input[type=password]').fill(clave);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 120000 });
  // La principal dispara sus RPC al montar; se le da tiempo a que salgan.
  await page.waitForTimeout(6000);
} catch (e) {
  console.log(`No se pudo entrar a ${BASE}: ${String(e).split('\n')[0]}`);
  await navegador.close();
  process.exit(1);
}

const busca = async (dice) => {
  try {
    await page.getByText(dice, { exact: false }).first().waitFor({ timeout: 30000 });
    return true;
  } catch {
    return false;
  }
};

let texto = null;
let supoMirar = true;
if (MARCA.textoNuevo) {
  try {
    await page.goto(BASE + MARCA.textoNuevo.ruta, { waitUntil: 'domcontentloaded', timeout: 120000 });
    // Primero el autotest: si no aparece lo que TIENE que estar, cualquier
    // veredicto de abajo sería inventado.
    supoMirar = await busca(MARCA.siempre);
    // Se ESPERA a que aparezca, no se lee una vez: Ajustes pinta sus secciones
    // recién cuando llega el perfil por RPC.
    texto = supoMirar ? await busca(MARCA.textoNuevo.dice) : false;
  } catch {
    supoMirar = false;
    texto = false;
  }
}

await navegador.close();

console.log(`${BASE}`);

// EL MIDDLEWARE NO PUEDE DESLOGUEAR POR UN HIPO DE RED (ver trampas.md).
//
// Esto NO depende de una marca que haya que acordarse de cambiar en cada
// tanda: pregunta por el COMPORTAMIENTO. Con una cookie de sesión que no
// sirve, el middleware nuevo deja pasar —no pudo confirmar, así que no
// desloguea— y el viejo rebotaba a /login. Un 3xx acá significa que volvió
// el bug que dejaba a alguien afuera de su propia app.
{
  const r = await fetch(`${BASE}/stats`, {
    redirect: 'manual',
    headers: { cookie: 'sb-okeanaihymbvbdmrdqph-auth-token=basura' },
  }).catch(() => null);
  if (!r) {
    console.log('  --   no pude comprobar el middleware (sin red)');
  } else if (r.status >= 300 && r.status < 400) {
    console.log(`  ATENCIÓN: con una cookie rota rebota a ${r.headers.get('location')}`);
    console.log('       Volvió el bug de deslogueo. Ver trampas.md.');
  } else {
    console.log('  ok   con una cookie de sesión rota no desloguea');
  }
}
console.log(`RPC observados: ${[...new Set(vistos)].join(', ') || '(ninguno)'}`);

if (viejos.length) {
  console.log('\nTODAVÍA VIEJO. Hay llamadas con la marca del cliente anterior:');
  for (const v of viejos) console.log('  ' + v);
  console.log('\nNO corras la migración hasta que el deploy termine.');
  process.exit(1);
}
if (MARCA.textoNuevo) {
  if (!supoMirar) {
    console.log(
      `\nNO SUPE MIRAR: no encontré "${MARCA.siempre}" en ${MARCA.textoNuevo.ruta}, y eso está\n` +
        'con el cliente viejo y con el nuevo. El problema es de la sonda, no del deploy:\n' +
        'la pantalla no cargó, la sesión no entró, o la marca del autotest quedó vieja.'
    );
    process.exit(1);
  }
  console.log(`"${MARCA.textoNuevo.dice}" en ${MARCA.textoNuevo.ruta}: ${texto ? 'sí' : 'NO'}`);
  if (!texto) {
    console.log('\nTODAVÍA VIEJO: falta lo que solo trae el cliente nuevo.');
    process.exit(1);
  }
} else if (MARCA.rpcViejo === null) {
  // SIN MARCA NO HAY VEREDICTO. Antes, con las dos marcas en null y cualquier
  // RPC a la vista, esto imprimía "DESPLEGADO" — o sea que la forma más fácil
  // de sacarle un sí era no darle nada que mirar. Es la misma familia de error
  // que dejar puesta la marca de la tanda anterior.
  console.log(
    `\nNO CONCLUYENTE: esta tanda no dejó marca${MARCA.porQueNoHayMarca ? ` (${MARCA.porQueNoHayMarca})` : ''}.\n` +
      'Esta sonda no puede decir nada del deploy. Si la migración es aditiva, no importa;\n' +
      'si es de orden invertido, hay que ponerle una marca antes de migrar.'
  );
  process.exit(1);
} else if (vistos.length === 0) {
  // Silencio no es éxito: si no se miró nada, no se sabe nada.
  console.log('\nNO CONCLUYENTE: no salió ningún RPC, así que no hay nada que mirar.');
  process.exit(1);
}
console.log('\nDESPLEGADO. Se puede migrar.');
