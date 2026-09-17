// ¿SIRVE ESTE PNG COMO ÍCONO DE iOS?
//
// POR QUÉ EXISTE. Apple RECHAZA el ícono de App Store si tiene canal alfa. No
// avisa al construir ni al instalar: el rechazo llega al subir, después de
// esperar la build, y el mensaje es genérico. Una imagen exportada desde
// cualquier editor viene con alfa por omisión, así que es fácil que pase.
//
// Se mira el archivo, no la imagen: un PNG dice en su cabecera IHDR qué tipo de
// color usa, y eso alcanza para saber si tiene alfa sin decodificar ni un píxel
// ni instalar nada.
//
//   node herramientas/revisar-icono.mjs [archivo]
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const RUTA = process.argv[2] ?? join(RAIZ, 'movil', 'assets', 'icono.png');

if (!existsSync(RUTA)) {
  console.log(`no existe ${RUTA}`);
  process.exit(1);
}

const b = readFileSync(RUTA);

const FIRMA = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const esPng = FIRMA.every((v, i) => b[i] === v);

const problemas = [];
const bien = [];

if (!esPng) {
  console.log('no es un PNG (la firma no coincide)');
  process.exit(1);
}

// IHDR va siempre primero: 8 de firma + 4 de largo + 4 de tipo, y ahí arrancan
// los datos. Ancho y alto son enteros de 32 bits; el tipo de color es un byte.
const ancho = b.readUInt32BE(16);
const alto = b.readUInt32BE(20);
const tipoColor = b[25];

// 0 gris · 2 RGB · 3 paleta · 4 gris+alfa · 6 RGBA
const CON_ALFA = { 4: 'gris con alfa', 6: 'RGBA' };
const NOMBRES = { 0: 'gris', 2: 'RGB', 3: 'paleta', 4: 'gris con alfa', 6: 'RGBA' };

// `tRNS` agrega transparencia a los tipos que no la llevan en el píxel. Se
// busca el nombre del trozo en el archivo: si está, hay transparencia igual.
const tieneTRNS = b.includes(Buffer.from('tRNS'));

const juzgar = (ok, texto) => (ok ? bien : problemas).push(texto);

juzgar(ancho === 1024 && alto === 1024, `mide ${ancho}x${alto} (Apple quiere 1024x1024)`);
juzgar(!CON_ALFA[tipoColor], `tipo de color: ${NOMBRES[tipoColor] ?? tipoColor}`);
juzgar(!tieneTRNS, tieneTRNS ? 'tiene un trozo tRNS: hay transparencia' : 'sin trozo tRNS');

console.log(`\n${RUTA.slice(RAIZ.length + 1)}\n`);
for (const x of bien) console.log('  ok   ' + x);
for (const x of problemas) console.log('  MAL  ' + x);

if (problemas.length) {
  console.log('\nApple rechaza el icono con alfa. Para sacarlo, aplanarlo contra el');
  console.log('fondo negro (#05060a) y exportarlo como PNG sin transparencia.');
}
process.exit(problemas.length ? 1 : 0);
