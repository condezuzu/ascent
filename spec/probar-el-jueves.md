# Probar en el teléfono — build nueva (e17f30c0, 27/9)

*Todo lo que se hizo desde la build del 23 y NUNCA corrió en un dispositivo. La
build del 23 no recibía OTAs, así que nada de esto llegó hasta ahora. En orden
de importancia. Tachá cada uno con el resultado al probarlo.*

Link de la build: https://expo.dev/accounts/condeag/projects/ascent/builds/e17f30c0-1ec2-4bf9-a646-c21af8532432

## 0 · LO PRIMERO, apenas abra
- [ ] **Tiempo de compilación de shaders.** Ajustes → Diagnóstico, buscá
      `shaders (compilación): N ms`. Es el camino sincrónico nuevo en Metal que
      nadie midió. **Máximo aceptable ~1.500–2.000 ms** (un tirón tolerable en el
      primer cuadro). Si es más, hay que cambiar el enfoque (compilar por modo en
      diferido, o mostrar el fondo CSS y compilar atrás). Pasame el número.

## 1 · El crash de three.js (era app-breaking)
- [ ] **La app NO se cierra** usándola largo. El 23 se cerró a los 36 min por
      `checkMaterialsReady` (compileAsync sin la extensión). Ahora compila
      sincrónico: no debería pasar. Si el fondo falla, que se congele, nunca que
      cierre la app.

## 2 · El gimnasio por ubicación (la función central)
- [ ] **Caminar al gimnasio con la app CERRADA** → el día entra solo.
- [ ] La sesión queda fechada en la **hora de llegada**, no en cuando abriste.
- [ ] Con la app abierta, el **vigilante** arranca/cierra la sesión (7 min).
- [ ] Radio: "Mirar ahora" en Diagnóstico dice a cuántos metros te ve.

## 3 · Pantalla de bloqueo + Live Activity del descanso
- [ ] El aviso de fin de descanso llega **con la pantalla bloqueada**.
- [ ] La **Live Activity** del descanso aparece en la pantalla de bloqueo, el
      timer no se cae, el aviso y la campana andan (era lo de `cc0db15`).
- [ ] La pantalla no se apaga mientras corre el descanso (Wake Lock).

## 4 · Los gestos
- [ ] Deslizar entre pestañas con el dedo, fluido.
- [ ] El Álbum: abrir/cerrar foto a pantalla completa sin que el gesto pelee con
      el de pestañas.

## 5 · Registro optimista
- [ ] Al registrar el día, la marca de "listo" es **instantánea**; el número de
      la racha y la animación de rango llegan cuando confirma el servidor.
      Probar con red lenta o cortada: el número espera, no miente.

## 6 · Actividad en vivo (Ranking)
- [ ] Con "Avisar cuando entreno" prendido y estando en el gimnasio, aparecés en
      "entrenando ahora" para un amigo.
- [ ] El aviso de esa función aparece la primera vez que abrís Ranking con el
      gimnasio ya marcado.

## 7 · Lo demás que solo existe en el teléfono
- [ ] Apple Health: Ajustes → Salud, conectar y ver los pasos de hoy en Stats.
- [ ] Botón de volumen suma una serie durante la sesión (no con pantalla
      bloqueada — eso no se prometió).
- [ ] No te desloguea en un uso largo (buscá `SESIÓN PERDIDA`/`REBOTE` en
      Diagnóstico).
- [ ] Los colores nuevos de los planetas y el día uno se ven bien en la pantalla
      real (no solo en captura).

## Push de solicitud
- [ ] NO está en esta build (solo hay plan, `spec/push-solicitud-plan.md`). No se
      prueba.
