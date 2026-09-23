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
 *
 * ─────────────────────────────────────────────────────────────────────
 * EL TIMER QUE "SE QUEDABA CARGANDO" (25/9)
 *
 * Reporte del gimnasio: *"en la pantalla de bloqueo el timer se queda
 * cargando"*. No se quedaba cargando: se CAÍA, y lo que se ve cuando un widget
 * se cae es el rectángulo vacío del sistema.
 *
 * El motivo cabe en una línea: `Date.now...fin` es un `ClosedRange`, y un rango
 * cerrado exige que el principio no sea mayor que el final. Mientras el
 * descanso corre, `fin` está en el futuro y todo bien. Al llegar a cero —que es
 * exactamente el momento en que uno mira el teléfono— `fin` pasa a estar en el
 * pasado, el rango se vuelve inválido y Swift corta ahí mismo.
 *
 * O sea que fallaba SIEMPRE, y siempre en el peor momento.
 *
 * ─────────────────────────────────────────────────────────────────────
 * Y EL FINAL SE AVISA ACÁ (25/9)
 *
 * *"Una sola cosa en la pantalla de bloqueo, no dos. El fin del descanso tiene
 * que avisarse en el mismo cuadro del timer."*
 *
 * Esta es la mitad que se puede hacer sin servidor: cuando el descanso termina,
 * la tarjeta deja de mostrar una cuenta en cero y pasa a decir que terminó, con
 * el color invertido. `staleDate` es lo que lo hace posible sin que la app esté
 * viva: al llegar esa fecha el sistema vuelve a dibujar la tarjeta y
 * `context.isStale` ya es verdadero.
 *
 * La otra mitad —que además SUENE sin una notificación aparte— necesita
 * empujar la actividad desde un servidor (APNs), porque con la app dormida no
 * hay nadie que pueda pedir la alerta. Queda preguntado.
 */

@available(iOS 16.2, *)
struct DescansoLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: AtributosDelDescanso.self) { context in
      // LA PANTALLA BLOQUEADA. Es lo que se ve sin desbloquear nada, y es el
      // caso que hay que ganar: el teléfono boca arriba en el banco.
      HStack(alignment: .center, spacing: 14) {
        VStack(alignment: .leading, spacing: 3) {
          Text(termino(context) ? "LISTO" : "DESCANSO")
            .font(.system(size: 11, weight: .medium))
            .tracking(2)
            .foregroundStyle(termino(context) ? Color("tinta") : Color("sub"))
          // QUÉ ESTABAS HACIENDO, que es lo único que se mira entre serie y
          // serie. Si no se sabe, queda la duración de siempre: la tarjeta
          // nunca se queda sin su segunda línea.
          Text(queHacias(context) ?? deLargo(context.attributes.duracion))
            .font(.system(size: 14))
            .foregroundStyle(Color("tinta"))
            .lineLimit(1)
          if let s = porCual(context) {
            Text(s)
              .font(.system(size: 12))
              .foregroundStyle(Color("sub"))
          }
        }
        Spacer(minLength: 0)
        cuenta(hasta: context.state.fin, tamano: 44, termino: termino(context))
      }
      .padding(.horizontal, 20)
      .padding(.vertical, 16)
      .activityBackgroundTint(Color("fondo"))
      .activitySystemActionForegroundColor(Color("tinta"))

    } dynamicIsland: { context in
      DynamicIsland {
        // ABIERTA: cuando se mantiene apretada la isla.
        DynamicIslandExpandedRegion(.leading) {
          Text(termino(context) ? "LISTO" : "DESCANSO")
            .font(.system(size: 11, weight: .medium))
            .tracking(2)
            .foregroundStyle(Color("sub"))
            .padding(.leading, 4)
        }
        DynamicIslandExpandedRegion(.trailing) {
          Text(porCual(context) ?? deLargo(context.attributes.duracion))
            .font(.system(size: 13))
            .foregroundStyle(Color("sub"))
            .padding(.trailing, 4)
        }
        DynamicIslandExpandedRegion(.center) {
          if let q = queHacias(context) {
            Text(q)
              .font(.system(size: 14))
              .foregroundStyle(Color("tinta"))
              .lineLimit(1)
          }
        }
        DynamicIslandExpandedRegion(.bottom) {
          cuenta(hasta: context.state.fin, tamano: 40, termino: termino(context))
        }
      } compactLeading: {
        // CERRADA, a la izquierda: un punto y nada más. El espacio es de
        // milímetros y el número es lo único que hace falta.
        Circle()
          .fill(Color("tinta"))
          .frame(width: 7, height: 7)
      } compactTrailing: {
        cuenta(hasta: context.state.fin, tamano: 14, termino: termino(context))
          // ANCHO FIJO: sin esto la isla se agranda y se achica sola cuando el
          // número pasa de 1:00 a 0:59, y el movimiento se ve como un error.
          .frame(width: 42)
      } minimal: {
        cuenta(hasta: context.state.fin, tamano: 12, termino: termino(context))
      }
      .keylineTint(Color("tinta"))
    }
  }
}

/// EL EJERCICIO, si se sabe. Cadena vacía = no se eligió ninguno, y entonces no
/// hay nada que decir: la tarjeta vuelve a su segunda línea de siempre.
@available(iOS 16.2, *)
private func queHacias(_ context: ActivityViewContext<AtributosDelDescanso>) -> String? {
  let e = context.state.ejercicio.trimmingCharacters(in: .whitespaces)
  return e.isEmpty ? nil : e
}

/// "Serie 3 de 4", o "Serie 3" si no se sabe la meta. Cero = no se sabe nada.
@available(iOS 16.2, *)
private func porCual(_ context: ActivityViewContext<AtributosDelDescanso>) -> String? {
  let s = context.state.serie
  guard s > 0 else { return nil }
  let m = context.state.meta
  return m > 0 ? "Serie \(s) de \(m)" : "Serie \(s)"
}

/// ¿YA TERMINÓ?
///
/// Dos preguntas y no una. `isStale` es lo que el sistema sabe sin que la app
/// esté viva —le dijimos que a partir de `fin` lo que muestra está vencido— y
/// la comparación contra el reloj cubre el caso en que la tarjeta se dibuja
/// justo después, antes de que el sistema la marque.
@available(iOS 16.2, *)
private func termino<T>(_ context: ActivityViewContext<T>) -> Bool where T == AtributosDelDescanso {
  context.isStale || context.state.fin <= Date()
}

/// La cuenta atrás, que la dibuja el sistema. Monoespaciada para que los
/// dígitos no bailen: con la fuente normal, el 1 es más angosto que el 8 y el
/// número entero se mueve a cada segundo.
///
/// CON EL DESCANSO TERMINADO NO HAY CUENTA, y no es una decisión de diseño: el
/// rango `Date.now...fin` con `fin` en el pasado es inválido y tumba el widget
/// entero. Ver la cabecera.
@available(iOS 16.2, *)
private func cuenta(hasta fin: Date, tamano: CGFloat, termino: Bool) -> some View {
  Group {
    if termino {
      Text("0:00")
        .font(.system(size: tamano, weight: .light, design: .rounded))
        .monospacedDigit()
        .foregroundStyle(Color("claro"))
    } else {
      Text(timerInterval: Date.now...fin, countsDown: true)
        .font(.system(size: tamano, weight: .light, design: .rounded))
        .monospacedDigit()
        .foregroundStyle(Color("tinta"))
    }
  }
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
