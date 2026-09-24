// EL CIERRE NECESITA LOS DOS DEV SERVERS PRENDIDOS. Esto lo comprueba en la
// primera línea del cierre y aborta claro si falta alguno — en vez de que
// `test:real` lo descubra a mitad de camino, cinco pasos después, con un
// mensaje enterrado. Ver `puertos.mjs`.
import { exigirPrendidos } from './puertos.mjs';

await exigirPrendidos([3020, 8090]);
