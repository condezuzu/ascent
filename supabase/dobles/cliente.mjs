// `@cliente` para las pruebas que corren en el proceso de `test-schema.mjs`.
// Los módulos de `compartido/` reciben el cliente por parámetro; este doble
// existe solo para que se puedan IMPORTAR los que además traen `crearCliente`
// para algún hook (`compartido/esquema`). Si alguien lo llama, es un error de
// la prueba: tiene que pasar su propia base de mentira.
export function crearCliente() {
  throw new Error('crearCliente() no existe en las pruebas: pasá el cliente por parámetro');
}
