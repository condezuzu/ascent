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

/*
 * ─────────────────────────────────────────────────────────────────────
 * LA BUILD 8 (15/10): TAMBIÉN MIENTRAS SE HACE LA SERIE
 *
 * La tarjeta aparece apenas se elige el ejercicio —"Serie 0 de 3", con el reloj de
 * la sesión— y entre serie y serie es la cuenta del descanso de siempre. Abajo, los
 * pasos de hoy y el compañero, con su descanso si está descansando. Los textos los
 * manda la app ya traducidos (`nucleo/textos.ts`): la tarjeta habla el idioma de la
 * app. Una actividad encendida por la versión de antes llega sin textos: para eso
 * están los valores de respaldo.
 */

@available(iOS 16.2, *)
struct DescansoLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: AtributosDelDescanso.self) { context in
      VStack(alignment: .leading, spacing: 12) {
        if esCardio(context) {
          cardio(context)
        } else {
          HStack(alignment: .firstTextBaseline, spacing: 14) {
            VStack(alignment: .leading, spacing: 4) {
              Text(rotuloDe(context))
                .font(.system(size: 11, weight: .medium))
                .tracking(2.4)
                .foregroundStyle(termino(context) ? Color("claro") : Color("sub"))
              Text(queHacias(context) ?? (esDescanso(context) ? deLargo(context.attributes.duracion) : ""))
                .font(.system(size: 17, weight: .regular))
                .foregroundStyle(Color("tinta"))
                .lineLimit(1)
              if let s = detalleDe(context) {
                Text(s)
                  .font(.system(size: 13))
                  .foregroundStyle(Color("sub"))
              }
            }
            Spacer(minLength: 0)
            if esDescanso(context) {
              cuenta(hasta: context.state.fin, tamano: 46, termino: termino(context))
            } else {
              reloj(desde: context.state.desde, tamano: 34)
            }
          }

          if esDescanso(context) {
            barra(context)
          }
        }

        // En el cardio los pasos ya están arriba, en su lugar.
        abajo(context, conPasos: !esCardio(context))
      }
      .padding(.horizontal, 20)
      .padding(.vertical, 16)
      .activityBackgroundTint(Color("fondo"))
      .activitySystemActionForegroundColor(Color("tinta"))

    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          Text(rotuloDe(context))
            .font(.system(size: 11, weight: .medium))
            .tracking(2)
            .foregroundStyle(Color("sub"))
            .padding(.leading, 4)
        }
        DynamicIslandExpandedRegion(.trailing) {
          Text(detalleDe(context) ?? (esDescanso(context) ? deLargo(context.attributes.duracion) : ""))
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
          if esDescanso(context) {
            cuenta(hasta: context.state.fin, tamano: 40, termino: termino(context))
          } else {
            reloj(desde: context.state.desde, tamano: 30)
          }
        }
      } compactLeading: {
        Circle()
          .fill(Color("tinta"))
          .frame(width: 7, height: 7)
      } compactTrailing: {
        Group {
          if esDescanso(context) {
            cuenta(hasta: context.state.fin, tamano: 14, termino: termino(context))
          } else {
            reloj(desde: context.state.desde, tamano: 14)
          }
        }
        .frame(width: 42)
      } minimal: {
        if esDescanso(context) {
          cuenta(hasta: context.state.fin, tamano: 12, termino: termino(context))
        } else {
          reloj(desde: context.state.desde, tamano: 12)
        }
      }
      .keylineTint(Color("tinta"))
    }
  }
}

@available(iOS 16.2, *)
private func barra(_ context: ActivityViewContext<AtributosDelDescanso>) -> some View {
  Group {
    if termino(context) {
      Capsule()
        .fill(Color("claro"))
        .frame(height: 3)
    } else {
      ProgressView(
        timerInterval: Date.now...max(Date.now, context.state.fin),
        countsDown: true,
        label: { EmptyView() },
        currentValueLabel: { EmptyView() }
      )
      .progressViewStyle(.linear)
      .tint(Color("claro"))
      .frame(height: 3)
    }
  }
}

/// LOS PASOS Y EL COMPAÑERO (build 8), en un renglón. Si no hay ninguno de los dos,
/// no ocupa lugar.
@available(iOS 16.2, *)
@ViewBuilder
private func abajo(_ context: ActivityViewContext<AtributosDelDescanso>, conPasos: Bool = true) -> some View {
  let pasos = conPasos ? context.state.textoPasos.trimmingCharacters(in: .whitespaces) : ""
  let companero = context.state.companero.trimmingCharacters(in: .whitespaces)
  if !pasos.isEmpty || !companero.isEmpty {
    HStack(spacing: 8) {
      if !pasos.isEmpty {
        Text(pasos)
          .font(.system(size: 12))
          .foregroundStyle(Color("sub"))
      }
      Spacer(minLength: 0)
      if !companero.isEmpty {
        Text(companero)
          .font(.system(size: 12))
          .foregroundStyle(Color("tinta"))
          .lineLimit(1)
        // Su descanso, contado por iOS como el nuestro. Un rango con el fin en el
        // pasado tumba el widget (ver arriba): solo si todavía falta.
        if context.state.finCompanero > Date() {
          Text(timerInterval: Date.now...context.state.finCompanero, countsDown: true)
            .font(.system(size: 12, design: .rounded))
            .monospacedDigit()
            .foregroundStyle(Color("sub"))
            .frame(width: 40, alignment: .trailing)
        }
      }
    }
  }
}

@available(iOS 16.2, *)
private func esDescanso(_ context: ActivityViewContext<AtributosDelDescanso>) -> Bool {
  context.state.modo != "serie" && context.state.modo != "cardio"
}

@available(iOS 16.2, *)
private func esCardio(_ context: ActivityViewContext<AtributosDelDescanso>) -> Bool {
  context.state.modo == "cardio"
}

/// EL CARDIO EN LA PANTALLA BLOQUEADA (29/10): tiempo, distancia y pasos, cada uno en su
/// lugar. El reloj cuenta desde que arrancó la cinta (`desde`) y lo dibuja iOS; la
/// distancia (`detalle`) y los pasos (`textoPasos`) llegan armados y traducidos.
@available(iOS 16.2, *)
@ViewBuilder
private func cardio(_ context: ActivityViewContext<AtributosDelDescanso>) -> some View {
  let distancia = context.state.detalle.trimmingCharacters(in: .whitespaces)
  let pasos = context.state.textoPasos.trimmingCharacters(in: .whitespaces)
  VStack(alignment: .leading, spacing: 8) {
    HStack(alignment: .firstTextBaseline, spacing: 10) {
      Text(rotuloDe(context))
        .font(.system(size: 11, weight: .medium))
        .tracking(2.4)
        .foregroundStyle(Color("sub"))
      if let q = queHacias(context) {
        Text(q)
          .font(.system(size: 15))
          .foregroundStyle(Color("tinta"))
          .lineLimit(1)
      }
      Spacer(minLength: 0)
    }
    HStack(alignment: .lastTextBaseline, spacing: 16) {
      // El reloj de iOS ocupa todo el ancho que le den: se lo alinea a la izquierda y
      // la distancia y los pasos quedan con su ancho justo.
      Text(context.state.desde, style: .timer)
        .font(.system(size: 34, weight: .light, design: .rounded))
        .monospacedDigit()
        .foregroundStyle(Color("tinta"))
        .multilineTextAlignment(.leading)
        .frame(maxWidth: .infinity, alignment: .leading)
      if !distancia.isEmpty {
        cifraDelCardio(distancia)
      }
      if !pasos.isEmpty {
        cifraDelCardio(pasos)
      }
    }
  }
}

private func cifraDelCardio(_ texto: String) -> some View {
  Text(texto)
    .font(.system(size: 17, design: .rounded))
    .monospacedDigit()
    .foregroundStyle(Color("tinta"))
    .lineLimit(1)
    .fixedSize()
}

@available(iOS 16.2, *)
private func rotuloDe(_ context: ActivityViewContext<AtributosDelDescanso>) -> String {
  if termino(context) {
    return context.state.rotuloListo.isEmpty ? "LISTO" : context.state.rotuloListo
  }
  return context.state.rotulo.isEmpty ? "DESCANSO" : context.state.rotulo
}

@available(iOS 16.2, *)
private func queHacias(_ context: ActivityViewContext<AtributosDelDescanso>) -> String? {
  let e = context.state.ejercicio.trimmingCharacters(in: .whitespaces)
  return e.isEmpty ? nil : e
}

/// "Serie 2 de 4": el texto que manda la app, o el armado acá para una actividad
/// encendida por la versión de antes.
@available(iOS 16.2, *)
private func detalleDe(_ context: ActivityViewContext<AtributosDelDescanso>) -> String? {
  let d = context.state.detalle.trimmingCharacters(in: .whitespaces)
  if !d.isEmpty { return d }
  let s = context.state.serie
  guard s > 0 else { return nil }
  let m = context.state.meta
  return m > 0 ? "Serie \(s) de \(m)" : "Serie \(s)"
}

@available(iOS 16.2, *)
private func termino<T>(_ context: ActivityViewContext<T>) -> Bool where T == AtributosDelDescanso {
  esDescanso(context) && (context.isStale || context.state.fin <= Date())
}

@available(iOS 16.2, *)
private func cuenta(hasta fin: Date, tamano: CGFloat, termino: Bool) -> some View {
  Group {
    if termino {
      Text("0:00")
        .font(.system(size: tamano, weight: .light, design: .rounded))
        .monospacedDigit()
        .foregroundStyle(Color("claro"))
    } else {
      Text(timerInterval: Date.now...max(Date.now, fin), countsDown: true)
        .font(.system(size: tamano, weight: .light, design: .rounded))
        .monospacedDigit()
        .foregroundStyle(Color("tinta"))
    }
  }
  .multilineTextAlignment(.trailing)
}

/// EL RELOJ DE LA SESIÓN (build 8), contando para arriba desde que empezó. Lo
/// dibuja iOS, igual que la cuenta del descanso.
@available(iOS 16.2, *)
private func reloj(desde: Date, tamano: CGFloat) -> some View {
  Text(desde, style: .timer)
    .font(.system(size: tamano, weight: .light, design: .rounded))
    .monospacedDigit()
    .foregroundStyle(Color("tinta"))
    .multilineTextAlignment(.trailing)
}

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
