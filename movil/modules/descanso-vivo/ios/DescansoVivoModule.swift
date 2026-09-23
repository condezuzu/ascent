import ActivityKit
import ExpoModulesCore

/**
 * EL PUENTE A ActivityKit: encender, mover y apagar la cuenta del descanso en
 * la pantalla bloqueada (§13d).
 *
 * POR QUÉ HACE FALTA CÓDIGO NATIVO Y NO ALCANZA CON JAVASCRIPT. Una Live
 * Activity solo la puede pedir la app, desde ActivityKit, y solo la puede
 * dibujar una extensión de widget: son dos binarios distintos que no existen
 * del lado de JavaScript. Es, junto con el widget de al lado, lo único de esta
 * función que no se puede mandar por el aire.
 *
 * LO QUE ESTE ARCHIVO NO HACE, y es la mitad del diseño: **no cuenta el
 * tiempo**. Recibe la hora de fin y se la da al sistema, que dibuja la cuenta
 * atrás solo (ver `targets/descanso/index.swift`). Así no hay dos relojes
 * corriendo, que es lo que haría que la pantalla bloqueada y la app dijeran
 * números distintos.
 *
 * TODO FALLA EN SILENCIO Y A PROPÓSITO. Esto es un agregado encima del
 * descanso, igual que la notificación: si el usuario apagó las Live Activities
 * en Ajustes, si el sistema no deja encender una más, o si el teléfono es
 * viejo, el descanso tiene que seguir andando exactamente igual. Ninguna de
 * estas funciones tira.
 */

/// Dónde se guarda la actividad encendida.
///
/// Va en un tipo aparte porque `Activity<…>` solo existe desde iOS 16.2 y una
/// propiedad estática de la clase del módulo obligaría a marcar la clase
/// entera, que Expo necesita poder instanciar en cualquier versión.
@available(iOS 16.2, *)
private enum Encendida {
  static var actual: Activity<AtributosDelDescanso>?
}

public class DescansoVivoModule: Module {
  public func definition() -> ModuleDefinition {
    Name("DescansoVivo")

    // ¿Se puede? Tres cosas tienen que ser ciertas: la versión de iOS, que el
    // sistema las tenga habilitadas, y que el usuario no las haya apagado para
    // Ascent en Ajustes. `areActivitiesEnabled` contesta por las dos últimas.
    Function("disponible") { () -> Bool in
      if #available(iOS 16.2, *) {
        return ActivityAuthorizationInfo().areActivitiesEnabled
      }
      return false
    }

    // `finEnMs` es el mismo `fin` que guarda `compartido/descanso.ts`:
    // milisegundos desde 1970, del reloj del teléfono. Viaja como `Double`
    // porque JavaScript no tiene enteros de 64 bits y un `Int` se pasaría de
    // rango.
    // `ejercicio` llega como cadena y no como opcional: "sin ejercicio" es la
    // cadena vacía. Un opcional de Swift cruzando el puente de Expo tiene más
    // filo del que esto necesita, y el widget lo dibuja igual de bien
    // preguntando si está vacía.
    AsyncFunction("mostrar") { (finEnMs: Double, duracion: Int, ejercicio: String, serie: Int, meta: Int) in
      guard #available(iOS 16.2, *) else { return }
      guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }

      let fin = Date(timeIntervalSince1970: finEnMs / 1000)
      // Un descanso ya terminado no se muestra: llega cuando se baja la
      // duración por debajo de lo ya descansado, y encender una actividad que
      // nace en cero es peor que no encender ninguna.
      guard fin > Date() else {
        await Self.apagar()
        return
      }

      let estado = AtributosDelDescanso.ContentState(
        fin: fin,
        ejercicio: ejercicio,
        serie: serie,
        meta: meta
      )

      // SI YA HAY UNA, SE MUEVE en vez de encender otra. iOS permite varias
      // actividades a la vez y encender una por serie dejaría la pantalla
      // bloqueada llena de descansos viejos. Pasa todo el tiempo: tocar el `+`
      // otra vez, o cambiar la duración a mitad de descanso.
      if let actual = Encendida.actual, actual.attributes.duracion == duracion {
        await actual.update(ActivityContent(state: estado, staleDate: fin))
        return
      }

      // Si cambió la duración hay que reemplazarla: `duracion` está en los
      // atributos, que son lo único de una actividad que NO se puede cambiar
      // una vez encendida.
      await Self.apagar()

      Encendida.actual = try? Activity.request(
        attributes: AtributosDelDescanso(duracion: duracion),
        // `staleDate` en la hora de fin: si el teléfono estuvo sin poder
        // actualizar nada, iOS sabe que a partir de ahí lo que muestra está
        // vencido y lo apaga en vez de dejar un cero colgado para siempre.
        content: ActivityContent(state: estado, staleDate: fin),
        pushType: nil
      )
    }

    AsyncFunction("esconder") {
      guard #available(iOS 16.2, *) else { return }
      await Self.apagar()
    }

    // AL CERRAR LA APP SE APAGA. Una actividad sobrevive a que la app muera
    // —para eso existe— así que sin esto un descanso saltado con la app
    // cerrándose podría quedar en la pantalla bloqueada hasta que iOS se
    // aburra, que son horas.
    OnDestroy {
      if #available(iOS 16.2, *) {
        Task { await Self.apagar() }
      }
    }
  }

  /// Apaga la que esté encendida, sea o no la nuestra.
  ///
  /// RECORRE TODAS LAS DEL SISTEMA y no solo la que tenemos anotada, porque
  /// `Encendida.actual` se pierde cuando el proceso muere: si la app se cierra
  /// con un descanso andando —lo normal, el teléfono va al bolsillo— al volver
  /// ya no hay referencia, pero la actividad sigue ahí. Sin esto, saltar el
  /// descanso después de reabrir la app no apagaba nada.
  @available(iOS 16.2, *)
  private static func apagar() async {
    if let actual = Encendida.actual {
      await actual.end(nil, dismissalPolicy: .immediate)
      Encendida.actual = nil
    }
    for otra in Activity<AtributosDelDescanso>.activities {
      await otra.end(nil, dismissalPolicy: .immediate)
    }
  }
}
