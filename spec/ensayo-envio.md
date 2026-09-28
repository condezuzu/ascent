# Ensayo del envío a la App Store

Para llegar a la build de tienda sin sorpresas. Escrito para seguir sin saber de
esto: cada paso dice qué apretar y qué esperar. Última revisión 27/9.

Los datos de la cuenta (ASC App ID, bundle, etc.) están en `ficha-tienda.md`.

---

## 1 · Qué está listo de nuestro lado, y qué falta

### ✅ Listo
- **Nombre en la tienda** — ya cargado ("Ascent — Streak & Strength").
- **Textos de la ficha** — subtítulo, palabras clave, texto promocional y
  descripción, todos escritos en `ficha-tienda.md` (se pegan en ASC).
- **Capturas** — cinco, 1290 × 2796, en `Escritorio\ascent-tienda\` con veredicto.
- **URL de privacidad y de soporte** — en línea y con contenido real (verificado).
- **Categoría** (Health & Fitness) y **clasificación por edad** (4+).
- **Cuenta demo + notas de App Review** — escritas en `ficha-tienda.md` (incluyen
  denunciar/bloquear y los permisos). La cuenta se re-siembra el día del envío
  (ver §4).
- **Permisos, ícono, y lo de la build 5** — revisados, todo en orden (ver §2).
- **Migración 53 (denunciar/bloquear)** — ya aplicada en producción
  (`test:conexion` en verde).

### ⚠️ Falta / verificar en ASC (esto NO se ve desde el repo)
- **La build de tienda nueva (build 6).** La build 5 que está en ASC es la que
  Apple rechazó / la del fondo viejo. Hay que subir una **nueva** con todo lo de
  ahora. El perfil `store` tiene `autoIncrement: true`, así que el número de build
  **sube solo** a 6 — no hay que tocar `app.json` a mano.
- **App Privacy (las "etiquetas de privacidad").** ASC pide un cuestionario de qué
  datos recolecta la app. Si no está completo, **frena el envío**. Lo que Ascent
  usa, para completarlo (todo "no usado para seguimiento/tracking", "no vinculado
  a identidad de publicidad"):
  - **Correo electrónico** — para la cuenta (app functionality).
  - **Contenido del usuario** — fotos y nombre de usuario (app functionality).
  - **Salud y ejercicio** — pasos y entrenamientos, SOLO lectura (app functionality).
  - **Ubicación** — el punto del gimnasio (app functionality); no se rastrea el
    recorrido.
  - **Datos de uso / diagnóstico** — el buzón de errores (app functionality).
  - Nada se vende, nada va a publicidad, nada se usa para tracking.
- **Que los textos de la ficha estén PEGADOS en ASC** (no solo escritos en el
  repo): subtítulo, palabras clave, promo, descripción. Revisar campo por campo.
- **Las cinco capturas subidas** (reemplazando las viejas del fondo anterior).

---

## 2 · Permisos, ícono y la build 5 (revisado de nuevo)

**La build 5 falló por ITMS-90683: faltaba `NSHealthUpdateUsageDescription`.**
Ya está puesto en `app.json` (la librería de HealthKit linkea las APIs de
escritura aunque la app solo lea; el string es obligatorio). No se repite.

**Ícono:** `assets/icono.png`, 1024 × 1024, **RGB sin canal alfa** (verificado).
Un ícono con transparencia es el otro rechazo típico (ITMS-90717) y este no lo
tiene.

**Permisos (`app.json`), todos justificados y con su frase honesta:**
- Ubicación (uso / siempre / fondo) — registrar el día al llegar al gimnasio.
- Salud (lectura) — pasos y entrenamientos; nunca escribe.
- Micrófono — la app NO graba; el string existe porque `expo-audio` linkea la
  API. **A confirmar en el teléfono:** que NO aparezca el diálogo de micrófono en
  ningún momento (no debería, porque nunca se graba).
- Cámara + Fotos — la foto del día.
- Notificaciones — el aviso de fin de descanso, local.

Detalle completo en `auditoria-apple.md`.

---

## 3 · El día del envío, paso a paso

> Todo lo de `eas` se corre desde la carpeta `movil/`. La build tarda ~15–30 min;
> el procesamiento en ASC, otros ~10–30 min. No es instantáneo.

**A. Antes de tocar nada — confirmar que la base y el repo están sanos:**
1. `npm run test:conexion` → tiene que decir "producción coincide con el repo"
   (confirma que la migración 53 está y prod = repo).
2. `npm run test:bloqueo` → 26/26 (denunciar/bloquear andan en prod).

**B. Construir la build de tienda (número 6, sube solo):**
3. `cd movil`
4. `eas build --platform ios --profile store`
   - Espera a que termine (link en la terminal). Queda en ASC como build **6**.

**C. Subir la build a App Store Connect:**
5. `eas submit --platform ios --profile store --latest`
   - Usa la clave de API (rol APP_MANAGER); no pide el Apple ID a mano.
   - Espera a que ASC la procese: aparece en la app → TestFlight/Builds, primero
     "Processing", después lista.

**D. En la web de App Store Connect (appstoreconnect.apple.com):**
6. Entrá a la app **Ascent** → la versión **1.0.0** (si no existe la versión de
   venta, "+ Version or Platform" y crearla como 1.0.0).
7. **Build:** en la sección Build de esa versión, "+", elegí la build **6**.
8. **Textos:** pegá/verificá subtítulo, texto promocional, descripción y palabras
   clave desde `ficha-tienda.md`. Nombre ya está. URL de soporte y de privacidad.
9. **Capturas (6.9"):** subí las **cinco** de `Escritorio\ascent-tienda\` en orden
   (1-racha, 2-ranking, 3-contar-series, 4-fuerza-dots, 5-el-ano). Borrá las
   viejas.
10. **App Privacy:** completá el cuestionario con lo de §1 (si ya estaba, revisá
    que siga bien). Sin esto no deja enviar.
11. **App Review Information:**
    - Sign-in required: **sí**. Demo Account = el correo y la contraseña de la
      cuenta demo (están en `.env.local`: `DEMO_EMAIL` / `DEMO_PASSWORD`).
    - Notes: pegá las notas en inglés de `ficha-tienda.md` (permisos + denunciar/
      bloquear + qué es la app).
    - Contacto: tu nombre, mail y teléfono.
12. **RE-SEMBRAR LA CUENTA DEMO — JUSTO ACÁ, antes de enviar** (ver §4):
    - En la máquina: `node --env-file=.env.local supabase/cuenta-de-revision.mjs --de-cero`
    - Confirmá que imprime racha 45 · rango 5 · 6 amigos.
13. **Enviar:** "Add for Review" → "Submit". Listo.

> Si te pide export compliance: la app NO usa cifrado no exento
> (`ITSAppUsesNonExemptEncryption: false` ya está en `app.json`), así que
> respondé que no.

---

## 4 · La re-siembra del demo: cuándo, y qué pasa si te olvidás

**Cuándo: en el paso 12, lo más tarde posible, justo antes de "Submit".** No días
antes.

**Por qué:** la racha se calcula por días transcurridos desde los `logs`
sembrados. Si sembrás hoy y enviás dentro de tres días, el revisor abre una
cuenta con **tres huecos** y una racha más baja de la que dice la ficha —o, si
pasó una semana, una racha rota—. Sembrar al final hace que el revisor vea
exactamente lo que la ficha promete (racha 45, rango 5, 6 amigos, DOTS, 2
sesiones).

**Si te olvidás:** el revisor entra y ve una cuenta que no coincide con las
capturas ni con las notas —racha con huecos, ranking a medias—. En el mejor caso
lo confunde; en el peor, rechazo por "no pudimos verificar la app como se
describe". Se arregla corriendo `--de-cero` y volviendo a enviar, pero son días
perdidos.

**Si el envío se demora un día** (Apple te pide algo, reintentás mañana): volvé a
correr `--de-cero` antes de reintentar. Es barato y evita el hueco.

---

## 5 · Checklist de un vistazo

- [ ] `test:conexion` verde · `test:bloqueo` 26/26
- [ ] `eas build --profile store` (build 6, sube solo)
- [ ] `eas submit --profile store --latest`
- [ ] Build 6 elegida en la versión 1.0.0
- [ ] Textos pegados (subtítulo, keywords, promo, descripción, URLs)
- [ ] Cinco capturas subidas, las viejas borradas
- [ ] App Privacy completo
- [ ] Demo account + notas de App Review cargadas
- [ ] **Re-sembrar demo (`--de-cero`) justo antes de enviar**
- [ ] Add for Review → Submit
