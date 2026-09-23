import ActivityKit
import Foundation

// ESTE ARCHIVO ESTÁ DOS VECES, A PROPÓSITO, Y TIENE QUE SEGUIR IGUAL.
//
// La otra copia está en `modules/descanso-vivo/ios/AtributosDelDescanso.swift`.
// No es pereza: son dos targets de Apple que NO se pueden ver entre sí. El
// widget es una extensión con su propio binario; el que enciende la actividad
// vive en un pod de Expo, dentro de la app. Ningún archivo puede pertenecer a
// los dos, así que ActivityKit los une por otro lado: los empareja por el
// NOMBRE del tipo y por la forma de lo que se codifica.
//
// O sea que lo que tiene que coincidir no es el archivo, son estas tres cosas:
// el nombre `AtributosDelDescanso`, el nombre y tipo de cada campo de
// `ContentState`, y los de `AtributosDelDescanso` mismo. Si se separan, la
// actividad se enciende y el widget no la dibuja nunca — y no hay error: no
// pasa nada, que es la forma más difícil de darse cuenta.
//
// Por eso `test:db` compara los dos archivos y falla si dejan de ser iguales.

@available(iOS 16.2, *)
struct AtributosDelDescanso: ActivityAttributes {
  /// Lo que cambia mientras la actividad vive.
  public struct ContentState: Codable, Hashable {
    /// CUÁNDO TERMINA, no cuánto falta (§18.4). Es la misma regla que en el
    /// teléfono: con los segundos restantes habría que estar empujando una
    /// actualización por segundo —que iOS ni siquiera permite— y el número
    /// quedaría mal apenas la pantalla se apaga. Con la fecha de fin, el
    /// sistema dibuja la cuenta atrás solo y siempre coincide con la app.
    var fin: Date
  }

  /// Cuánto duraba el descanso al empezar, en segundos. Va en los atributos y
  /// no en el estado porque no cambia... salvo que cambies la duración a mitad
  /// de descanso, y ahí la actividad se reemplaza entera.
  var duracion: Int
}
