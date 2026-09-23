/** @type {import('@bacons/apple-targets/app.plugin').Config} */
module.exports = {
  // "widget" es el tipo de target de Apple que sirve para las dos cosas: los
  // widgets de la pantalla de inicio y las Live Activities. Acá se usa SOLO
  // para la segunda — no hay widget de inicio y no está previsto.
  type: 'widget',
  name: 'descanso',
  displayName: 'Descanso',

  // iOS 16.2 ES EL PISO REAL DE ESTO. Las Live Activities aparecieron en la
  // 16.1 pero `ActivityContent` —que es lo que deja poner una fecha de
  // vencimiento y actualizar sin pelear— llegó en la 16.2. Bajar de acá
  // obligaría a escribir dos caminos para ganar una versión que ya casi nadie
  // usa. El valor de fábrica del plugin es 18.0, que dejaría afuera teléfonos
  // que andan perfecto.
  deploymentTarget: '16.2',

  // Se declaran a mano: un target de widget linkea WidgetKit y SwiftUI solo,
  // pero ActivityKit no viene puesto y sin él no compila la parte que importa.
  frameworks: ['ActivityKit', 'WidgetKit', 'SwiftUI'],

  // LOS COLORES SALEN DE `nucleo/` Y NO DE LA CABEZA DE NADIE. Son los mismos
  // tres de la app (`movil/src/colores.ts`), copiados acá porque un target de
  // Apple no puede importar TypeScript. `test:db` compara los dos lados: si
  // alguien cambia la paleta, esto lo canta en vez de quedar de otro color
  // para siempre en la única pantalla que nadie mira dos veces.
  colors: {
    fondo: '#05060a',
    tinta: '#e8ecf6',
    sub: '#8a93a8',
  },
};
