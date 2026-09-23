// Shaders del motor de cuerpos celestes.
// Nada de imágenes: todo se genera por código, un solo motor con parámetros.
// El cuerpo se raytracea sobre un quad: eso da control total del borde
// (cobertura parcial contra el fondo) y del anillo/atmósfera fuera del disco.
//
// IMPORTANTE: el quad SIEMPRE es PlaneGeometry(2,2), así vP va de -1 a 1 sin
// importar el tamaño en pantalla (eso lo maneja mesh.scale). Cuando el quad
// era más chico que el disco, el disco no entraba y se veía el cuadrado.

export const VERTEX = /* glsl */ `
varying vec2 vP;
void main() {
  vP = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

// EL PRESAGIO. Lo que se ve los últimos días antes de subir de rango: que hay
// algo más adelante, sin decir qué.
//
// LA REGLA QUE MANDA ACÁ ES QUE NO PUEDE TENER FORMA. Dibujar el objeto del
// rango siguiente sería nombrarlo con la imagen en vez de con la palabra, y
// §7 prohíbe las dos. Por eso no hay disco, no hay anillo y sobre todo no hay
// borde: la caída llega a cero antes del filo del quad, así que nunca se ve
// dónde termina la cosa. Es una presencia, no un objeto.
//
// El color TAMPOCO puede ser el del rango que viene —el Sol es amarillo y eso
// contaría el final—: lo pinta quien lo monta con la paleta del rango ACTUAL.
export const FRAGMENT_PRESAGIO = /* glsl */ `
precision highp float;
varying vec2 vP;
uniform float uTime;
uniform vec3 uColor;
uniform float uFuerza;

// ruido baratísimo, solo para romper el bandeo
float ruidoP(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  float d = length(vP);
  // exponente alto sobre un smoothstep que muere adentro del quad: da una
  // caída sin contorno. Bajarlo hace aparecer un disco, que es justo lo que
  // no puede pasar.
  float campo = pow(1.0 - smoothstep(0.0, 1.0, clamp(d, 0.0, 1.0)), 2.6);
  // respiración de doce segundos: vivo, pero nunca llamando la atención.
  float respira = 0.82 + 0.18 * sin(uTime * 0.52);
  float a = campo * respira * uFuerza;
  // sin dither, un degradado tan tenue sale en anillos concéntricos y el
  // anillo ES una forma.
  a += (ruidoP(gl_FragCoord.xy) - 0.5) * 0.004;
  if (a <= 0.0) discard;
  gl_FragColor = vec4(uColor, a);
}
`;

// PARTÍCULAS REDONDAS. PointsMaterial dibuja cuadrados duros: por eso el
// polvo se veía pobre. Con shader propio cada partícula tiene su tamaño, su
// color y un borde que se desvanece.
export const VERTEX_PUNTOS = /* glsl */ `
attribute float tamano;
attribute float brillo;
varying vec3 vColor;
varying float vBrillo;
uniform float uTime;
uniform float uDpr;
uniform float uTitila;
// El agujero negro, en coordenadas de mundo: donde esta y cuanto mide su
// horizonte. En radio cero esta rama no corre, que es lo normal.
uniform vec2 uLenteC;
uniform float uLenteR;
void main() {
  vColor = color;
  // TITILAN (19/9): lento y cada una a su ritmo, con la fase sacada de dónde
  // está. Es lo que hace que se noten sin agrandarlas: el ojo ve lo que cambia.
  float semilla = fract(sin(dot(position.xy, vec2(12.9898, 78.233))) * 43758.5453);
  vBrillo = brillo * mix(1.0, 0.72 + 0.28 * sin(uTime * (0.6 + semilla * 1.4) + semilla * 6.2832), uTitila);
  vec3 p = position;
  // deriva lenta: el gas nunca está del todo quieto
  p.x += sin(uTime * 0.08 + position.y * 5.0) * 0.012;
  p.y += cos(uTime * 0.06 + position.x * 4.0) * 0.010;

  // LAS ESTRELLAS SE CURVAN ALREDEDOR DEL AGUJERO NEGRO.
  //
  // Es lo unico que hace que el circulo negro se lea como un POZO y no como un
  // disco pintado encima del cielo: el fondo que tendria que estar tapado
  // aparece rodeandolo. Todo lo demas que tenia el agujero —anillo de fotones,
  // arcos de lente, disco por delante y por detras— ya describia el gas; nada
  // tocaba el cielo.
  //
  // Se hace ACA, moviendo cada estrella, y no en el shader del cuerpo: no hay
  // a que ir a buscar el fondo desde el cuerpo —no se renderiza a textura— y
  // ademas moverlas cuesta una cuenta por estrella y no una por pixel.
  //
  // La cuenta es la imagen primaria del anillo de Einstein: una estrella que
  // de verdad esta a distancia r del centro se VE a
  //   (r + raiz(r^2 + 4 Re^2)) / 2
  // que siempre es mayor que Re. O sea: ninguna cae adentro de la sombra, y
  // las que estan justo detras se amontonan formando el aro. Se les sube el
  // brillo ahi mismo, que es lo que hace una lente de verdad.
  if (uLenteR > 0.0) {
    vec2 v = p.xy - uLenteC;
    float r = max(length(v), 1e-4);
    // El aro va BASTANTE mas afuera que el horizonte. De verdad cae casi
    // encima del anillo de fotones, y ahi no se ve: queda tapado por lo mas
    // brillante que tiene el cuerpo. Corrido para afuera, el amontonamiento
    // cae sobre cielo negro y se lee.
    float Re = uLenteR * 1.55;
    float rAp = 0.5 * (r + sqrt(r * r + 4.0 * Re * Re));
    p.xy = uLenteC + v * (rAp / r);
    vBrillo *= 1.0 + 3.0 * exp(-pow((rAp - Re) / (Re * 0.34), 2.0));
  }

  gl_PointSize = tamano * uDpr;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`;

export const FRAGMENT_PUNTOS = /* glsl */ `
precision highp float;
varying vec3 vColor;
varying float vBrillo;
void main() {
  // distancia al centro del punto: 0 en el medio, 1 en el borde
  float d = length(gl_PointCoord - vec2(0.5)) * 2.0;
  if (d > 1.0) discard;
  // núcleo compacto y halo que se apaga suave
  float nucleo = 1.0 - smoothstep(0.0, 0.45, d);
  float halo = 1.0 - smoothstep(0.15, 1.0, d);
  float a = clamp(nucleo * 0.85 + halo * 0.5, 0.0, 1.0) * vBrillo;
  if (a < 0.004) discard;
  gl_FragColor = vec4(vColor, a);
}
`;

export const FRAGMENT = /* glsl */ `
precision highp float;
precision highp int;

varying vec2 vP; // -1..1 en el quad

uniform float uTime;
uniform vec3 uPaleta0;
uniform vec3 uPaleta1;
uniform vec3 uPaleta2;
uniform vec3 uPaleta3;
uniform float uBandas;      // cantidad de bandas (0 = sin bandas)
uniform float uContraste;   // contraste de bandas
uniform float uTurbulencia; // intensidad de la deformación de dominio
uniform float uTormenta;    // 0 = sin tormenta
uniform vec2 uTormentaPos;  // posición (lon, lat) de la tormenta
uniform float uAnillo;      // 0 = sin anillo (Saturno)
uniform float uAnilloVert;  // anillo casi vertical (Urano)
// EL MODO ES CONSTANTE, NO UN UNIFORM (18/9): 0 planeta / 1 sol / 2 agujero
// negro / 3 roca / 4 aurora / 5 nebulosa. Llega como "#define MODO" desde el
// material, así cada modo es su propio programa y el compilador tira las
// ramas de los demás. Con un uniform, Chrome en Windows (Direct3D) compilaba
// las seis juntas: 134-140 s de página congelada. Ver spec/trampas.md.
const float uModo = float(MODO);
// Vale 0 siempre. Está para que los límites de los bucles no sean constantes:
// Direct3D desenrolla los bucles de límite fijo, y con el ruido adentro eso
// eran 28 de los 32 s que le quedaban al planeta. Misma cuenta, sin
// desenrollar.
uniform int uCero;
uniform float uCrateres;    // cráteres de verdad, con borde y sombra
uniform float uCasquetes;   // casquetes polares
uniform float uContinentes; // tierra firme sobre océano
uniform float uPuntos;      // depósitos brillantes (Ceres)
uniform float uMares;       // mares oscuros grandes (la Luna)
uniform float uManchas;     // zonas de hielo claro y oscuro (Plutón)
uniform float uRayos;       // rayos claros de cráteres jóvenes (la Luna)
uniform float uReposo;      // día de descanso: cara nocturna y giro frenado
// CUANTO SE VE LA SUPERFICIE en la cara nocturna. 0 = de dia, con la
// iluminacion de siempre. Ver nucleo/noche.ts: el numero es lo unico que
// separa un dia normal de uno de descanso.
uniform float uNoche;
uniform float uAtenua;      // 1 normal; menos = fantasma de la mejor racha
uniform float uSemilla;
uniform float uApagado;     // 1 = fondo apagado (pérdida de racha)
uniform float uPixel;       // tamaño de un píxel en unidades del quad

const float R = 0.46; // radio del cuerpo; deja lugar al anillo (2.02*R)
const float PI = 3.14159265;

// ---- hash entero (no sin(): el clásico fract(sin()) banda en móviles) ----
uint hu(uint x) {
  x ^= x >> 16u; x *= 0x7feb352du;
  x ^= x >> 15u; x *= 0x846ca68bu;
  x ^= x >> 16u;
  return x;
}
float hash3(ivec3 p) {
  uint h = hu(uint(p.x) * 73856093u ^ uint(p.y) * 19349663u ^ uint(p.z) * 83492791u ^ uint(int(uSemilla * 1913.0)));
  return float(h) * (1.0 / 4294967295.0);
}
float hash2f(vec2 c, float s) {
  return hash3(ivec3(int(c.x) + 512, int(c.y) + 512, int(s * 97.0)));
}
float hash1(float i, float s) {
  return hash3(ivec3(int(i) + 128, int(s * 31.0), 7));
}

// ---- ruido de valor 3D con interpolación suave ----
float ruido(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  ivec3 ii = ivec3(i) + ivec3(1000);
  float a = hash3(ii + ivec3(0,0,0));
  float b = hash3(ii + ivec3(1,0,0));
  float c = hash3(ii + ivec3(0,1,0));
  float d = hash3(ii + ivec3(1,1,0));
  float e = hash3(ii + ivec3(0,0,1));
  float f2 = hash3(ii + ivec3(1,0,1));
  float g = hash3(ii + ivec3(0,1,1));
  float h = hash3(ii + ivec3(1,1,1));
  return mix(
    mix(mix(a,b,u.x), mix(c,d,u.x), u.y),
    mix(mix(e,f2,u.x), mix(g,h,u.x), u.y),
    u.z);
}

// ---- 5 octavas ----
float fbm(vec3 p) {
  float v = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 5 + uCero; i++) {
    v += amp * ruido(p);
    p = p * 2.03 + vec3(17.1, 9.2, 4.3);
    amp *= 0.5;
  }
  return v;
}

// ---- deformación de dominio: dos campos desplazan a un tercero.
// Esto es lo que enrosca el gas en remolinos en vez de dejarlo en rayas. ----
float turbulento(vec3 p, float fuerza, out vec3 warp) {
  float qa = fbm(p + vec3(0.0, 0.0, 1.7));
  float qb = fbm(p + vec3(5.2, 1.3, 8.4));
  warp = vec3(qa, qb, qa * 0.5);
  return fbm(p + fuerza * warp);
}

// LA RAMPA DE COLORES, Y POR QUE SE SUAVIZA EL PARAMETRO.
//
// Antes era una interpolacion lineal en cada tramo. El VALOR salia continuo,
// pero la
// PENDIENTE saltaba en t = 1/3 y en t = 2/3, y el ojo humano exagera los
// cambios de pendiente —son las bandas de Mach—: un degradado perfectamente
// continuo se lee como DOS COLORES CON UN BORDE EN EL MEDIO.
//
// Ese es el defecto que hacia que los planetas parecieran un render viejo. No
// era el detalle ni la textura: era la costura entre colores.
//
// La curva s*s*(3-2s) lleva la pendiente a cero en cada parada, asi que los
// tramos se pegan sin costura. Es la misma que ya usa la funcion de ruido.
//
// LO USA TODO: bandas, anillo, crateres, el cuerpo, el filo. Un arreglo de tres
// multiplicaciones que toca cada pixel de cada cuerpo.
vec3 paleta(float t) {
  t = clamp(t, 0.0, 1.0);
  if (t < 0.3333) { float s = t * 3.0; return mix(uPaleta0, uPaleta1, s * s * (3.0 - 2.0 * s)); }
  if (t < 0.6666) { float s = (t - 0.3333) * 3.0; return mix(uPaleta1, uPaleta2, s * s * (3.0 - 2.0 * s)); }
  float s = (t - 0.6666) * 3.0;
  return mix(uPaleta2, uPaleta3, s * s * (3.0 - 2.0 * s));
}

// =====================================================================
// CRÁTERES — segunda pasada (2026-09-15, "siguen quedando pobres").
//
// TRES COSAS LOS HACÍAN VERSE COMO MANCHAS, y ninguna era el ruido:
//
// 1. ESTABAN ESTIRADOS AL DOBLE. Se calculaban sobre (lon × 0.55, lat × 1.1):
//    un círculo ahí es un óvalo dos veces más ancho que alto sobre la esfera,
//    y más ancho todavía lejos del ecuador. Ahora las celdas van por FILAS DE
//    LATITUD, cada fila con tantas celdas como le entran a su circunferencia,
//    y la distancia se mide en la superficie: un cráter es redondo en
//    cualquier latitud, y sin costura aunque el cuerpo gire para siempre.
//
// 2. NO TENÍAN LUZ PROPIA. El piso se oscurecía parejo, así que un cráter era
//    un círculo más oscuro. Lo que hace que el ojo lea un pozo es que la pared
//    que da a la luz esté clara y la de enfrente en sombra. Ahora cada cráter
//    es una altura —un tazón con labio— y lo que se devuelve es la PENDIENTE
//    contra la luz: la sombra y el brillo salen de la forma, no pintados.
//
// 3. EL BORDE SE PINTABA SUMANDO GRIS, y el gris lava el color del cuerpo.
//    Ahora la luz multiplica: el Ceres terroso sigue terroso.
//
// x = hundimiento (oclusión suave del piso), y = sombreado por pendiente
// =====================================================================
vec2 crateres(float lon, float lat, float escala, float sem, vec2 luz2) {
  float piso = 0.0;
  float luz = 0.0;
  float gy = lat * escala + sem * 0.37;
  float fila = floor(gy);
  for (int y = -1; y <= 1 + uCero; y++) {
    float fy = fila + float(y);
    // cuántas celdas le entran a esta fila: su circunferencia en celdas
    float latFila = (fy + 0.5 - sem * 0.37) / escala;
    float nx = max(3.0, floor(6.2831853 * escala * max(cos(latFila), 0.05)));
    float gx = lon / 6.2831853 * nx + sem * 1.3;
    float colX = floor(gx);
    float anchoCelda = 6.2831853 / nx; // en radianes de longitud
    for (int x = -1; x <= 1 + uCero; x++) {
      float cx = colX + float(x);
      vec2 id = vec2(mod(cx, nx), fy);
      float hSel = hash2f(id + 31.0, sem);
      if (hSel < 0.34) continue; // no toda celda tiene cráter
      float hProf = hash2f(id + 53.0, sem);
      float hAgu = hash2f(id + 71.0, sem);
      // centro del cráter, en la superficie
      float cLon = (cx + 0.15 + 0.7 * hash2f(id, sem) - sem * 1.3) * anchoCelda;
      float cLat = (fy + 0.15 + 0.7 * hash2f(id + 17.0, sem) - sem * 0.37) / escala;
      // desplazamiento en la superficie: la longitud se achica con la latitud
      vec2 rel = vec2((lon - cLon) * cos(lat), lat - cLat) * escala;
      float dist = length(rel) + 1e-5;
      if (dist > 0.75) continue;
      vec2 dir = rel / dist;

      // contorno apenas comido: redondo, pero no de compás
      float rug = ruido(vec3(dir * 2.3, hSel * 40.0));
      float r = (0.14 + hSel * 0.32) * (0.86 + 0.24 * rug);
      float t = dist / r;
      if (t > 1.6) continue;

      // la mayoría quedan apenas marcados; unos pocos, hondos
      float prof = pow(hProf, 2.2) * 1.2 + 0.08;
      // labio blando: uno filoso dibuja un anillo, y un anillo parece de compás
      float agu = 3.0 + hAgu * 3.5;

      // ALTURA: tazón hasta el borde, y el labio levantado alrededor.
      //   tazón  h = prof · (t² − 1)        dh/dt = 2·prof·t
      //   labio  h = labio · e^(−((t−1)·agu)²)
      float adentro = 1.0 - smoothstep(0.92, 1.02, t);
      float dTazon = 2.0 * prof * t * adentro;
      float labio = prof * (0.18 + 0.30 * hAgu);
      float e = exp(-pow((t - 1.0) * agu, 2.0));
      float dLabio = -2.0 * agu * agu * (t - 1.0) * labio * e;
      float dhdt = dTazon + dLabio;

      // LUZ POR PENDIENTE: la normal se inclina contra la pendiente, así que
      // la pared que mira a la luz es la del lado opuesto a ella.
      luz += -dot(dir, luz2) * dhdt;
      // piso: oclusión suave, no un plato negro
      piso += prof * (1.0 - smoothstep(0.2, 0.95, t)) * (0.8 + 0.4 * ruido(vec3(rel * 7.0, hSel * 5.0)));
    }
  }
  // erosión: hay regiones enteras casi lisas y otras muy castigadas
  float ero = 0.35 + 0.9 * fbm(vec3(lon * 0.9, lat * 1.7, sem * 11.0));
  return vec2(clamp(piso * ero, 0.0, 1.0), clamp(luz * ero * 0.5, -1.5, 1.5));
}

// Ruido "ridged": crestas afiladas en vez de ondas suaves. Es lo que hace
// que una roca se lea como piedra y no como líquido.
float ridged(vec3 p) {
  float v = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 5 + uCero; i++) {
    float n = 1.0 - abs(ruido(p) * 2.0 - 1.0);
    v += amp * n * n;
    p = p * 2.11 + vec3(3.7, 8.3, 1.9);
    amp *= 0.5;
  }
  return v;
}

// =====================================================================
// PROTUBERANCIAS SOLARES: arcos de plasma que salen del borde, crecen,
// se estiran y se apagan. Cada una con su tamaño, ángulo y tiempo, así
// que nunca coinciden dos.
// =====================================================================
// Son un detalle del canto, no el protagonista: arcos chicos y pegados a la
// superficie. Si crecen mucho se comen la pantalla y tapan al sol.
float protuberancias(vec2 p, float d) {
  float total = 0.0;
  for (int i = 0; i < 9 + uCero; i++) {
    float fi = float(i);
    float sa = hash1(fi, 3.0);
    float sb = hash1(fi + 20.0, 5.0);
    float sc = hash1(fi + 40.0, 9.0);

    float dur = 6.0 + sb * 9.0;               // cada una dura distinto
    float ciclo = fract(uTime / dur + sa);
    float vida = sin(ciclo * PI);             // nace, crece, se apaga
    if (vida <= 0.01) continue;
    vida = pow(vida, 0.8);

    // el ángulo deriva apenas, como si el plasma rotara con la estrella
    float ang = sa * 6.2831 + uTime * 0.015 + sc * 0.4;
    vec2 dir = vec2(cos(ang), sin(ang));

    float alto = (0.020 + sb * 0.055) * vida; // apenas asoma del limbo
    float ancho = 0.011 + sc * 0.016;

    // el arco es un anillo cuyo centro está apoyado sobre el limbo
    vec2 centro = dir * (R + alto * 0.45);
    float rad = alto * 0.55;
    float dl = abs(length(p - centro) - rad);

    // se recorta contra el disco y se desvanece con la altura
    float fuera = smoothstep(R - 0.012, R + 0.012, d);
    float forma = exp(-pow(dl / ancho, 2.0)) * fuera;

    // hilos internos: el plasma no es liso
    float hilo = 0.7 + 0.45 * fbm(vec3(p * 30.0, uTime * 0.3 + fi * 3.0));
    total += forma * vida * hilo;
  }
  return total;
}

void main() {
  vec2 p = vP;
  float aa = max(uPixel, 0.0015) * 1.5;
  vec3 col = vec3(0.0);
  float alfa = 0.0;

  // ================= NEBULOSA (modo 5) =================
  // El gas entre las partículas: sin esto se leen como puntos sueltos y no
  // como una nube. Densidad despareja a propósito, con zonas cargadas y
  // zonas casi vacías, y color mezclado —azules, violetas y algo cálido—
  // en vez de un gris plano.
  if (uModo > 4.5) {
    vec3 w;
    float base = turbulento(vec3(p * 1.25, uTime * 0.022), 3.0, w);
    // segunda escala: los grumos finos dentro de las masas grandes
    float fino = fbm(vec3(p * 4.5 + w.xy * 0.6, uTime * 0.03));

    // huecos: el gas no llena parejo
    float hueco = smoothstep(0.30, 0.62, fbm(vec3(p * 1.8 + vec2(11.0), 0.5)));
    float densidad = smoothstep(0.34, 0.86, base) * (0.45 + 0.75 * fino) * hueco;

    // el color viaja del violeta profundo al azul y toca un cálido donde
    // el gas está más denso, como en una nebulosa de verdad
    vec3 c = mix(uPaleta0, uPaleta1, smoothstep(0.2, 0.7, base));
    c = mix(c, uPaleta2, smoothstep(0.5, 0.95, fino));
    c = mix(c, uPaleta3, pow(densidad, 3.0) * 0.75);

    float bordes = smoothstep(1.15, 0.35, length(p * vec2(0.85, 1.0)));
    float inten = densidad * bordes;
    gl_FragColor = vec4(c * inten * 1.35 * uAtenua, clamp(inten * 0.85, 0.0, 1.0) * uAtenua);
    return;
  }

  // ================= AURORA (modo 4) =================
  // Gas que corre A LO LARGO DE LOS BRAZOS, no una cortina pegada encima.
  // Usa la misma ley de espiral con la que se arman las partículas y el
  // mismo achatado, así que se lee como parte de la galaxia. El quad rota
  // con ella, de modo que también gira en el plano del disco.
  if (uModo > 3.5) {
    vec2 q = vec2(p.x, p.y / 0.42);   // mismo achatado que las partículas
    float r = length(q) + 1e-5;
    float th = atan(q.y, q.x);
    // fase de la espiral: brazo = th - (r/0.85)*5.0, igual que las partículas
    float tt = clamp((r - 0.03) / 0.85, 0.0, 1.6);
    float fase = th - tt * 5.0;

    // turbulencia muestreada en coordenadas del disco: se enrosca con él
    vec3 w;
    float base = turbulento(vec3(cos(fase) * 1.4, sin(fase) * 1.4, r * 2.6 + uTime * 0.05), 2.6, w);

    // cuatro brazos: el gas se acumula sobre ellos y ondula a lo largo
    float onda = cos(fase * 4.0 + w.x * 2.6 + sin(r * 6.0 + uTime * 0.12) * 0.9);

    // BRAZOS OSCUROS CON EL BORDE ENCENDIDO (23/9).
    //
    // "Brilla toda pareja y parece una mancha." Y era eso: el brazo era una
    // joroba suave, mas clara en el centro y apagandose hacia los costados.
    // Un degrade no tiene forma; cuatro degrades juntos, menos todavia.
    //
    // Ahora el CUERPO del brazo queda oscuro y lo que se enciende son sus DOS
    // FLANCOS. El perfil pasa por el valor del filo una vez de cada lado del
    // brazo, asi que cada brazo sale dibujado por dos vetas de luz con oscuro
    // en el medio — que es el norte del motor (cuerpo oscuro, canto luminoso)
    // llevado a una forma que no es una esfera.
    float perfil = max(0.0, onda * 0.5 + 0.5);
    float cuerpo = pow(perfil, 2.6);
    float filo = exp(-pow((perfil - 0.61) / 0.145, 2.0));

    // estrías siguiendo el brazo, no verticales
    float estria = 0.22 + 1.10 * fbm(vec3(fase * 2.4, r * 9.0, uTime * 0.07));

    // se apaga en el núcleo (ahí mandan las partículas) y hacia afuera
    // Y EL GAS NO PASA DONDE NO HAY ESTRELLAS. Llegaba bastante mas lejos que
    // las particulas, asi que alrededor del cumulo quedaba una espiral de humo
    // sola: dos objetos en vez de uno.
    float radial = smoothstep(0.05, 0.22, r) * smoothstep(0.95, 0.35, r);

    // el color corre del violeta interior al verde-azulado de los bordes
    vec3 cGas = mix(uPaleta2, uPaleta3, clamp(tt * 0.9 + base * 0.35, 0.0, 1.0));
    // El filo no es el mismo color mas fuerte: va lavado hacia el blanco,
    // porque un borde encendido es luz y no mas pintura.
    vec3 cFilo = mix(cGas, vec3(1.0, 0.96, 0.90), 0.40);

    float comun = estria * radial * (0.35 + 0.8 * base);
    float inten = (cuerpo * 0.18 + filo * 1.10) * comun;
    col = (cGas * cuerpo * 0.18 + cFilo * filo * 1.10) * comun;
    alfa = inten * 0.75;

    gl_FragColor = vec4(col * uAtenua, clamp(alfa, 0.0, 1.0) * uAtenua);
    return;
  }

  // Luz fija arriba a la izquierda: el terminador sale del ángulo real
  // entre la normal y la luz, no de un degradado pegado.
  vec3 L = normalize(vec3(-0.55, 0.6, 0.58));
  vec2 L2 = normalize(L.xy);

  // ---- silueta ----
  float rEff = R;
  if (uModo > 2.5) {
    // ROCA: contorno irregular FIJO, que ademas no rota.
    //
    // POR QUE SE LE SACO EL GIRO (23/9). "Parece agua porque se mueve." Y era
    // cierto, aunque el comentario de al lado jurara que giraba como cuerpo
    // rigido: lo que giraba era la SILUETA, en dos dimensiones y en pantalla
    // —el angulo del pixel mas el tiempo—, mientras la superficie giraba como
    // esfera en longitud y a otra velocidad. Dos rotaciones distintas sobre el
    // mismo cuerpo, y encima la normal se sacaba de p dividido rEff: al
    // cambiar rEff con el tiempo, el mapa de la superficie se deformaba solo.
    // Eso es una gota, no una piedra.
    //
    // (Y otra vez los backticks: este archivo es un template literal de JS y
    // uno suelto en un comentario GLSL corta la cadena. Van sin.)
    //
    // Una roca de verdad tampoco tiene la silueta girando como una helice: si
    // voltea, la silueta CAMBIA DE FORMA. Fija es mucho mas honesto, y deja
    // que el unico movimiento sea el giro lento de la superficie.
    float ang = atan(p.y, p.x);
    float g1 = ruido(vec3(cos(ang) * 1.9, sin(ang) * 1.9, uSemilla));
    float g2 = ruido(vec3(cos(ang) * 5.5, sin(ang) * 5.5, uSemilla + 3.0));
    rEff = R * (0.80 + 0.20 * g1 + 0.09 * g2);
  }

  float d = length(p);
  float dentro = 1.0 - smoothstep(rEff - aa, rEff + aa, d);

  // ================= ESTELA DE LA ROCA =================
  if (uModo > 2.5) {
    // va detrás, en sentido contrario a la marcha: gas encendido que
    // se desarma a medida que se aleja
    vec2 marcha = normalize(vec2(0.80, 0.55));
    float t = dot(p, marcha);
    float perp = abs(dot(p, vec2(-marcha.y, marcha.x)));
    if (t < 0.0) {
      float largo = exp(t * 2.6);
      float ancho = exp(-pow(perp / (0.10 + (-t) * 0.30), 2.0));
      // LA ESTELA TAMBIEN SE CALMO. A 1,6 el gas hervia, y ese hervor era la
      // otra mitad de "parece agua": aunque la piedra quede quieta, algo
      // temblando pegado a ella arrastra al conjunto.
      float turb = fbm(vec3(p * 7.0 + marcha * uTime * 0.38, uTime * 0.12));
      float est = largo * ancho * (0.45 + 0.9 * turb);
      vec3 cEst = mix(uPaleta3, vec3(1.0, 0.72, 0.35), 0.55);
      col += cEst * est * 1.15;
      alfa = max(alfa, est * 0.9);
    }
  }

  // ================= ANILLO (Saturno / Urano) =================
  float zAnillo = -1.0;
  vec3 colAnillo = vec3(0.0);
  float alfaAnillo = 0.0;
  if (uAnillo > 0.5) {
    float tilt = mix(0.34, 0.94, uAnilloVert); // Urano lo tiene casi de canto
    vec2 q = mix(p, vec2(p.y, p.x), uAnilloVert);
    float rr = length(vec2(q.x, q.y / tilt));
    zAnillo = -q.y / tilt;
    float franjas = ruido(vec3(rr * 26.0, 0.0, uSemilla * 7.0));
    float franjas2 = ruido(vec3(rr * 70.0, 3.0, uSemilla * 2.0));
    float dentroAnillo = smoothstep(R * 1.28, R * 1.33, rr) * (1.0 - smoothstep(R * 1.93, R * 2.02, rr));
    float gap = 1.0 - 0.85 * smoothstep(R * 1.60, R * 1.64, rr) * (1.0 - smoothstep(R * 1.71, R * 1.75, rr));
    alfaAnillo = dentroAnillo * gap * (0.30 + 0.45 * franjas + 0.2 * franjas2);
    float sombra = 1.0 - 0.8 * smoothstep(0.15, -0.25, dot(normalize(vec3(p, 0.001)), L)) * step(d, R * 1.5);
    colAnillo = paleta(0.72 + 0.25 * franjas) * (0.5 + 0.5 * sombra);
  }
  if (alfaAnillo > 0.0 && (zAnillo < 0.0 || d > rEff)) {
    col = mix(col, colAnillo, alfaAnillo);
    alfa = max(alfa, alfaAnillo);
  }

  // ================= CUERPO =================
  if (dentro > 0.0) {
    vec3 n = vec3(p / rEff, 0.0);
    n.z = sqrt(max(0.0, 1.0 - dot(n.xy, n.xy)));

    // Coordenadas cilíndricas (cos/sin del ángulo) para que el ruido
    // no tenga costura en longitud.
    // En reposo el giro se frena: el cuerpo queda quieto, entero.
    // La roca gira DESPACIO. Con la silueta quieta, lo unico que se mueve es
    // esto, y a 0,09 se notaba la textura corriendo por encima de una forma
    // que no acompanaba.
    float vel = uModo > 2.5 ? 0.045 : 0.02;
    float rot = uTime * vel * (1.0 - uReposo);
    float lon = atan(n.x, n.z) + rot;
    float lat = asin(clamp(n.y, -1.0, 1.0));
    vec3 sc = vec3(cos(lon) * 1.6, sin(lon) * 1.6, lat * 2.2);
    // La roca NO se deforma: su superficie es fija y solo gira como cuerpo
    // rígido. Cualquier ruido que dependa del tiempo acá la vuelve líquida.

    vec3 warp;
    float t = turbulento(sc * 2.0, uTurbulencia, warp);

    // Bandas: seno de la latitud modulado por el ruido deformado
    float banda = 0.0;
    if (uBandas > 0.5) {
      banda = sin(lat * uBandas + warp.x * uTurbulencia * 2.2) * 0.5 + 0.5;
      // las bandas no son simétricas: unas más anchas que otras
      banda = mix(banda, smoothstep(0.35, 0.65, banda), 0.5);
      t = mix(t, banda, uContraste);
    }

    // Tormenta: mancha elíptica en coordenadas de superficie,
    // rota con el planeta y desaparece por el borde.
    if (uTormenta > 0.0) {
      vec2 dt = vec2(mod(lon - uTormentaPos.x + PI, 2.0 * PI) - PI, (lat - uTormentaPos.y) * 2.4);
      // el óvalo gira sobre sí mismo, como el ojo de Júpiter
      float a2 = uTime * 0.05;
      dt = vec2(dt.x * cos(a2) - dt.y * sin(a2), dt.x * sin(a2) + dt.y * cos(a2));
      float dist2 = dot(dt * vec2(1.0, 1.7), dt * vec2(1.0, 1.7)) * 20.0;
      float mancha = exp(-dist2) * uTormenta;
      t += mancha * (0.6 + 0.5 * fbm(sc * 6.0 + warp));
    }

    vec3 superficie = paleta(t);

    // ---- CONTINENTES (Tierra): tierra firme con costa, sobre océano ----
    if (uContinentes > 0.0) {
      float cont = fbm(sc * 1.5 + vec3(11.0));
      float tierra = smoothstep(0.48, 0.53, cont);
      vec3 mar = mix(uPaleta0, uPaleta1, 0.5 + 0.5 * fbm(sc * 4.0));
      vec3 suelo = mix(vec3(0.22, 0.32, 0.18), vec3(0.45, 0.42, 0.26), fbm(sc * 8.0));
      superficie = mix(mar, suelo, tierra * uContinentes);
    }

    // ---- CASQUETES POLARES ----
    if (uCasquetes > 0.0) {
      float bordePolo = 0.80 - 0.22 * uCasquetes;
      float hielo = smoothstep(bordePolo, bordePolo + 0.16, abs(sin(lat)) + fbm(sc * 5.0) * 0.16 - 0.08);
      superficie = mix(superficie, vec3(0.93, 0.95, 1.0), hielo * uCasquetes);
    }

    // ---- ROCA: superficie pétrea, con crestas y facetas ----
    if (uModo > 2.5) {
      float cr = ridged(sc * 3.2);
      float cr2 = ridged(sc * 9.0 + vec3(7.0));
      float piedra = cr * 0.7 + cr2 * 0.3;
      // escalones: la piedra tiene caras planas, no degradés continuos
      piedra = mix(piedra, floor(piedra * 7.0) / 7.0, 0.45);
      superficie = paleta(clamp(piedra * 1.15, 0.0, 1.0));
      superficie *= 0.75 + 0.5 * ridged(sc * 20.0); // grano mineral
    }

    // ---- CRÁTERES ----
    if (uCrateres > 0.0) {
      // Cuatro tamaños, de pocos grandes a muchos chicos, y los chicos se
      // pisan con los grandes como en una superficie vieja de verdad.
      vec2 c1 = crateres(lon, lat, 2.2, 1.0, L2);
      vec2 c2 = crateres(lon, lat, 4.6, 2.0, L2);
      vec2 c3 = crateres(lon, lat, 9.5, 3.0, L2);
      vec2 c4 = crateres(lon, lat, 19.0, 4.0, L2);
      float piso = min(1.0, c1.x + c2.x * 0.7 + c3.x * 0.5 + c4.x * 0.3);
      float luzC = c1.y + c2.y * 0.85 + c3.y * 0.55 + c4.y * 0.25;
      superficie *= (1.0 - 0.22 * piso * uCrateres);
      // La luz MULTIPLICA: la pared iluminada aclara el color del cuerpo y la
      // otra lo oscurece, en vez de pintar gris encima.
      superficie *= clamp(1.0 + 0.62 * luzC * uCrateres, 0.28, 1.75);
    }

    // ---- MANCHAS DE HIELO (Plutón) ----
    // Zonas claras y oscuras muy contrastadas, con bordes difusos: la
    // llanura brillante de nitrógeno contra las regiones oscuras rojizas.
    if (uManchas > 0.0) {
      vec3 wm;
      float campo = turbulento(sc * 1.05, 2.0, wm);
      // claro: enorme, de bordes suaves
      float claro = smoothstep(0.46, 0.68, campo);
      // oscuro: otra región, en otra frecuencia y desfasada
      float oscuro = smoothstep(0.58, 0.72, fbm(sc * 0.85 + vec3(19.0, 7.0, 3.0)));
      oscuro *= (1.0 - claro);
      vec3 hielo = vec3(0.94, 0.91, 0.84);
      vec3 mancha = vec3(0.20, 0.13, 0.10);
      superficie = mix(superficie, hielo, claro * uManchas);
      superficie = mix(superficie, mancha, oscuro * uManchas * 0.95);
      // vetas finas dentro del hielo, como las celdas de convección
      float veta = smoothstep(0.48, 0.52, fbm(sc * 7.0 + vec3(5.0)));
      superficie *= 1.0 - 0.10 * veta * claro * uManchas;
    }

    // ---- MARES oscuros (la Luna los tiene; los demás no) ----
    if (uMares > 0.0) {
      float mar = smoothstep(0.54, 0.70, fbm(sc * 1.25 + vec3(4.4)));
      superficie *= (1.0 - 0.34 * mar * uMares);
    }

    // ---- RAYOS: las estrías claras que dejan los cráteres jóvenes ----
    if (uRayos > 0.0) {
      float rr2 = fbm(sc * 2.2 + vec3(13.0));
      float estrias = pow(max(0.0, ruido(sc * 14.0 + vec3(31.0))), 3.0);
      float rayo = smoothstep(0.55, 0.80, rr2) * estrias;
      superficie += vec3(0.22, 0.23, 0.26) * rayo * uRayos;
    }

    // ---- DEPÓSITOS BRILLANTES (la marca de Ceres) ----
    if (uPuntos > 0.0) {
      float pt = smoothstep(0.74, 0.86, fbm(sc * 5.5 + vec3(21.0)));
      float pt2 = smoothstep(0.80, 0.92, fbm(sc * 12.0 + vec3(9.0)));
      superficie += vec3(0.85, 0.88, 0.95) * (pt * 0.9 + pt2 * 0.5) * uPuntos;
    }

    if (uModo > 0.5 && uModo < 1.5) {
      // ================= SOL =================
      //
      // LA CARA OSCURA Y EL CANTO EN LLAMAS (25/9). Antes era un disco
      // amarillo brillante con OSCURECIMIENTO DE LIMBO —claro en el medio,
      // apagado en el borde— y se veia como un render viejo: una bola de un
      // color, sin superficie.
      //
      // La foto de referencia hace exactamente lo contrario, y es ademas lo que
      // ya hacen los planetas en descanso: una esfera AMBAR OSCURA con la
      // granulacion a la vista, y un filo blanco encendido en todo el contorno
      // del que salen las protuberancias.
      //
      // EL FILO VA EN TODA LA VUELTA y no de un lado. Una estrella no tiene
      // cara nocturna: se enciende sola, asi que no hay un lado iluminado y
      // otro en sombra. Ademas es real — el borde del Sol brilla mas que el
      // centro en H-alfa, que es como esta sacada la foto.
      float gran = fbm(sc * 5.0 + vec3(uTime * 0.09));
      float gran2 = fbm(sc * 13.0 - vec3(uTime * 0.15));
      // EL INDICE ARRANCA CASI EN CERO, Y ADEMAS SE MULTIPLICA MAS ABAJO. Toda
      // la paleta del Sol es clara —el mas oscuro de sus cuatro colores ya es
      // un naranja encendido— asi que correr el indice no alcanza: el primer
      // intento dejo una cara crema, lejos de la foto. Hacen falta las dos.
      //
      // Y EL RANGO ES CORTO. Con un rango largo la granulacion llegaba al
      // crema del final de la paleta y el disco salia beige; el sol de la foto
      // es ambar, nunca crema. El indice se queda entre los dos naranjas.
      superficie = paleta(0.02 + 0.26 * gran + 0.10 * gran2);

      // MANCHAS SOLARES: pocas y chicas. En un disco brillante no se veian; en
      // uno oscuro son lo que dice "esto tiene superficie" en vez de "esto es
      // un degradado". El primer intento las puso grandes y seguidas y el sol
      // quedo sucio, con manchones grises: el umbral sube para que sean pocas.
      float mancha = smoothstep(0.76, 0.88, fbm(sc * 3.4 + vec3(uTime * 0.03, 0.0, 9.0)));
      superficie *= (1.0 - 0.5 * mancha);

      // La cara, apagada. El termino de n.z ya no ilumina el centro: apenas
      // levanta lo que mira a la camara, para que la esfera siga siendo esfera.
      //
      // LA GRANULACION TAMBIEN VA EN EL BRILLO y no solo en el color. Sobre una
      // cara oscura, correr el indice de una paleta corta casi no se nota: los
      // dos naranjas se parecen. Lo que hace que se lea "hervido" es que unas
      // celdas esten mas apagadas que otras.
      float celdas = 0.55 + 0.85 * gran + 0.25 * gran2;
      vec3 cara = superficie * celdas * (0.16 + 0.26 * pow(n.z, 0.8));

      // EL CANTO. El termino 1.0 - n.z es cero en el medio y uno en el borde:
      // la potencia lo aprieta contra el filo. Es lo unico brillante del cuerpo
      // y por eso va con la parte mas clara de la paleta.
      float canto = pow(1.0 - n.z, 3.2);
      cara += mix(paleta(0.95), vec3(1.0, 0.95, 0.80), 0.5) * canto * 2.8;

      col = mix(col, cara, dentro);
      alfa = max(alfa, dentro);
    } else if (uModo > 1.5 && uModo < 2.5) {
      // ---- AGUJERO NEGRO: el horizonte es negro absoluto ----
      col = mix(col, vec3(0.0), dentro);
      alfa = max(alfa, dentro);
    } else {
      // ---- PLANETA / ROCA ----
      float dif = max(dot(n, L), 0.0);
      float term = smoothstep(0.0, 0.35, dif);
      vec3 lit = superficie * (0.06 + 0.94 * term * (0.55 + 0.45 * dif));

      // DÍA DE DESCANSO: se lo ve desde su lado nocturno. La cara queda en
      // sombra y solo queda un filo de luz en el canto. El cuerpo sigue
      // entero: no se apaga ni se atenúa, se lo mira de noche.
      //
      // OJO CON LOS BACKTICKS ACA ADENTRO: esto es un template literal de JS, y
      // un backtick suelto en un comentario GLSL corta la cadena. Me paso dos
      // veces seguidas escribiendo este mismo bloque.
      //
      // LA CARA NOCTURNA, ahora tambien de dia. El nivel lo pone uNoche:
      // 0,055 en descanso, bastante mas arriba en un dia normal. En cero, esta
      // rama no corre y queda la iluminacion de siempre.
      //
      // El filo NO se escala con el nivel: es lo que describe la forma cuando la
      // superficie no se ve, y bajarlo junto con ella dejaria un disco plano.
      if (uNoche > 0.0) {
        float rim = pow(1.0 - n.z, 4.0);
        vec2 dirB = normalize(n.xy + vec2(1e-5));
        float ladoLuz = max(dot(dirB, L2), 0.0);
        vec3 nocturno = superficie * uNoche;
        nocturno += paleta(0.92) * rim * pow(ladoLuz, 1.4) * 1.9;
        lit = nocturno;
      }

      // Neblina: segunda capa rotando a distinta velocidad que la superficie.
      // La rotación diferencial es lo que evita la calcomanía girando.
      if (uModo < 0.5) {
        float rot2 = uTime * 0.034;
        float lon2 = atan(n.x, n.z) + rot2;
        vec3 sc2 = vec3(cos(lon2) * 1.1, sin(lon2) * 1.1, lat * 1.5);
        float neb = fbm(sc2 * 2.4 + vec3(31.7));
        lit = mix(lit, paleta(0.92) * (0.1 + 0.9 * term), smoothstep(0.55, 0.9, neb) * 0.22);
      }

      col = mix(col, lit, dentro);
      alfa = max(alfa, dentro);
    }
  }

  // ================= FUERA DEL DISCO =================
  float fuera = smoothstep(rEff - aa, rEff + aa, d);

  if (uModo > 0.5 && uModo < 1.5) {
    // ---- corona + protuberancias ----
    //
    // SUBEN LAS DOS, y no es decoracion: con la cara apagada, el sol dejo de
    // ser lo mas brillante de la pantalla, y eso importa porque el rango 5 es
    // "Jupiter se enciende y se vuelve Sol". La luz que perdio el disco la
    // ponen el halo y las protuberancias, que es de donde sale en la foto.
    float glow = exp(-(d - R) * 8.0) * fuera;
    col += paleta(0.92) * glow * 0.95;
    alfa = max(alfa, glow * 0.8);

    float pr = protuberancias(p, d);
    vec3 cPr = mix(paleta(0.9), vec3(1.0, 0.88, 0.6), 0.45);
    col += cPr * pr * 1.6;
    alfa = max(alfa, min(1.0, pr * 1.2));

  } else if (uModo > 1.5 && uModo < 2.5) {
    // ---- AGUJERO NEGRO ----
    // Se compone por capas, de atrás hacia adelante, que es lo que da volumen:
    //   1. mitad LEJANA del disco  -> se recorta contra el horizonte
    //   2. arcos de lente          -> rodean el horizonte, arriba y abajo
    //   3. el horizonte negro ya quedó pintado en el bloque del cuerpo
    //   4. mitad CERCANA del disco -> pasa POR DELANTE y tapa el negro abajo
    //   5. anillo de fotones       -> encima de todo
    float achata = 0.26;                       // el disco se ve casi de canto
    float rr = length(vec2(p.x, p.y / achata));
    float angD = atan(p.y / achata, p.x);
    float velD = 1.0 / max(rr, 0.22);

    float banda = smoothstep(R * 1.04, R * 1.18, rr) * (1.0 - smoothstep(R * 1.80, R * 2.30, rr));

    // EL GRANO SIGUE LA ESPIRAL Y NO EL RADIO (23/9). El ruido estaba indexado
    // por el radio —rr * 9.0— y el gas salia en ANILLOS CONCENTRICOS: bandas
    // duras, que es justo lo que no queremos en ningun cuerpo del motor. Al
    // correr el angulo con el radio, las mismas vetas se estiran en filamentos
    // que caen hacia adentro, que es como se ve un disco de acrecion.
    //
    // Y la frecuencia radial baja de 9 a 1,4: es lo que deja que un filamento
    // se mantenga a lo largo de varias vueltas en vez de cortarse cada poco.
    float giro = angD - 2.4 * (rr / R) + uTime * velD * 0.5;
    float franjas = 0.5 + 0.5 * fbm(vec3(cos(giro) * 2.0, sin(giro) * 2.0, rr * 1.4));
    // una segunda pasada mas fina y mas rapida: el gas de adentro hierve
    float fino = fbm(vec3(cos(giro * 2.7) * 3.0, sin(giro * 2.7) * 3.0, rr * 4.0));
    franjas = pow(smoothstep(0.15, 0.9, franjas + 0.18 * fino), 1.5);

    // doppler: el lado que viene hacia nosotros encandila
    float doppler = 0.30 + 1.0 * smoothstep(0.6, -0.6, p.x);

    // TEMPERATURA: el gas pegado al horizonte esta mucho mas caliente que el
    // del borde de afuera, y eso se ve como color, no como brillo. Antes el
    // disco entero era un naranja con ruido y se leia como un plato pintado.
    float temp = 1.0 - smoothstep(R * 1.05, R * 2.05, rr);
    //
    // El borde de afuera va APAGADO y no en el naranja puro: con los colores
    // de la paleta a full quedaba un rosa de neon, que no es gas frio, es un
    // cartel. Se lo baja hasta un rescoldo.
    vec3 frio = mix(uPaleta1 * 0.55, uPaleta2 * 0.40, 0.55);
    vec3 calor = mix(uPaleta3, vec3(1.0, 0.95, 0.88), 0.55);
    vec3 gasCol = mix(frio, uPaleta2, smoothstep(0.0, 0.55, temp));
    gasCol = mix(gasCol, calor, pow(temp, 2.4));
    gasCol *= doppler * (0.55 + 0.7 * franjas);
    // Los huecos entre filamentos son mas huecos que antes (0,18 contra 0,35):
    // si el piso es alto, las vetas se pierden en un resplandor parejo.
    float dens = banda * (0.18 + 1.15 * franjas);

    // La mitad de abajo del anillo es la que viene hacia la cámara; la de
    // arriba es la que se aleja. El borde suave evita una costura en y=0.
    float cercano = smoothstep(0.03, -0.03, p.y);

    // (1) mitad lejana: solo se ve fuera del horizonte
    col += gasCol * dens * (1.0 - cercano) * fuera * 1.8;
    alfa = max(alfa, min(1.0, dens * (1.0 - cercano) * fuera * 2.0));

    // (2) LENTE GRAVITACIONAL: la luz del disco que pasa DETRÁS se curva y
    // reaparece rodeando al horizonte, formando un arco arriba y otro abajo.
    // Es lo que cierra el aro naranja alrededor del círculo negro.
    float dl = abs(d - R * 1.13);
    float aro = exp(-pow(dl / (R * 0.14), 2.0));
    vec2 dirp = normalize(p + vec2(1e-5));
    // más fuerte arriba y abajo, que es adonde no llega el disco directo
    float refuerzo = 0.30 + 1.15 * pow(abs(dirp.y), 1.4);
    float texL = 0.55 + 0.6 * fbm(vec3(cos(angD * 1.5 + uTime * 0.25) * 2.0,
                                       sin(angD * 1.5 + uTime * 0.25) * 2.0, 4.0));
    float lente = aro * refuerzo * doppler * texL * fuera;
    col += mix(uPaleta2, uPaleta3, 0.45) * lente * 1.6;
    alfa = max(alfa, min(1.0, lente * 1.6));

    // segundo arco, más fino y pegado: la imagen de orden superior
    float aro2 = exp(-pow((d - R * 1.055) / (R * 0.045), 2.0));
    col += mix(uPaleta3, vec3(1.0, 0.82, 0.5), 0.4) * aro2 * refuerzo * doppler * 1.1 * fuera;
    alfa = max(alfa, aro2 * refuerzo * fuera);

    // (4) mitad cercana: NO se recorta. Cruza por delante del círculo negro
    // y lo tapa abajo — sin esto el agujero se ve plano.
    col += gasCol * dens * cercano * 1.9;
    alfa = max(alfa, min(1.0, dens * cercano * 2.0));

    // (5) anillo de fotones, pegado al horizonte
    float foton = exp(-abs(d - R * 1.02) * 95.0);
    col += vec3(1.0, 0.80, 0.48) * foton * 2.0 * fuera;
    alfa = max(alfa, foton * 0.85 * fuera);

    // aura de gas suelta, siguiendo la forma achatada del disco
    vec3 w2;
    float aura0 = turbulento(
      vec3(cos(angD + uTime * velD * 0.35) * 1.8,
           sin(angD + uTime * velD * 0.35) * 1.8,
           rr * 3.0), 2.2, w2);
    float caida = exp(-(rr - R) * 1.9) * smoothstep(R * 0.98, R * 1.15, rr);
    float aura = caida * smoothstep(0.32, 0.88, aura0);
    col += mix(uPaleta1, uPaleta2, aura0) * aura * 0.7 * max(fuera, cercano);
    alfa = max(alfa, aura * 0.45);

  } else if (uModo < 0.5 && dentro < 1.0) {
    // Luz de atmósfera SOLO en el canto iluminado.
    // Rodear el planeta entero es físicamente imposible y se nota.
    vec2 dirBorde = normalize(p + vec2(1e-5));
    float ladoLuz = max(dot(vec3(dirBorde, 0.0), L), 0.0);
    float halo = exp(-(d - rEff) * 24.0) * fuera * ladoLuz;
    col += paleta(0.95) * halo * 0.8;
    alfa = max(alfa, halo * 0.7);

  } else if (uModo > 2.5 && dentro < 1.0) {
    // la roca va al rojo por el roce, sobre todo del lado de la marcha
    vec2 marcha = normalize(vec2(0.80, 0.55));
    float frente = max(dot(normalize(p + vec2(1e-5)), marcha), 0.0);
    float calor = exp(-(d - rEff) * 26.0) * fuera * pow(frente, 1.5);
    col += mix(uPaleta3, vec3(1.0, 0.65, 0.3), 0.5) * calor * 1.5;
    alfa = max(alfa, calor);
  }

  // anillo por delante del planeta
  if (uAnillo > 0.5 && alfaAnillo > 0.0 && zAnillo >= 0.0 && d <= rEff) {
    col = mix(col, colAnillo, alfaAnillo);
    alfa = max(alfa, alfaAnillo);
  }

  // Dentro del horizonte no entra NADA que agregue luz de fondo: ni grano
  // ni el tinte de "apagado". Lo único que puede verse ahí es el gas que
  // pasa por delante, que ya se compuso arriba. Ojo: no se puede poner el
  // color en cero acá, porque eso borraría justamente ese gas.
  bool enHorizonte = (uModo > 1.5 && uModo < 2.5 && d < rEff);

  // Grano animado sutil: rompe el bandeado en los degradados oscuros.
  // En la roca va casi apagado: cualquier titileo sobre la piedra la hace
  // parecer agua.
  float grano = hash3(ivec3(int(gl_FragCoord.x), int(gl_FragCoord.y), int(mod(uTime * 24.0, 100.0)))) - 0.5;
  if (!enHorizonte) col += grano * (uModo > 2.5 ? 0.004 : 0.018);

  // fondo apagado (pérdida de racha)
  if (!enHorizonte) col = mix(col, col * 0.35 + vec3(0.01, 0.012, 0.02), uApagado);

  // el círculo del horizonte es opaco: tapa las estrellas de atrás
  if (enHorizonte) alfa = 1.0;

  col *= uAtenua;
  alfa *= uAtenua;
  gl_FragColor = vec4(col, clamp(alfa, 0.0, 1.0));
}
`;

// ===================================================================
// EL ESTILO PLANO — forma y luz, sin textura que imite una foto.
//
// POR QUÉ EXISTE. El estilo realista tiene un techo bajo: 775 líneas de shader
// y 68 usos de ruido fractal para fabricar cráteres, bandas y tormentas que
// igual no engañan a nadie. Un realismo a medias no se ve bien nunca, y
// envejece mal. Lo que sí envejece bien es una forma limpia con buena luz.
//
// El disparador fue una observación del humano: de los diez planetas del rango
// 4, el que más le gustó fue Venus — el ÚNICO sin rasgos, una esfera cálida con
// atmósfera. El objeto con menos detalle falso era el que mejor pegaba con el
// resto de la app.
//
// QUÉ HACE, y es todo lo que hace:
//   1. Una esfera, resuelta en el fragmento (no hay geometría: es un plano).
//   2. UNA luz, con su terminador suave. La luz da la forma; sin ella esto es
//      un círculo de color.
//   3. Un borde encendido del lado oscuro, que es lo que separa el objeto del
//      fondo negro sin dibujarle un contorno.
//   4. Un degradado de dos colores de la paleta, para que no sea plano plano.
//
// LO QUE NO HACE, a propósito: ruido, cráteres, bandas, continentes, manchas.
// Nada de eso.
//
// EL COSTO. El realista evalúa ruido fractal por píxel, que son varias octavas
// de hash e interpolación cada una. Esto son dos productos escalares y un par
// de `smoothstep`. No hace falta medirlo para saber cuál es más barato, pero
// igual se mide.
export const FRAGMENT_PLANO = /* glsl */ `
precision mediump float;
varying vec2 vP;

uniform vec3 uPaleta0;   // el lado en sombra
uniform vec3 uPaleta1;   // el cuerpo
uniform vec3 uPaleta2;   // lo iluminado
uniform vec3 uPaleta3;   // el reflejo más claro
uniform float uAtenua;
uniform float uApagado;
uniform float uModo;     // 1 = emisor (sol): se ilumina solo
uniform float uAnillo;
uniform float uAnilloVert;
uniform float uPixel;

void main() {
  float r = length(vP);
  // EL BORDE SE SUAVIZA CON EL TAMAÑO DEL PÍXEL, no con un número fijo: en una
  // pantalla de más densidad un borde de 0.01 se ve duro, y en una de menos se
  // ve sucio. Es la misma razón por la que \`uPixel\` ya existía.
  float borde = max(uPixel * 1.5, 0.004);

  // EL ANILLO, que es la única "cosa" que se dibuja además de la esfera. Es
  // geometría, no textura: sobrevive al estilo plano y es lo que distingue a
  // Saturno de cualquier otra bola de color.
  float anillo = 0.0;
  if (uAnillo > 0.5) {
    // Se aplasta el eje para verlo de canto, y mucho más si es el de Urano.
    vec2 q = vP;
    float aplaste = uAnilloVert > 0.5 ? 0.14 : 0.30;
    q.y /= aplaste;
    float ra = length(q);
    anillo = smoothstep(1.62, 1.58, ra) * smoothstep(1.16, 1.20, ra);
    // El tramo que pasa por delante del cuerpo no se dibuja desde atrás.
    if (r < 0.98 && vP.y > 0.0) anillo *= 0.10;
  }

  if (r > 1.0 + borde && anillo <= 0.001) discard;

  // LA ESFERA. La normal sale del propio plano: en el borde apunta hacia
  // afuera, en el centro hacia la cámara.
  float z = sqrt(max(0.0, 1.0 - r * r));
  vec3 n = normalize(vec3(vP, z));

  // UNA sola luz, arriba a la izquierda y un poco hacia la cámara.
  vec3 luz = normalize(vec3(-0.55, 0.62, 0.56));
  float d = dot(n, luz);

  // EL TERMINADOR. \`smoothstep\` y no un corte: el borde entre luz y sombra es
  // lo que hace que esto se lea como un volumen y no como dos medias lunas.
  float ilum = smoothstep(-0.28, 0.72, d);

  vec3 color = mix(uPaleta0, uPaleta1, smoothstep(0.0, 0.45, ilum));
  color = mix(color, uPaleta2, smoothstep(0.42, 0.92, ilum));
  // Un brillo suave donde la luz pega más de frente. No es un especular duro:
  // estos cuerpos no son bolas de billar.
  color = mix(color, uPaleta3, smoothstep(0.88, 1.0, ilum) * 0.55);

  // EL BORDE ENCENDIDO DEL LADO OSCURO. Es lo que despega al objeto del fondo
  // negro sin ponerle un contorno, y es la mitad de por qué esto se ve bien.
  float rim = smoothstep(0.72, 1.0, r) * (1.0 - smoothstep(0.35, 0.95, ilum));
  color += uPaleta2 * rim * 0.42;

  // EL SOL SE ILUMINA SOLO: no tiene lado en sombra porque la luz es él.
  if (uModo > 0.5 && uModo < 1.5) {
    float caida = smoothstep(1.0, 0.15, r);
    color = mix(uPaleta1, uPaleta3, caida * caida);
    ilum = 1.0;
  }

  float alfa = 1.0 - smoothstep(1.0 - borde, 1.0 + borde, r);
  if (anillo > 0.001) {
    color = mix(color, uPaleta2 * 0.92, anillo * (1.0 - alfa * 0.85));
    alfa = max(alfa, anillo * 0.85);
  }

  // Apagado: el día que se perdió la racha. Se desatura, no se oscurece: un
  // objeto oscuro parece apagado por la noche; uno gris parece perdido.
  if (uApagado > 0.5) {
    float gris = dot(color, vec3(0.299, 0.587, 0.114));
    color = mix(color, vec3(gris), 0.72);
  }

  gl_FragColor = vec4(color * uAtenua, alfa);
}
`;

// LA ESTRELLA FUGAZ (19/9). Un trazo que se afina hacia la cola: en el quad,
// `x` va de la cola (0) a la cabeza (1) e `y` es el ancho. Cuánto se ve lo
// maneja `uAlfa` desde la escena (entra, cruza y se apaga en un segundo).
export const VERTEX_FUGAZ = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const FRAGMENT_FUGAZ = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float uAlfa;
uniform vec3 uColor;
void main() {
  float cola = pow(vUv.x, 2.4);
  float ancho = pow(max(0.0, 1.0 - abs(vUv.y - 0.5) * 2.0), 2.5);
  // la cabeza, un punto un poco más brillante
  float cabeza = smoothstep(0.9, 1.0, vUv.x) * 0.6;
  float a = (cola + cabeza) * ancho * uAlfa;
  if (a < 0.003) discard;
  gl_FragColor = vec4(uColor, clamp(a, 0.0, 1.0));
}
`;
