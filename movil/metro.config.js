// Metro tiene que ver DOS carpetas: la de la app y la raíz del repo, donde
// vive `nucleo/`.
//
// POR QUÉ. El núcleo —las reglas de la racha, los bloques, la llegada al
// gimnasio, las cuentas de fuerza, los textos— se comparte tal cual con la web.
// No se copia: se importa. Metro por omisión solo mira adentro del proyecto, y
// un import que sale de ahí falla con "unable to resolve module".
//
// El alias `@nucleo/...` es el MISMO especificador que usa la web, así que un
// archivo del núcleo se lee igual desde los dos lados y no hay dos versiones
// de la misma verdad.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const raiz = path.resolve(__dirname, '..');
const config = getDefaultConfig(__dirname);

// Que MIRE la raíz: sin esto, cambiar un archivo del núcleo no recarga la app.
config.watchFolders = [raiz];

// Y que sepa dónde buscar los paquetes: primero los de la app, después los de
// la raíz. La web y la nativa tienen dependencias distintas y cada una tiene
// que quedarse con las suyas.
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
  path.resolve(raiz, 'node_modules'),
];

config.resolver.extraNodeModules = {
  '@nucleo': path.resolve(raiz, 'nucleo'),
};

module.exports = config;
