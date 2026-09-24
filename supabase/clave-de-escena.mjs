// LA CLAVE DE LA ESCENA, copiada para poder probarla desde node.
//
// POR QUE UNA COPIA Y NO UN IMPORT. La de verdad vive adentro de
// `compartido/motor/escena.ts`, que importa three.js entero: traerla a node
// significaria cargar la biblioteca —74 kB y tres segundos de evaluacion— para
// llamar a una funcion que junta diez valores con barras.
//
// LO QUE TIENE QUE SEGUIR IGUAL es la LISTA: si alguien agrega un campo a la
// clave alla y no aca, este chequeo dejaria de ver rearmados que si ocurren.
// El chequeo de abajo compara las dos listas y falla si se separan.
export function claveDeEscenaParaProbar(op, animar = true) {
  return [
    op.rango,
    op.planeta ?? '',
    op.apagado ? 1 : 0,
    op.vacio ? 1 : 0,
    op.soloEstrellas ? 1 : 0,
    op.reposo ? 1 : 0,
    op.presagio ? 1 : 0,
    op.fantasma?.rango ?? '',
    op.fantasma?.planeta ?? '',
    animar ? 1 : 0,
  ].join('|');
}
