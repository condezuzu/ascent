# Por qué falló la build 5 en Apple (RESUELTO, 27/9)

**CAUSA CONFIRMADA (error textual de Apple): ITMS-90683 — faltaba
`NSHealthUpdateUsageDescription` en el Info.plist.** El ícono NO tenía nada que
ver (se descartó con pruebas, ver abajo).

```
90683: Missing purpose string in Info.plist. ... should contain a
NSHealthUpdateUsageDescription key with a user-facing purpose string ...
```

## Por qué pasó y cómo se arregló

- La app **solo LEE** de Salud (`salud.ts` pide `toRead`, nunca `toShare`). Pero
  la librería `@kingstinct/react-native-healthkit` **enlaza las APIs de
  escritura** de HealthKit igual, así que el binario las referencia y Apple
  exige el texto de escritura aunque la app no escriba.
- En `app.json` estaba `NSHealthUpdateUsageDescription: false` —a propósito,
  creyendo que "no escribe = no hace falta"—. Eso fue lo que rompió: `false`
  omite el texto, pero la API sigue enlazada. Sacar la escritura de verdad
  significaría forkear/cambiar la librería (no conservador).
- **Arreglo:** se puso un texto honesto (dice que la app solo lee). Sacarlo NO es
  opción: `false` es justo lo que Apple rechazó.
- **Micrófono, de paso:** `expo-audio` agregaba un texto de micrófono genérico y
  en inglés (la app solo REPRODUCE, no graba). Se cambió a un texto honesto en
  español y se sacó `RECORD_AUDIO` de Android. No se puede sacar el de iOS por lo
  mismo que Salud (la librería enlaza la grabación). Los textos están en `app.json`
  y esperan aprobación del humano antes de buildear.

## LA LECCIÓN

El motivo estaba en App Store Connect desde el miércoles, a un clic, y estuvimos
DEDUCIENDO (bajando .ipa, comparando íconos) en vez de leerlo. **La próxima vez
que una build falle, lo PRIMERO es leer el error textual de Apple** (el mail
"We identified one or more issues…" o App Store Connect → la build → el error).
Recién después, investigar.

---

## Lo que se miró para descartar el ícono (queda como registro)

## Qué se miró

Se bajaron los dos `.ipa` de EAS y se compararon:
- **build 2** (`fea8f17a`, 22/9) — Apple la procesó BIEN.
- **build 5** (`970af465`, 24/9) — Apple la rechazó al procesar (ícono gris de
  placeholder en la lista).

## Qué se encontró

**El ícono está bien y NO es la diferencia.** Las dos builds traen el ícono
embebido igual:
- `AppIcon60x60@2x.png` (120×120, iPhone) y `AppIcon76x76@2x~ipad.png` presentes
  en las dos.
- `Info.plist` con `CFBundleIconName`, `CFBundleIcons` y `CFBundleIconFiles` —
  idénticos en las dos.
- El fuente `movil/assets/icono.png`: 1024×1024, RGB **sin canal alfa**, sin
  perfil de color (iCCP/sRGB/gAMA), sin esquinas redondeadas. Impecable.

**La ÚNICA diferencia estructural es la extensión del widget.** build 5 trae
`PlugIns/descanso.appex` (la Live Activity); build 2 no tiene `PlugIns`. Y la
extensión está BIEN armada:
- bundle id `uy.ascent.app.widget` (prefijado por el de la app ✓)
- `NSExtensionPointIdentifier = com.apple.widgetkit-extension` ✓
- versión corta `1.0.0` (igual que la app) ✓
- firmada (`_CodeSignature`) y con `embedded.mobileprovision` ✓
- el widget NO declara ícono propio, que es lo correcto para una Live Activity.

## Conclusión

El cuadriculado gris en App Store Connect significa **"el procesamiento falló"**,
no necesariamente "no pude extraer el ícono" — eso último fue una inferencia. Y
el ícono, mirado en el binario, está perfecto. Todo lo nuestro (ícono, config,
la extensión) está correcto. Así que **la razón real solo está en el mensaje de
error de Apple**, que no guardamos.

## Qué hacer ANTES de la próxima build de tienda

1. **Leer el error exacto** en App Store Connect → la build → "General App
   Information"/actividad, o el mail de Apple del 24/9 ("We identified one or more
   issues with a recent delivery…"). Eso NOMBRA la causa. Sin eso, lo demás es
   adivinar.
2. **Subir el `buildNumber`**: la build 5 era `"5"`. Apple rechaza un número
   repetido. La próxima de tienda tiene que ser `6` o más (está en
   `movil/app.json` → `ios.buildNumber`).
3. **Confirmar en el teléfono**: la build de `telefono` que se está instalando
   ahora tiene la MISMA extensión y el MISMO ícono. Si el ícono aparece bien en
   la pantalla de inicio del iPhone, queda 100% confirmado que el ícono no es el
   problema.
4. Candidatos que quedan si el error de Apple apunta a la extensión: que el
   `CFBundleVersion` del widget iguale exactamente al de la app en la build de
   tienda (EAS suele alinearlos; verificar en el `.ipa` de tienda antes de subir).

## Nota

No se pudo cerrar la causa raíz al 100% porque vive en el sistema de Apple, no
en nuestro código ni en el binario. Lo accionable de nuestro lado está hecho:
el ícono quedó descartado con pruebas.
