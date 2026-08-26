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
  textoNuevo: { ruta: '/ajustes', dice: 'Mi gimnasio' },
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

let texto = null;
if (MARCA.textoNuevo) {
  try {
    await page.goto(BASE + MARCA.textoNuevo.ruta, { waitUntil: 'networkidle', timeout: 120000 });
    texto = (await page.locator('body').innerText()).includes(MARCA.textoNuevo.dice);
  } catch {
    texto = false;
  }
}

await navegador.close();

console.log(`${BASE}`);
console.log(`RPC observados: ${[...new Set(vistos)].join(', ') || '(ninguno)'}`);

if (viejos.length) {
  console.log('\nTODAVÍA VIEJO. Hay llamadas con la marca del cliente anterior:');
  for (const v of viejos) console.log('  ' + v);
  console.log('\nNO corras la migración hasta que el deploy termine.');
  process.exit(1);
}
if (MARCA.textoNuevo) {
  console.log(`"${MARCA.textoNuevo.dice}" en ${MARCA.textoNuevo.ruta}: ${texto ? 'sí' : 'NO'}`);
  if (!texto) {
    console.log('\nTODAVÍA VIEJO: falta lo que solo trae el cliente nuevo.');
    process.exit(1);
  }
} else if (vistos.length === 0) {
  // Silencio no es éxito: si no se miró nada, no se sabe nada.
  console.log('\nNO CONCLUYENTE: no salió ningún RPC, así que no hay nada que mirar.');
  process.exit(1);
}
console.log('\nDESPLEGADO. Se puede migrar.');
