# Probar en el teléfono — jueves 1/10

*Lista aparte, a propósito. Todo lo que NO se puede verificar en el navegador ni
contra la base y quedó esperando la build nueva de EAS (la cuota iOS del plan
Free resetea el 1/10 — ver `movil/EAS.md`). Nada de esto se intenta antes; se
junta acá y se prueba el jueves con la app instalada.*

*Se agrega a esta lista cada vez que una tanda toca algo que solo el teléfono
puede confirmar. Al probar cada punto, tacharlo con el resultado.*

---

## Lo central (geofencing) — lo más importante
- [ ] **Caminar hasta el gimnasio con la app CERRADA** y ver que el día entra
      solo (iOS despierta la app en la zona → `movil/src/llegadaDeFondo.ts`).
- [ ] La sesión queda fechada en la **hora de llegada**, no en cuando abriste la
      app.
- [ ] Con la app ABIERTA, el vigilante arranca/cierra la sesión (§13, 7 min).
- [ ] Radio del gimnasio: "Mirar ahora" en Ajustes → Diagnóstico dice a cuántos
      metros te ve; ajustar el radio si el automático no dispara.

## Permisos y hardware (no existen fuera del iPhone)
- [ ] Apple Health: Ajustes → Salud, conectar y ver los pasos de hoy en Stats.
- [ ] Aviso de fin de descanso **con la pantalla bloqueada** (Live Activity).
- [ ] Que la pantalla no se apague mientras corre el descanso (Wake Lock).
- [ ] Botón de volumen suma una serie durante la sesión (no con pantalla
      bloqueada — eso no se prometió).
- [ ] No te desloguea en un uso largo (buscar `SESIÓN PERDIDA`/`REBOTE` en
      Diagnóstico).

## De esta tanda (27/9 en adelante)
- [ ] **Registro optimista**: al marcar el día, el círculo/visual cambia al
      instante y el número de racha + animación de rango aparecen cuando el
      servidor confirma. Verificado en navegador; en el teléfono mirar que la
      espera del número no se sienta rara con red lenta o cortada.
- [ ] **Push de solicitud de amistad**: solo hay PLAN escrito, no código. No se
      prueba el jueves; queda para cuando se implemente el módulo nativo (ver el
      plan en `spec/push-solicitud-plan.md`).

## Al final, cuando los 8 rangos estén bien
- [ ] Rehacer las capturas de la tienda con el fondo nuevo
      (`herramientas/capturas-tienda.mjs`) — ver `spec/ficha-tienda.md`.
- [ ] Re-sembrar la cuenta demo **justo antes** de mandar a revisión
      (`--de-cero`) — ver `spec/ficha-tienda.md`.
