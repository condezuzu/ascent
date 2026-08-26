import type { Ubicacion } from '../tipos';

// `navigator.geolocation` es lo único que el navegador da. Alcanza para el
// atajo de §13 —abrís la app en el gimnasio y el día se registra— y no para
// el geofencing, que necesita que el SISTEMA despierte a la app y por lo tanto
// solo existe en nativo.
export const ubicacionWeb: Ubicacion = {
  disponible() {
    return typeof navigator !== 'undefined' && 'geolocation' in navigator;
  },

  async puntoActual(edadMaxima = 0) {
    if (!this.disponible()) return null;
    return new Promise((resolver) => {
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          resolver({
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
            precision: pos.coords.accuracy,
            // Cuándo se midió DE VERDAD. Sin esto no hay forma de saber si lo
            // que volvió es de recién o del arreglo de hace cinco minutos.
            medidoEn: pos.timestamp,
          }),
        // Denegado, sin señal o timeout: los tres son "no sé dónde estás", y
        // la app tiene que andar entera sin esto (§13).
        () => resolver(null),
        // `enableHighAccuracy` porque la diferencia entre 50 y 500 metros es
        // justamente lo que decide si esto sirve. 15 s: adentro de un gimnasio
        // el primer arreglo tarda.
        { enableHighAccuracy: true, timeout: 15000, maximumAge: edadMaxima }
      );
    });
  },

  // El navegador no puede: no hay forma de que despierte a una PWA cerrada.
  // Devuelve `false` en vez de tirar para que quien llama decida qué hacer sin
  // tener que preguntar antes.
  async vigilarLlegada() {
    return false;
  },

  async dejarDeVigilar() {},
};
