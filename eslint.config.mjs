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
 * LOS HOOKS PROPIOS SE LLAMAN `use...` Y NO `usar...`, y por eso esta regla
 * los ve. Estaban en español como todo el resto —`usarSesion`,
 * `usarSugerenciasDeMarca`, `usarVersionDelEsquema`— y la regla exige el
 * prefijo `use`: tiene el patrón `/^use[A-Z]/` adentro y no es configurable.
 * Eran 29 falsos positivos, y la alternativa era apagar la regla justo en
 * `useSesion`, que es el hook más grande del repo. Se renombraron los tres.
 * La convención en español se queda para todo lo demás: es solo el prefijo
 * que React necesita para reconocerlos.
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
];
