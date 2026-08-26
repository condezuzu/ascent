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

/** El código sin comentarios, para no analizar prosa. */
export function sinComentarios(codigo) {
  return codigo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
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
