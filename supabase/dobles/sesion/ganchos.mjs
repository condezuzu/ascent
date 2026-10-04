// PARA CORRER `useSesion` DE VERDAD, SIN TELÉFONO. Esto solo resuelve nombres:
// el hook y todo lo que importa se cargan tal cual están en el repo. De mentira
// es únicamente lo que cambia entre la web, el teléfono y la prueba: React, el
// almacenamiento y la base.
//
// Va en su propio proceso (`escenarios.mjs`), no dentro de `test-schema.mjs`: el
// hook guarda cosas a nivel de módulo —la cola, el reloj de los toques— y cada
// escenario tiene que nacer limpio.
import { registerHooks } from 'node:module';

const RAIZ = new URL('../../../', import.meta.url).href;
const ACA = new URL('./', import.meta.url).href;
const DOBLES = { react: 'react.mjs', '@plataforma': 'plataforma.mjs', '@cliente': 'cliente.mjs' };

registerHooks({
  resolve(especificador, contexto, siguiente) {
    if (DOBLES[especificador]) return { url: ACA + DOBLES[especificador], shortCircuit: true };
    const m = especificador.match(/^@(nucleo|compartido)\/(.+)$/);
    if (m) return { url: `${RAIZ}${m[1]}/${m[2]}${m[2].endsWith('.ts') ? '' : '.ts'}`, shortCircuit: true };
    // `compartido/descanso.ts` importa './enCurso', sin extensión.
    if (
      especificador.startsWith('./') &&
      contexto.parentURL?.startsWith(RAIZ + 'compartido/') &&
      !/\.\w+$/.test(especificador)
    ) {
      return { url: new URL(especificador + '.ts', contexto.parentURL).href, shortCircuit: true };
    }
    return siguiente(especificador, contexto);
  },
});
