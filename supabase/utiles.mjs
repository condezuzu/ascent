import { execSync } from 'node:child_process';

// Herramientas chicas compartidas por los tests.

/**
 * Un regex que matchea `palabra` como palabra entera.
 *
 * Existe porque escribir `new RegExp(`\b${x}\b`)` está MAL y no lo parece:
 * dentro de un template literal `\b` es el carácter de retroceso (0x08), no el
 * borde de palabra del regex, así que el patrón busca un byte de control y no
 * matchea nunca. Mordió tres veces, la última adentro del chequeo que existe
 * para cazar esa familia de errores.
 *
 * Acá el patrón se arma CONCATENANDO, donde `'\\b'` es inequívoco. Usar esto
 * en vez de armarlo a mano; la sección 36 de `test:db` falla si alguien vuelve
 * a escribir un `\b` suelto adentro de un template literal.
 */
export function bordeDePalabra(palabra) {
  return new RegExp('\\b' + palabra + '\\b');
}

/**
 * El código sin comentarios, para no analizar prosa.
 *
 * El `[^:]` de adelante NO es adorno: sin él, `https://` es un comentario y
 * media línea desaparece. Se devuelve el carácter que se miró, porque comerlo
 * pegaría dos palabras que estaban separadas. Y el bloque se reemplaza por un
 * espacio y no por nada, por lo mismo.
 */
export function sinComentarios(codigo) {
  return codigo
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

/**
 * Los `\b` de retroceso que quedaron adentro de un template literal.
 *
 * Se recorre carácter por carácter en vez de con un regex porque hay que saber
 * si se está DENTRO de un backtick, y eso un regex no lo sabe. Cuenta las
 * barras que preceden a la `b`: impares significa que la barra escapa a la
 * `b` —o sea el retroceso— y pares que la barra está escapada y la `b` es
 * literal, que es lo correcto.
 */
export function retrocesosEnTemplate(codigo) {
  const encontrados = [];
  let dentro = false;
  for (let i = 0; i < codigo.length; i++) {
    const c = codigo[i];
    if (c === '\\') {
      // en un template, la barra escapa al siguiente carácter
      if (dentro && codigo[i + 1] === 'b') {
        encontrados.push(codigo.slice(Math.max(0, i - 30), i + 12).replace(/\n/g, ' '));
      }
      i++;
      continue;
    }
    if (c === '`') dentro = !dentro;
  }
  return encontrados;
}

/**
 * PASAR LA PANTALLA DE ENTRADA, si está.
 *
 * Desde el 16/9 la web muestra la bienvenida ANTES del formulario, una vez por
 * aparato. Un navegador de prueba arranca siempre limpio, así que la ve
 * siempre: sin esto, cualquier sonda que entre por `/login` se queda mirando
 * "Empiezas desde el polvo" y reporta que no se pudo entrar. Que es, en el
 * fondo, la prueba de que la pantalla anda.
 *
 * Hace lo mismo que haría una persona apurada: siguiente, siguiente, tocar la
 * animación para saltarla, y "Ya tengo cuenta".
 */
/**
 * Pasa la pantalla de entrada y DEJA EL LOGIN A LA VISTA, o falla diciendo qué
 * vio.
 *
 * POR QUÉ SE REESCRIBIÓ. La versión anterior hacía lo suyo con un
 * `.catch(() => {})` en cada paso y devolvía `true` sin comprobar nada. Cuando
 * un toque no entraba —la entrada tarda en hidratar, y el motor del cuarto
 * paso más— la sonda seguía como si hubiera pasado, y treinta segundos después
 * moría en `locator('input[type=email]').fill()` con un mensaje que no dice
 * nada del problema real.
 *
 * Me costó varias corridas perdidas en un solo día, cada una con su build de
 * cinco minutos. Tragarse los errores no los hace desaparecer: los muda a un
 * lugar donde cuestan más caro.
 *
 * AHORA: intenta, COMPRUEBA que el campo de correo esté, y si no reintenta la
 * secuencia entera. Si después de tres vueltas no está, tira con la URL y lo
 * que se ve en pantalla, que es lo que hace falta para entender por qué.
 */
export async function pasarLaEntrada(page, espera = 20000) {
  const hayLogin = () => page.locator('input[type=email]').count().then((n) => n > 0);

  // LOS ERRORES DE LA PÁGINA, para el mensaje de la falla. Una pantalla en
  // blanco tiene dos causas que desde afuera se ven idénticas: todavía está
  // cargando, o el JS reventó. Sin esto hay que adivinar cuál de las dos, y
  // adivinar sale caro: cada corrida de estas lleva un build de cinco minutos.
  const errores = [];
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)));
  page.on('console', (m) => {
    if (m.type() === 'error') errores.push(m.text().slice(0, 200));
  });
  // Y CON LA URL. "Failed to load resource: 400" sin decir de QUÉ recurso es un
  // mensaje que obliga a otra corrida entera para averiguar lo que ya se sabía
  // a medias. El que falla se nombra.
  page.on('response', (r) => {
    if (r.status() >= 400) errores.push(`${r.status()} ${r.url().slice(0, 150)}`);
  });

  for (let intento = 1; intento <= 3; intento++) {
    // SE ESPERA A QUE LA PANTALLA SE DECIDA. Si la entrada está o no se sabe
    // leyendo el almacenamiento, que es asíncrono: preguntar en el primer
    // instante siempre decía "no está" y la sonda se quedaba mirándola.
    await page
      .waitForFunction(
        () => !!document.querySelector('.bienv') || !!document.querySelector('input[type=email]'),
        null,
        { timeout: espera }
      )
      .catch(() => {});

    if (await hayLogin()) return intento > 1;

    const entrada = page.locator('.bienv');
    if (await entrada.count()) {
      for (let i = 0; i < 3; i++) {
        const siguiente = page.getByRole('button', { name: 'Siguiente' });
        if (!(await siguiente.count())) break;
        await siguiente.click({ timeout: 10000 }).catch(() => {});
        await page.waitForTimeout(700);
      }
      // En la cuarta se salta tocando: el botón de saltar no existe ahí.
      await page.locator('.bienv-tocar').click({ timeout: 20000 }).catch(() => {});
      await page.getByRole('button', { name: 'Ya tengo cuenta' }).click({ timeout: 20000 }).catch(() => {});
      await entrada.waitFor({ state: 'detached', timeout: 20000 }).catch(() => {});
    }

    // LA COMPROBACIÓN, que es lo que faltaba: no alcanza con haber tocado.
    await page.locator('input[type=email]').waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
    if (await hayLogin()) return true;

    // Recargar es lo único que arregla una hidratación que no llegó.
    if (intento < 3) await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
  }

  const texto = await page
    .locator('body')
    .innerText()
    .then((t) => t.replace(/\s+/g, ' ').trim().slice(0, 220))
    .catch(() => '(no se pudo leer)');
  throw new Error(
    `no pude llegar al login despues de 3 intentos.\n` +
      `  url: ${page.url()}\n` +
      `  se ve: ${texto || '(la pagina esta EN BLANCO)'}\n` +
      `  errores: ${errores.length ? '\n    - ' + [...new Set(errores)].slice(0, 5).join('\n    - ') : '(ninguno)'}`
  );
}

/**
 * Mata lo que esté escuchando en un puerto. Por PUERTO, no por PID.
 *
 * POR QUÉ. Las sondas levantan su servidor con `spawn('npx', [...], { shell:
 * true })` y lo matan con `taskkill /pid <pid> /t`. En Windows ese `pid` es el
 * del `cmd.exe` que corre npx, no el del servidor: el servidor es un NIETO, y
 * cuando el shell ya termino, `/t` no encuentra a quien matar.
 *
 * Resultado: cada corrida dejaba un servidor vivo. Se acumularon en 3061, 3071
 * y 3081 a lo largo del dia, y uno de ellos secuestro una corrida entera —la
 * sonda le hablo a el en vez de al suyo y recibio un build viejo, con chunks
 * que ya no existian y la pagina en blanco.
 *
 * Matar por puerto no depende del arbol de procesos: se pregunta quien tiene el
 * puerto y se lo mata. Es lo unico que no se puede equivocar de victima.
 */
export function cerrarPuerto(puerto) {
  if (process.platform !== 'win32') {
    try {
      execSync(`fuser -k ${puerto}/tcp`, { stdio: 'ignore' });
    } catch {}
    return;
  }
  try {
    const salida = execSync(`netstat -ano -p tcp`, { encoding: 'utf8' });
    const pids = new Set();
    for (const linea of salida.split('\n')) {
      if (!linea.includes('LISTENING')) continue;
      const m = /:(\d+)\s+\S+\s+LISTENING\s+(\d+)/.exec(linea);
      if (m && Number(m[1]) === Number(puerto)) pids.add(m[2]);
    }
    for (const pid of pids) {
      try {
        execSync(`taskkill /pid ${pid} /f /t`, { stdio: 'ignore' });
      } catch {}
    }
  } catch {}
}

/**
 * Los puertos que usan las sondas. NO incluye 3020 ni 8090: esos son los
 * servidores de desarrollo que levanta el humano y que `test:real` necesita
 * prendidos. Matarlos seria arreglar una fuga rompiendo otra cosa.
 *
 * Cada sonda arranca en su base y sube si esta ocupado, asi que se limpia un
 * RANGO y no una lista: una corrida que encontro 3061 ocupado quedo en 3062, y
 * ese tambien hay que barrerlo.
 */
export const PUERTOS_DE_SONDAS = { desde: 3021, hasta: 3099 };

/**
 * DEJA LOS PUERTOS DE LAS SONDAS LIMPIOS. Se llama AL ARRANCAR, siempre, antes
 * de elegir puerto y levantar nada.
 *
 * POR QUE AL ARRANCAR Y NO SOLO AL TERMINAR. Limpiar al final no alcanza: si la
 * corrida se cae a la mitad —y se cayeron varias— nunca llega a esa linea, y el
 * servidor queda vivo. Al arrancar se ejecuta SIEMPRE, pase lo que pase en la
 * corrida anterior.
 *
 * LO QUE COSTO NO HACERLO: dos corridas perdidas y, peor, una sonda hablandole
 * al servidor equivocado. Ese huerfano servia un build viejo con chunks que ya
 * no existian, asi que la pagina salia en blanco y el error apuntaba a
 * cualquier lado. Fue la señal falsa mas cara del proyecto: no rompe, miente.
 *
 * El costo de volver a levantar un servidor son segundos. El de un huerfano ya
 * lo pagamos.
 */
export function limpiarPuertosDeSondas() {
  // UNA sola pasada de netstat, no una por puerto. Recorrer 79 puertos con una
  // llamada cada uno tardaba medio minuto, y esto corre al arranque de CADA
  // sonda: una limpieza que molesta es una limpieza que alguien saca.
  if (process.platform !== 'win32') {
    for (let p = PUERTOS_DE_SONDAS.desde; p <= PUERTOS_DE_SONDAS.hasta; p++) cerrarPuerto(p);
    return;
  }
  const pids = new Set();
  try {
    const salida = execSync('netstat -ano -p tcp', { encoding: 'utf8' });
    for (const linea of salida.split('\n')) {
      if (!linea.includes('LISTENING')) continue;
      const m = /:(\d+)\s+\S+\s+LISTENING\s+(\d+)/.exec(linea);
      if (!m) continue;
      const puerto = Number(m[1]);
      if (puerto < PUERTOS_DE_SONDAS.desde || puerto > PUERTOS_DE_SONDAS.hasta) continue;
      pids.add(m[2]);
    }
  } catch {}
  for (const pid of pids) {
    try {
      execSync(`taskkill /pid ${pid} /f /t`, { stdio: 'ignore' });
    } catch {}
  }
  if (pids.size) console.log(`  (limpié ${pids.size} servidor(es) huérfano(s) de corridas anteriores)`);
}

/**
 * NINGUNA SONDA CORRE SIN LIMITE. Se llama al arrancar, con los minutos que
 * razonablemente le tomaria la corrida mas lenta, y con lo que hay que cerrar
 * si se corta (su servidor, su puerto).
 *
 * LO QUE COSTO NO TENERLO (18/9): `perfilar-bloqueo` junto sus datos en dos
 * minutos y despues se quedo DOS HORAS sin terminar ni decir nada. El servidor
 * hijo mantenia vivo el proceso, y el cierre estaba colgado de `exit`, que
 * nunca llegaba. Es la misma familia que las promesas sin limite: algo que
 * espera para siempre no falla, desaparece.
 *
 * El temporizador va con `unref`: no mantiene vivo el proceso cuando la corrida
 * termino bien, pero si dispara cuando lo que lo mantiene vivo es otra cosa.
 *
 * LO QUE NO CUBRE: un `spawnSync` bloquea el hilo y ningun temporizador corre
 * mientras tanto. Por eso cada `next build` lleva su propio `timeout`
 * (LIMITE_DE_COMPILACION_MS). El test 123 exige las dos cosas.
 */
export function limiteDeSonda(minutos, alCortar) {
  const t = setTimeout(() => {
    console.log(`\nLIMITE: la sonda paso ${minutos} min sin terminar. La corto.`);
    try {
      alCortar?.();
    } catch {}
    process.exit(124);
  }, minutos * 60_000);
  t.unref();
  return t;
}

/** El `timeout` de cada `next build` de una sonda: compila en 2-4 min. */
export const LIMITE_DE_COMPILACION_MS = 10 * 60_000;
