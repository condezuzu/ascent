import ActivityKit
import SwiftUI
import WidgetKit

/**
 * EL DESCANSO EN LA PANTALLA BLOQUEADA (§13d).
 *
 * LO QUE ESTO ARREGLA, y que se pidió después de dos días de gimnasio: "no se
 * ve el descanso fuera de la app". El aviso sonoro ya llegaba con la pantalla
 * bloqueada, pero para saber CUÁNTO FALTA había que desbloquear el teléfono y
 * abrir la app, doce veces por sesión.
 *
 * LA CUENTA LA DIBUJA iOS, NO NOSOTROS. `Text(timerInterval:)` recibe el rango
 * hasta la hora de fin y corre solo, con la pantalla bloqueada y sin que la app
 * esté viva. Esto importa más de lo que parece: una Live Activity NO se puede
 * actualizar una vez por segundo —el sistema limita las actualizaciones y
 * gastaría batería— así que empujar el número sería, literalmente, imposible
 * de hacer bien. Al pasarle la fecha de fin, el problema desaparece.
 *
 * Y ES LA MISMA REGLA DE §18.4: el timestamp de fin manda y lo transcurrido se
 * calcula contra el reloj. Esto es una VISTA de ese número, nunca la fuente.
 * Si se apoyara en su propio contador, mirar la pantalla bloqueada y mirar la
 * app darían dos números distintos para la misma cosa.
 */

@available(iOS 16.2, *)
struct DescansoLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: AtributosDelDescanso.self) { context in
      // LA PANTALLA BLOQUEADA. Es lo que se ve sin desbloquear nada, y es el
      // caso que hay que ganar: el teléfono boca arriba en el banco.
      HStack(alignment: .center, spacing: 14) {
        VStack(alignment: .leading, spacing: 2) {
          Text("DESCANSO")
            .font(.system(size: 11, weight: .medium))
            .tracking(2)
            .foregroundStyle(Color("sub"))
          Text(deLargo(context.attributes.duracion))
            .font(.system(size: 13))
            .foregroundStyle(Color("sub"))
        }
        Spacer(minLength: 0)
        cuenta(hasta: context.state.fin, tamano: 44)
      }
      .padding(.horizontal, 20)
      .padding(.vertical, 16)
      .activityBackgroundTint(Color("fondo"))
      .activitySystemActionForegroundColor(Color("tinta"))

    } dynamicIsland: { context in
      DynamicIsland {
        // ABIERTA: cuando se mantiene apretada la isla.
        DynamicIslandExpandedRegion(.leading) {
          Text("DESCANSO")
            .font(.system(size: 11, weight: .medium))
            .tracking(2)
            .foregroundStyle(Color("sub"))
            .padding(.leading, 4)
        }
        DynamicIslandExpandedRegion(.trailing) {
          Text(deLargo(context.attributes.duracion))
            .font(.system(size: 13))
            .foregroundStyle(Color("sub"))
            .padding(.trailing, 4)
        }
        DynamicIslandExpandedRegion(.bottom) {
          cuenta(hasta: context.state.fin, tamano: 40)
        }
      } compactLeading: {
        // CERRADA, a la izquierda: un punto y nada más. El espacio es de
        // milímetros y el número es lo único que hace falta.
        Circle()
          .fill(Color("tinta"))
          .frame(width: 7, height: 7)
      } compactTrailing: {
        cuenta(hasta: context.state.fin, tamano: 14)
          // ANCHO FIJO: sin esto la isla se agranda y se achica sola cuando el
          // número pasa de 1:00 a 0:59, y el movimiento se ve como un error.
          .frame(width: 42)
      } minimal: {
        cuenta(hasta: context.state.fin, tamano: 12)
      }
      .keylineTint(Color("tinta"))
    }
  }
}

/// La cuenta atrás, que la dibuja el sistema. Monoespaciada para que los
/// dígitos no bailen: con la fuente normal, el 1 es más angosto que el 8 y el
/// número entero se mueve a cada segundo.
@available(iOS 16.2, *)
private func cuenta(hasta fin: Date, tamano: CGFloat) -> some View {
  Text(timerInterval: Date.now...fin, countsDown: true)
    .font(.system(size: tamano, weight: .light, design: .rounded))
    .monospacedDigit()
    .foregroundStyle(Color("tinta"))
    .multilineTextAlignment(.trailing)
}

/// "3 min" / "1:30 min". Lo mismo que `duracionCorta` en TypeScript, que es de
/// donde salió: el rótulo de abajo dice de cuánto era el descanso, para que el
/// número grande no sea el único dato.
private func deLargo(_ segundos: Int) -> String {
  let m = segundos / 60
  let s = segundos % 60
  if s == 0 { return "\(m) min" }
  return String(format: "%d:%02d min", m, s)
}

@main
struct DescansoBundle: WidgetBundle {
  var body: some Widget {
    DescansoLiveActivity()
  }
}
