import parser from '@typescript-eslint/parser';
import reactHooks from 'eslint-plugin-react-hooks';

/**
 * ESLINT, Y SOLO PARA UNA COSA: las reglas de los hooks.
 *
 * POR QUÉ EXISTE. El mismo bug apareció DOS veces en dos tandas seguidas, una
 * en cada app: al meter un cálculo pesado en `useMemo` quedó un hook DESPUÉS
 * de un `return` temprano. El primer render —sin los datos— llamaba menos
 * hooks que el segundo, y React corta ahí: la pestaña Entrenamiento de Stats
 * se caía entera.
 *
 * No lo agarró nadie porque en este repo no había eslint. La regla que lo
 * detecta —`rules-of-hooks`— existe desde siempre y es la herramienta correcta;
 * el test de la sección 112 es una heurística de texto que escribí cuando esto
 * no estaba, y que además la primera vez solo veía la mitad de los casos.
 *
 * LOS DOS SE QUEDAN. Esto es el que manda; el 112 sigue porque corre dentro de
 * `test:db` —o sea, siempre, aunque nadie se acuerde de correr el lint— y
 * porque un test que explica en su comentario cómo nos mordió el bug vale más
 * que una regla de un paquete.
 *
 * POR QUÉ NO SE PRENDE NADA MÁS. Un lint con cien reglas en un repo que nunca
 * tuvo lint es mil avisos el primer día y nadie los mira. `rules-of-hooks` es
 * la única que atrapa un bug que ya nos pasó, y es de las poquísimas de eslint
 * que no opina sobre estilo: lo que marca está roto de verdad.
 *
 * `exhaustive-deps` queda en aviso y no en error a propósito: es útil, pero
 * tiene falsos positivos y en este repo ya hay `eslint-disable` puestos para
 * ella. Que avise, que no frene la tanda.
 */
export default [
  {
    ignores: [
      '**/node_modules/**',
      '.next/**',
      '.next-*/**',
      'movil/.expo/**',
      'capturas/**',
    ],
  },
  {
    files: ['src/**/*.{ts,tsx}', 'compartido/**/*.{ts,tsx}', 'movil/src/**/*.{ts,tsx}'],
    languageOptions: {
      parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    /**
     * LOS TRES HOOKS PROPIOS, que se llaman en español.
     *
     * `rules-of-hooks` exige que un hook propio empiece con `use` —tiene el
     * patrón `/^use[A-Z]/` metido adentro, no es configurable—. Acá se llaman
     * `usarSesion`, `usarSugerencias` y `usarVersionDelEsquema`, como todo el
     * resto del código, así que la regla no los reconoce como hooks y grita 29
     * veces que "se llama un hook en una función que no es un componente".
     *
     * Son 29 falsos positivos, no 29 bugs.
     *
     * QUÉ SE PIERDE APAGÁNDOLA ACÁ, dicho claro: adentro de estos tres
     * archivos nadie verifica que los hooks se llamen siempre en el mismo
     * orden. No se pierde nada que hoy se tenga —nunca hubo lint— pero tampoco
     * se gana ahí, y `usarSesion` es el hook más grande del repo.
     *
     * QUÉ SE SIGUE CUBRIENDO, que es donde nos mordió: TODOS los componentes.
     * Los dos crashes fueron en `SeccionVolumen` y en `Stats`, y la regla los
     * agarra a los dos —lo verifiqué contra los archivos rotos antes de
     * confiar en esto—.
     *
     * CÓMO SE ARREGLA DE VERDAD: renombrar los tres a `useSesion`,
     * `useSugerencias` y `useVersionDelEsquema`. No es solo para el lint —React
     * usa ese prefijo para sus propios avisos y para el compilador— pero es un
     * renombre que toca las dos apps y rompe la convención de nombres en
     * español. Es decisión del humano, no mía.
     */
    files: ['compartido/usarSesion.ts', 'compartido/marcaSugerida.ts', 'compartido/esquema.ts'],
    rules: { 'react-hooks/rules-of-hooks': 'off' },
  },
];
