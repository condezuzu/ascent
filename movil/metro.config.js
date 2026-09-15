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
  // Lo compartido con la web (la sesión, la cola, el descanso). Pide
  // `@plataforma` y `@cliente` sin saber de qué app es: acá son los nativos.
  '@compartido': path.resolve(raiz, 'compartido'),
  '@plataforma': path.resolve(__dirname, 'src', 'plataforma'),
  '@cliente': path.resolve(__dirname, 'src', 'cliente'),
};

// UN SOLO REACT. `compartido/` vive en la raíz del repo, y ahí al lado está el
// `node_modules` de la WEB, con su propio React. Metro busca un paquete
// primero en las carpetas de arriba del archivo que lo pide, así que
// `import { useState } from 'react'` desde `compartido/` cargaba el React de la
// web: dos Reacts, y los hooks revientan con "Invalid hook call".
//
// Los paquetes que piden `compartido/` y `nucleo/` se resuelven como si los
// pidiera la app nativa. Los imports relativos y los alias no se tocan.
const compartidos = [path.resolve(raiz, 'compartido'), path.resolve(raiz, 'nucleo')];
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const desdeAfuera = compartidos.some((d) => context.originModulePath.startsWith(d));
  const esPaquete = !moduleName.startsWith('.') && !moduleName.startsWith('@nucleo') &&
    !moduleName.startsWith('@compartido') && moduleName !== '@plataforma' && moduleName !== '@cliente';
  if (desdeAfuera && esPaquete) {
    return context.resolveRequest(
      { ...context, originModulePath: path.resolve(__dirname, 'index.ts') },
      moduleName,
      platform
    );
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
