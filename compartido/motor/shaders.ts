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

// Una estrella es un punto, no una bola: un núcleo y una caída corta, sin halo.
export const FRAGMENT_ESTRELLA = /* glsl */ `
precision highp float;
varying vec3 vColor;
varying float vBrillo;
void main() {
  float d = length(gl_PointCoord - vec2(0.5)) * 2.0;
  float a = (1.0 - smoothstep(0.5, 1.0, d)) * vBrillo;
  if (a < 0.004) discard;
  gl_FragColor = vec4(vColor, a);
}
`;

// La banda del cielo: el color viene en cada vértice. El grano rompe las franjas que se forman en
// los degradados casi negros, que en una pantalla de 8 bits se ven como escalones.
export const VERTEX_BANDA = /* glsl */ `
attribute vec4 colorA;
varying vec4 vColorA;
void main() {
  vColorA = colorA;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
export const FRAGMENT_BANDA = /* glsl */ `
precision highp float;
varying vec4 vColorA;
void main() {
  float grano = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
  gl_FragColor = vec4(vColorA.rgb, clamp(vColorA.a + grano * 0.006, 0.0, 1.0));
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
uniform float uHorizonte;   // 1 = el cuerpo hace de horizonte (la app del teléfono)

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

// ALTURA DE LA ROCA: el campo de relieve de la piedra, como un solo número.
// Existe aparte para poder muestrearlo en tres puntos y sacar la PENDIENTE:
// sin eso el ridged solo teñía el color y la superficie se leía plana —una
// mancha. Con la pendiente, la luz global talla las crestas (ver el bump más
// abajo). El floor deja caras planas: piedra facetada, no degradé continuo.
float alturaRoca(vec3 s) {
  float cr = ridged(s * 3.2);
  float cr2 = ridged(s * 9.0 + vec3(7.0));
  float piedra = cr * 0.7 + cr2 * 0.3;
  return mix(piedra, floor(piedra * 7.0) / 7.0, 0.45);
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
  // LEJOS DEL LIMBO NO HAY PROTUBERANCIAS (28/9): el bucle entero corria en
  // CADA pixel del cuadro, esquinas transparentes incluidas. Y adentro del
  // disco tampoco: ahi las tapa la cara.
  if (d > R + 0.20 || d < R - 0.015) return total;
  for (int i = 0; i < 8 + uCero; i++) {
    float fi = float(i);
    float sa = hash1(fi, 3.0);
    float sb = hash1(fi + 20.0, 5.0);
    float sc = hash1(fi + 40.0, 9.0);

    float dur = 9.0 + sb * 12.0;              // cada una dura distinto
    float reloj = uTime / dur + sa;
    float vida = sin(fract(reloj) * PI);      // nace, crece, se apaga
    if (vida <= 0.01) continue;
    vida = pow(vida, 0.7);

    // Cada vez que renace, sale en otro lugar del borde: con el angulo fijo
    // eran siempre las mismas nueve, y a la tercera vuelta se notaba.
    float ang = hash1(fi + floor(reloj) * 13.0, 3.0) * 6.2831 + uTime * 0.012;
    vec2 dir = vec2(cos(ang), sin(ang));
    vec2 tg = vec2(-dir.y, dir.x);

    // cuanto asoma del borde, y el medio ancho: unas altas y finas, otras bajas y abiertas
    float asoma = (0.022 + sb * 0.058) * (0.35 + 0.65 * vida);
    float alto = asoma * 2.0;
    float medio = asoma * (0.7 + 1.3 * sc);

    // UN ARCO CON DOS PIES, NO UN ANILLO. Antes el centro del anillo iba
    // AFUERA del limbo y asomaba entero: una rosquita apoyada en el borde. La
    // elipse ahora tiene el centro ADENTRO del disco y solo asoma su mitad
    // de arriba: el lazo que sale de la superficie y vuelve a ella.
    vec2 q = p - dir * (R - asoma);
    float e = length(vec2(dot(q, dir) / alto, dot(q, tg) / medio));
    float forma = exp(-pow((e - 1.0) / (0.09 + 0.10 * sc), 2.0)) * smoothstep(R - 0.010, R + 0.006, d);

    // ESTE ARCO NO APORTA ACA (28/9): el fbm de los hilos solo corre en los
    // pocos pixeles pegados a un arco vivo.
    if (forma < 0.002) continue;

    // hilos internos: el plasma no es liso. Y se afina hacia arriba: los pies
    // son lo mas denso del lazo.
    float hilo = 0.50 + 1.0 * fbm(vec3(p * 34.0, uTime * 0.25 + fi * 3.0));
    float arriba = clamp((d - R) / asoma, 0.0, 1.0);
    total += forma * vida * hilo * (1.0 - 0.5 * arriba);
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
    float masa = smoothstep(0.34, 0.86, base) * (0.45 + 0.75 * fino) * hueco;

    // ───────────────────────────────────────────────────────────────
    // LA MANO AL POLVO (25/9). Es el rango 1: el fondo que ve TODO EL
    // MUNDO los primeros diez días, y el único cuerpo que no había pasado
    // por la misma revisión que el sol, la galaxia y el agujero negro.
    //
    // QUÉ ESTABA MAL, y es la misma crítica que se le hizo a los brazos de
    // la galaxia: la densidad era un smoothstep sobre la turbulencia, o
    // sea una joroba —clara en el medio, apagándose hacia afuera—. Una
    // joroba no tiene forma. Sumadas en aditivo, muchas jorobas tampoco: dan
    // un manchón que tiende al blanco.
    //
    // 1. VETAS EN VEZ DE MANCHAS. "1 - |2f-1|" vale 1 justo donde el ruido
    //    cruza la mitad y cae a los dos lados: dibuja la CURVA DE NIVEL del
    //    ruido como un filo fino en vez de rellenar su interior. Elevarlo
    //    afina el filo. Es el mismo truco del borde encendido, aplicado a
    //    algo que no es una esfera.
    float veta = 1.0 - abs(fbm(vec3(p * 2.3 + w.xy * 0.9, uTime * 0.018)) * 2.0 - 1.0);
    veta = pow(clamp(veta, 0.0, 1.0), 3.2);

    // 2. CALLES DE POLVO: franjas frías que TAPAN el gas de atrás. En una
    //    nebulosa de verdad la mitad del dibujo no la hace lo que brilla,
    //    la hace lo que se interpone. Y acá además arregla el apilado: el
    //    aditivo solo suma, así que sin algo que reste todo termina blanco.
    float calle = smoothstep(0.42, 0.74, fbm(vec3(p * 2.9 + vec2(-7.0, 3.0), uTime * 0.01)));
    float densidad = (masa * 0.5 + veta * masa * 1.6) * (1.0 - calle * 0.72);

    // 3. UN ADENTRO Y UN AFUERA. El color dependía solo del ruido, así que
    //    la nube no tenía centro: el cálido aparecía en cualquier parte. El
    //    gas ionizado está cerca de la estrella que lo enciende, y nada más
    //    ahí llega al naranja de la paleta.
    float nucleo = smoothstep(0.66, 0.04, length(p * vec2(1.0, 1.15)));

    // el color viaja del violeta profundo al azul y toca un cálido donde
    // el gas está más denso, como en una nebulosa de verdad
    vec3 c = mix(uPaleta0, uPaleta1, smoothstep(0.2, 0.7, base));
    c = mix(c, uPaleta2, smoothstep(0.5, 0.95, fino));
    c = mix(c, uPaleta3, pow(densidad, 2.0) * nucleo * 0.9);

    float bordes = smoothstep(1.15, 0.35, length(p * vec2(0.85, 1.0)));
    float inten = densidad * bordes * (0.72 + 0.95 * nucleo);

    // ───────────────────────────────────────────────────────────────
    // EL DÍA UNO (26/9). Es la primera pantalla de toda la app y estaba casi
    // vacía: gas tenue, centro negro, sin nada que diga "acá empieza algo".
    // Se le suman dos cosas al gas, sin tocar su color base (queda constante).
    //
    // 1. LA ESTRELLA NACIENTE. Un protostar en el centro: NO una linterna —un
    //    disco plano de luz—, sino un corazón chico y compacto con un halo
    //    amplio que respira y no es un círculo perfecto, más unos rayos apenas
    //    marcados. Va DETRÁS del polvo (este quad es el fondo), así que las
    //    partículas lo velan y se lee metido en el gas, no pegado encima.
    // p en pantalla llega a ~0.667 (el quad va escalado 1.5), así que los
    // gaussianos van MUY apretados o el brillo se come media pantalla —fue el
    // primer error, una linterna—. Es un protostar cálido, no un sol blanco.
    float rc = length(p * vec2(1.0, 1.12));
    float corazon = exp(-rc * rc * 430.0);   // el punto: compacto
    float glow = exp(-rc * rc * 90.0);       // un bloom chico y contenido
    float ang = atan(p.y, p.x);
    float pelusa = 0.60 + 0.40 * fbm(vec3(cos(ang) * 2.0, sin(ang) * 2.0, uTime * 0.05));
    float halo = exp(-rc * 12.0) * pelusa * 0.35;  // resplandor tenue y ACOTADO
    float rayos = pow(max(0.0, cos(ang * 3.0 + uTime * 0.06)), 12.0) * exp(-rc * 13.0) * 0.25;
    vec3 cCalido = mix(uPaleta3, vec3(1.0, 0.72, 0.45), 0.35);       // ámbar
    vec3 cEstrella = mix(cCalido, vec3(1.0, 0.92, 0.78), corazon * 0.6);
    float brilloEstrella = corazon * 0.95 + glow * 0.55 + halo + rayos;

    // 2. CORTINAS DE AURORA. Velos que fluyen hacia arriba, tenues y de color
    //    fijo (teal hacia violeta), por encima del gas. Bandas suaves en x
    //    deformadas por ruido que sube con el tiempo (movimiento), apagadas
    //    contra los dos bordes. Nada de esto rota el tono: solo se mueve la
    //    forma.
    float cx = p.x * 2.3 + fbm(vec3(p.x * 1.4, p.y * 0.6 - uTime * 0.05, 3.0)) * 2.4;
    float cortina = pow(max(0.0, sin(cx)), 3.0);
    cortina *= smoothstep(-1.05, -0.15, p.y) * smoothstep(1.05, 0.05, p.y);
    cortina *= 0.45 + 0.55 * fbm(vec3(p.x * 3.0, p.y * 2.0 - uTime * 0.09, 7.0));
    vec3 cAurora = mix(uPaleta1, vec3(0.38, 0.92, 0.72), 0.55);

    vec3 finalCol = c * inten * 1.35 + cEstrella * brilloEstrella + cAurora * cortina * 0.75;
    float finalA = clamp(inten * 0.85 + brilloEstrella * 0.9 + cortina * 0.5, 0.0, 1.0);
    gl_FragColor = vec4(finalCol * uAtenua, finalA * uAtenua);
    return;
  }

  // ================= AURORA (modo 4) =================
  // EL GAS DEL DISCO DE LA GALAXIA. p es el PLANO DEL DISCO: el quad va
  // inclinado y gira con las estrellas (ver escena.ts), asi que aca no hay ni
  // achatado ni tiempo en la espiral.
  //
  // Es la luz de las estrellas que no se resuelven: un disco que se apaga hacia
  // afuera, mas cargado sobre los dos brazos mayores y cortado por hebras de
  // polvo. Las estrellas van encima y ponen el detalle; esto pone el cuerpo.
  // Sin esto la galaxia es una nube de puntos; con esto solo, humo.
  if (uModo > 3.5) {
    float r = length(p) + 1e-5;
    float disco = exp(-r * 2.4) * (1.0 - smoothstep(0.60, 0.97, r));
    // Fuera del disco no se paga el ruido: es casi todo el quad.
    if (disco < 0.003) { gl_FragColor = vec4(0.0); return; }
    // La misma ley que crearGalaxia: la cresta va en angulo = 2.0 * ln(r).
    // A lo largo de un brazo la fase no cambia y el radio si: por eso el ruido
    // se indexa por (fase, radio) y no por la posicion.
    float fase = atan(p.y, p.x) - 2.0 * log(r);
    float grande = fbm(vec3(cos(fase) * 1.5, sin(fase) * 1.5, r * 3.2));
    // HILOS: mucha frecuencia a traves del brazo y poca a lo largo, con algo de
    // la posicion mezclado para que no queden peinados. Salen
    // hebras que acompanan la espiral, en vez de manchas.
    float hilos = fbm(vec3(cos(fase) * 4.0 + p.x * 2.6, sin(fase) * 4.0 + p.y * 2.6, r * 3.4 + grande * 1.8));
    float torcido = fase + (grande - 0.5) * 1.1;
    // EL BORDE DEL BRAZO LO ROMPEN LOS HILOS. Un coseno solo da una banda de
    // borde parejo, y una banda pareja es humo: lo que ya se rechazo una vez.
    float onda = 0.5 + 0.5 * cos(2.0 * torcido);
    // cerca del centro no hay brazos: es el bulbo, parejo
    float brazo = mix(0.75, smoothstep(0.22, 0.98, onda + (hilos - 0.5) * 0.7), smoothstep(0.07, 0.26, r));
    // POLVO: la curva de nivel de los hilos, afinada. Son las vetas oscuras que
    // corren por dentro de los brazos de una espiral.
    float polvo = pow(1.0 - abs(hilos * 2.0 - 1.0), 6.0);
    float nudo = smoothstep(0.58, 0.80, grande) * brazo;

    float luz = disco * (0.18 + 1.5 * brazo * (0.22 + 1.25 * smoothstep(0.30, 0.70, grande)) + 1.2 * nudo);
    luz *= (0.60 + 0.8 * hilos) * (1.0 - 0.6 * polvo * smoothstep(0.06, 0.2, r));

    // Las cuatro paradas son los cuatro colores de la espiral, no una rampa:
    // bulbo calido, lila del disco, azul de los brazos, rosa del gas ionizado.
    float afuera = smoothstep(0.10, 0.55, r);
    vec3 c = mix(uPaleta0, uPaleta1, smoothstep(0.03, 0.24, r));
    c = mix(c, uPaleta2, afuera * (0.30 + 0.60 * brazo));
    c = mix(c, uPaleta3, nudo * afuera * 0.7);

    gl_FragColor = vec4(c * uAtenua, clamp(luz * 0.8, 0.0, 1.0) * uAtenua);
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
    //
    // TALLADA, NO AMASADA (16/11). El contorno salia de un ruido suave, y un
    // ruido suave da bultos redondos: una papa. Como el cuerpo se ve casi
    // todo en sombra, la silueta ES el asteroide, y tiene que decir "piedra"
    // sola. Ahora es un poligono irregular —nueve caras planas a distancias
    // distintas, mas largo en una diagonal que en la otra— con las esquinas
    // apenas gastadas (el minimo suave) y el borde mellado por el ruido fino.
    float ang = atan(p.y, p.x);
    float suma = 0.0;
    for (int i = 0; i < 9 + uCero; i++) {
      float fi = float(i);
      float a = (fi + 0.15 + 0.70 * hash1(fi, 11.0)) * (6.2831853 / 9.0);
      float lejos = R * (0.74 + 0.22 * hash1(fi + 30.0, 13.0)) * (1.0 + 0.10 * cos(2.0 * (a - 0.6)));
      float c = cos(ang - a);
      if (c > 0.08) suma += exp(-42.0 * lejos / c);
    }
    float g2 = ruido(vec3(cos(ang) * 7.0, sin(ang) * 7.0, uSemilla + 3.0));
    rEff = (-log(max(suma, 1e-30)) / 42.0) * (0.975 + 0.05 * g2);
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
    vec3 nLisa = n; // la de antes del relieve: ver la luz de la roca

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

    // EL SOL NO USA turbulento (28/9). Su rama de abajo (MODO 1) pinta la
    // superficie con su propia granulacion y SOBREESCRIBE superficie, asi que
    // t y warp no los lee nadie en el Sol: calcular turbulento --tres fbm,
    // 15 octavas por pixel adentro del disco-- era trabajo tirado. Se saltea para
    // el Sol. Sin cambio visual: el resultado no se usaba.
    vec3 warp = vec3(0.0);
    float t = 0.0;
    if (!(uModo > 0.5 && uModo < 1.5)) {
      t = turbulento(sc * 2.0, uTurbulencia, warp);
    }

    // Bandas: seno de la latitud modulado por el ruido deformado
    float banda = 0.0;
    if (uBandas > 0.5) {
      banda = sin(lat * uBandas + warp.x * uTurbulencia * 2.2) * 0.5 + 0.5;
      // las bandas no son simétricas: unas más anchas que otras
      banda = mix(banda, smoothstep(0.35, 0.65, banda), 0.5);
      t = mix(t, banda, uContraste);
    }

    // Tormenta: mancha elíptica en coordenadas de superficie,
    // rota con el planeta y desaparece por el borde. El remolino lo da la t; el
    // COLOR rojo se lo pone más abajo, sobre la superficie ya pintada.
    float manchaTormenta = 0.0;
    if (uTormenta > 0.0) {
      vec2 dt = vec2(mod(lon - uTormentaPos.x + PI, 2.0 * PI) - PI, (lat - uTormentaPos.y) * 2.4);
      // el óvalo gira sobre sí mismo, como el ojo de Júpiter
      float a2 = uTime * 0.05;
      dt = vec2(dt.x * cos(a2) - dt.y * sin(a2), dt.x * sin(a2) + dt.y * cos(a2));
      // MÁS GRANDE (11, no 20): a la cara nocturna un óvalo chico se le pierde.
      float dist2 = dot(dt * vec2(1.0, 1.7), dt * vec2(1.0, 1.7)) * 11.0;
      manchaTormenta = exp(-dist2) * uTormenta;
      // un poco de estructura al remolino, sin llevarlo al crema de la paleta
      t += manchaTormenta * (0.2 + 0.35 * fbm(sc * 6.0 + warp));
    }

    vec3 superficie = paleta(t);

    // LA MANCHA ROJA (Júpiter): un óvalo rojo óxido sobre las bandas. Las bandas
    // no tienen rojo —van del marrón al crema—, así que el rojo es lo que la
    // separa de todo lo demás. Va SATURADO: aunque la cara nocturna lo apague,
    // un rojo saturado se sigue leyendo rojo (el mismo principio que la luz nueva).
    if (manchaTormenta > 0.0) {
      vec3 rojoOjo = mix(vec3(0.88, 0.20, 0.08), vec3(1.0, 0.52, 0.24), 0.3 + 0.4 * fbm(sc * 5.0 + warp));
      // un anillo un poco más claro alrededor del ojo, como en la foto
      float halo = smoothstep(0.10, 0.35, manchaTormenta);
      superficie = mix(superficie, rojoOjo, clamp(manchaTormenta * 1.4, 0.0, 0.92) * (0.6 + 0.4 * halo));
    }

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
      float piedra = alturaRoca(sc);
      superficie = paleta(clamp(piedra * 1.15, 0.0, 1.0));
      superficie *= 0.75 + 0.5 * ridged(sc * 20.0); // grano mineral

      // BUMP: LA LUZ TALLA EL RELIEVE. Hasta acá el ridged solo teñía el
      // color y la normal seguía siendo la de una esfera lisa: la piedra se
      // leía como una mancha con manchas, sin volumen. Ahora muestreo la
      // altura en dos puntos vecinos, saco la pendiente en los dos tangentes
      // de la esfera (este y norte) e inclino la normal contra ella. La luz
      // fija de arriba-izquierda pega distinto en cada cara y aparecen las
      // sombras propias de las crestas: recién ahí se lee rocoso.
      float e = 0.06;
      float h0 = piedra;
      float hLon = alturaRoca(vec3(cos(lon + e) * 1.6, sin(lon + e) * 1.6, lat * 2.2));
      float hLat = alturaRoca(vec3(cos(lon) * 1.6, sin(lon) * 1.6, (lat + e) * 2.2));
      vec3 tanE = vec3(cos(lon), 0.0, -sin(lon));                          // hacia el este
      vec3 tanN = vec3(-sin(lat) * sin(lon), cos(lat), -sin(lat) * cos(lon)); // hacia el norte
      n = normalize(n - 1.4 * ((hLon - h0) * tanE + (hLat - h0) * tanN));
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
      // color, sin superficie. La foto de referencia hace lo contrario, y es
      // lo que ya hacen los planetas: una esfera AMBAR OSCURA con la superficie
      // a la vista y el contorno encendido, del que salen las protuberancias.
      //
      // EL FILO VA EN TODA LA VUELTA y no de un lado. Una estrella no tiene
      // cara nocturna: se enciende sola. Ademas es real — el borde del Sol
      // brilla mas que el centro en H-alfa, que es como esta sacada la foto.
      //
      // LA SUPERFICIE ES UNA TEMPERATURA, NO UN COLOR (16/11). La cara era la
      // paleta multiplicada por 0,3: un naranja oscurecido, y un naranja
      // oscurecido es MARRON. Por eso se leia como un planeta de barro y no
      // como una estrella. Ahora cada punto tiene una temperatura y el color
      // sale de una rampa de brasa: lo frio es rojo profundo —no marron— y lo
      // caliente sube por el naranja al ambar de la paleta. Oscuro, pero
      // encendido.
      //
      // EL RUIDO VA SOBRE LA ESFERA, NO SOBRE EL CILINDRO. Las coordenadas
      // cilindricas de los planetas se aprietan en los polos, y con una
      // textura tan marcada como esta ahi salia un remolino de rayas.
      vec3 es = vec3(cos(lat) * cos(lon), cos(lat) * sin(lon), sin(lat));
      float lento = fbm(es * 5.2 + vec3(uTime * 0.03, 0.0, 9.0));
      float hervor = fbm(es * 21.0 - vec3(uTime * 0.15));
      // LA RED: crestas finas de plasma caliente con celdas mas frias adentro.
      // El fbm solo daba manchas blandas; las crestas son lo que dice "hierve".
      // Los otros dos ruidos la tuercen: sin eso se le ve la grilla.
      float red = ridged(es * 9.5 + vec3(lento * 2.4, hervor * 1.5 + uTime * 0.05, -lento * 1.8 - uTime * 0.04));

      // LA GRANULACION FINA NO PUEDE AMONTONARSE EN EL BORDE (item 4, 28/9).
      // Es el escorzo de la esfera: hacia el limbo la textura se comprime y el
      // hervor rapido se lee como un parpadeo en el contorno. Se lo atenua
      // donde la cara se aleja de la camara.
      float mirando = smoothstep(0.0, 0.45, n.z);

      // MANCHAS SOLARES: pocas y chicas. Son lo que dice "esto tiene
      // superficie". Grandes y seguidas dejaban el sol sucio.
      float mancha = smoothstep(0.74, 0.86, lento);

      float temp = 0.24 + 0.60 * pow(red, 2.0) + 0.34 * (lento - 0.5) + 0.22 * (hervor - 0.5) * mirando;
      temp *= 1.0 - 0.8 * mancha;
      // hacia el borde se mira mas plasma de costado: sube
      temp += 0.5 * pow(1.0 - n.z, 2.6);

      // LO MAS CALIENTE ES AMBAR, NO AMARILLO PALIDO. La app pone siempre un
      // velo oscuro encima del fondo, y un amarillo claro oscurecido es OLIVA:
      // el aro verdoso que tenia el Sol. Un ambar oscurecido sigue siendo ambar.
      vec3 vivo = vec3(1.0, 0.66, 0.16);
      vec3 cara = mix(vec3(0.28, 0.045, 0.0), vec3(0.88, 0.31, 0.03), smoothstep(0.0, 0.45, temp));
      cara = mix(cara, vec3(0.96, 0.47, 0.05), smoothstep(0.42, 0.85, temp));
      cara = mix(cara, vivo, smoothstep(0.85, 1.25, temp));
      cara *= 0.50 + 0.55 * temp;

      // EL DISCO DEL SOL SE DESVANECE, NO CORTA (item 2a). Un planeta SI tiene
      // limbo nitido; una estrella no termina en un circulo, se deshilacha.
      float discoSol = 1.0 - smoothstep(rEff - 0.014, rEff + 0.004, d);
      col = mix(col, cara, discoSol);
      alfa = max(alfa, discoSol);

      // EL FILO, COMO UN RESPLANDOR CONTINUO A TRAVES DEL BORDE (item 2a/4). Es
      // funcion de la DISTANCIA AL BORDE, no del mask, asi que cruza rEff sin
      // escalon: sube hacia el filo y cae a los dos lados.
      float filo = exp(-abs(d - rEff) * 26.0);
      col += mix(vec3(1.0, 0.46, 0.10), vivo, filo * 0.7) * filo * 1.15;
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

        // LA ROCA: UNA LUZ RASANTE, DESDE ATRAS (16/11). El filo de los
        // planetas sale de la normal, y la de la roca ya viene torcida por el
        // relieve: el filo se rompia en manchas naranjas sueltas sobre negro,
        // y se leia como brasas —lava—, no como piedra. Ahora son dos cosas.
        // Una luz que viene de atras y de arriba a la izquierda, que solo toca
        // las caras que miran hacia ella: una medialuna de roca oxido, mate,
        // con las crestas tirando sombra. Y el filo, que sale de la normal
        // LISA, asi que recorre el contorno entero sin cortarse.
        if (uModo > 2.5) {
          //
          // Y EL COLOR DE LO ILUMINADO VA ACLARADO (la raiz). Los colores de
          // la paleta llegan lineales y se muestran tal cual: el oxido salia
          // rojo oscuro, otra vez lava. Con la raiz vuelve a ser el naranja
          // oxido de la paleta, y de paso se achica el contraste entre las
          // vetas, que es lo que hace mate a una piedra.
          //
          // DE HORIZONTE, LA LUZ VIENE MAS DE ATRAS. En el telefono la roca no
          // va entera: es un horizonte que cruza la pantalla, y su lado de noche
          // es el velo sobre el que se lee (nucleo/horizonte.ts). La medialuna,
          // que entera es un tercio del cuerpo, ahi era un tercio de la
          // pantalla encendido debajo del texto. Con la luz casi a contraluz
          // queda pegada al borde, como el filo de la luna y los planetas.
          vec3 luzRoca = normalize(mix(vec3(-0.52, 0.57, -0.58), vec3(-0.30, 0.33, -0.90), uHorizonte));
          float rasante = smoothstep(-0.12, 0.55, dot(n, luzRoca));
          vec2 dirL = normalize(nLisa.xy + vec2(1e-5));
          float canto = pow(1.0 - nLisa.z, 5.0) * pow(max(dot(dirL, L2), 0.0), 1.4);
          lit = superficie * uNoche + sqrt(max(superficie, vec3(0.0))) * rasante * 1.1
              + sqrt(paleta(0.92)) * canto * (0.5 + 1.0 * rasante);
        }
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
    // Con la cara apagada, la luz del Sol sale de aca: el rango 5 es "Jupiter
    // se enciende", y tiene que ser lo mas brillante de la pantalla.
    //
    // DOS CAIDAS, que es lo que hace un resplandor de verdad: una corta y
    // fuerte pegada al borde, y una cola larga y tenue. Con una sola, o no se
    // ve o es una niebla pareja. La cola muere antes del filo del quad.
    float dx = max(d - rEff, 0.0);
    float angC = atan(p.y, p.x);
    // la corona no es pareja: tiene zonas mas cargadas, que derivan despacio
    float pluma = 0.62 + 0.76 * ruido(vec3(cos(angC) * 2.2, sin(angC) * 2.2, uTime * 0.04 + 5.0));
    float halo = (exp(-dx * 15.0) * 0.50 + exp(-dx * 3.6) * 0.17 * pluma) * fuera * smoothstep(1.0, 0.72, d);
    col += mix(vec3(1.0, 0.40, 0.07), vec3(1.0, 0.62, 0.18), exp(-dx * 9.0)) * halo;

    // ESPICULAS: el borde de una estrella no es una linea, es pasto de plasma.
    // Un pelo fino y desparejo todo alrededor, que es donde nacen los arcos.
    float pelo = ruido(vec3(cos(angC) * 46.0, sin(angC) * 46.0, uTime * 0.22));
    float espicula = exp(-dx * (42.0 + 70.0 * pelo)) * fuera;
    col += vec3(1.0, 0.54, 0.14) * espicula * 0.75;

    float pr = protuberancias(p, d);
    // Del color del borde, no blancas: el plasma de un arco es el mismo de la
    // superficie. Solo lo mas denso llega al claro de la paleta.
    col += mix(vec3(1.0, 0.38, 0.07), vec3(1.0, 0.66, 0.16), clamp(pr * 0.75, 0.0, 1.0)) * pr * 1.25;

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

    // EL DISCO ARRANCA PEGADO AL HORIZONTE (16/11). Arrancaba en 1,04 R y a
    // los costados quedaba una cuna oscura entre el circulo y el gas: un ojo a
    // cada lado. Y muere ANTES del filo del quad (2,17 R): llegando a 2,30 se
    // cortaba en seco.
    float banda = smoothstep(R * 1.00, R * 1.09, rr) * (1.0 - smoothstep(R * 1.65, R * 2.15, rr));

    // EL GRANO SIGUE LA ESPIRAL Y NO EL RADIO (23/9). Indexado por el radio el
    // gas salia en ANILLOS CONCENTRICOS: bandas duras, que es justo lo que no
    // queremos en ningun cuerpo del motor. Al correr el angulo con el radio,
    // las vetas se estiran en filamentos que caen hacia adentro.
    //
    // Y EL DISCO GIRA ENTERO, A UNA SOLA VELOCIDAD (16/11). Giraba mas rapido
    // adentro que afuera, que es lo fisico, pero el tiempo no para de crecer:
    // a los pocos minutos las vetas se enroscaban tanto que volvian a ser
    // anillos, cada vez mas finos. Antes no se notaba porque el disco estaba
    // quemado en blanco. Girando rigido, la espiral es la misma siempre.
    float giro = angD - 2.4 * (rr / R) + uTime * 0.28;
    float grueso = fbm(vec3(cos(giro) * 2.0, sin(giro) * 2.0, rr * 1.4));
    // una segunda pasada mas fina y mas rapida: el gas de adentro hierve.
    // (El multiplo del angulo es ENTERO: con 2,7 habia una costura a la izquierda.)
    float giroFino = (giro + uTime * 0.17) * 3.0;
    float fino = fbm(vec3(cos(giroFino) * 3.0, sin(giroFino) * 3.0, rr * 5.0));
    // CONTRASTE DE VERDAD ENTRE FILAMENTO Y HUECO. El ruido vive entre 0,3 y
    // 0,7; estirado a medias, todo el disco quedaba arriba y se leia como un
    // plato blanco. Ahora el umbral lo abre entero.
    float franjas = smoothstep(0.22, 0.78, grueso + 0.17 * (fino - 0.5));

    // doppler: el lado que viene hacia nosotros encandila
    float doppler = 0.42 + 0.88 * smoothstep(0.7, -0.7, p.x);

    // TEMPERATURA: el gas pegado al horizonte esta mucho mas caliente que el
    // del borde de afuera, y eso se ve como color, no como brillo.
    float temp = 1.0 - smoothstep(R * 1.02, R * 2.0, rr);
    // EL BORDE DE AFUERA SE ENFRIA HACIA EL VIOLETA (16/11): es el toque que
    // encadena este rango con la galaxia del anterior (spec, seccion 7), y
    // estaba en la paleta pero no llegaba a verse. Apagado, un rescoldo: a
    // pleno es un cartel de neon.
    vec3 frio = mix(uPaleta1 * 0.95, uPaleta2 * 0.32, 0.42);
    // El naranja del disco: el de la paleta sale rojo en pantalla (los colores
    // llegan lineales y se muestran tal cual), asi que se lo lleva hacia el
    // ambar hasta que se VE naranja.
    vec3 naranja = mix(uPaleta2, uPaleta3, 0.42);
    // Dorado y no crema: debajo del velo de la app, lo palido se vuelve caqui.
    vec3 calor = vec3(1.0, 0.60, 0.14);
    vec3 gasCol = mix(frio, naranja, smoothstep(0.06, 0.50, temp));
    gasCol = mix(gasCol, calor, pow(temp, 2.4));
    gasCol *= doppler * (0.50 + 0.78 * franjas);
    // Y EL BRILLO TAMBIEN CAE HACIA AFUERA. Con el brillo parejo de punta a
    // punta el disco se leia como los anillos de Saturno: un plato. Gas que
    // cae a un pozo brilla donde esta por caer.
    float dens = banda * (0.30 + 0.86 * franjas) * (0.50 + 1.15 * pow(temp, 1.3));

    // La mitad de abajo del anillo es la que viene hacia la cámara; la de
    // arriba es la que se aleja. El borde suave evita una costura en y=0.
    float cercano = smoothstep(0.03, -0.03, p.y);

    // (1) mitad lejana: solo se ve fuera del horizonte
    col += gasCol * dens * (1.0 - cercano) * fuera * 3.4;

    // (2) LENTE GRAVITACIONAL: la luz del disco que pasa DETRÁS se curva y
    // reaparece rodeando al horizonte, formando un arco arriba y otro abajo.
    //
    // ES UNA IMAGEN, NO UN RESPLANDOR (16/11). Era una campana ancha centrada
    // lejos del horizonte: una aureola de eclipse. La imagen de un disco tiene
    // borde: nace pegada al anillo de fotones, con el filo de adentro nitido,
    // y se apaga hacia afuera. Es mas gruesa arriba y abajo y se afina hacia
    // los costados, donde se funde con el disco directo; y el arco de abajo,
    // que es una imagen mas debil, va mas fino y mas apagado.
    vec2 dirp = normalize(p + vec2(1e-5));
    float vertical = pow(abs(dirp.y), 1.2);
    float deArriba = smoothstep(-0.12, 0.12, p.y);
    float anchoL = R * (0.05 + 0.17 * vertical) * mix(0.70, 1.0, deArriba);
    float dl = max(d - R * 1.03, 0.0);
    float aro = smoothstep(R * 1.012, R * 1.04, d) * exp(-pow(dl / anchoL, 2.4));
    // las vetas corren a lo largo del arco: mucha frecuencia en el radio
    float angL = atan(p.y, p.x) + uTime * 0.10;
    float texL = 0.15 + 1.5 * fbm(vec3(cos(angL) * 1.6, sin(angL) * 1.6, d * 30.0));
    float lente = aro * (0.30 + 0.80 * vertical) * mix(0.60, 1.0, deArriba) * (0.55 + 0.45 * doppler) * texL * fuera;
    col += mix(mix(uPaleta2, naranja, 0.55), calor, exp(-dl / (R * 0.06))) * lente * 3.6;
    // EL RESPLANDOR. Sin postprocesado no hay bloom, y sin algo que haga de
    // bloom la luz queda recortada como papel. Dos velos anchos y tenues: uno
    // naranja pegado a los arcos y al disco, y por fuera uno violeta, el mismo
    // toque del borde del disco.
    col += naranja * exp(-pow(dl / (anchoL * 2.0), 1.2)) * (0.30 + 0.55 * vertical) * mix(0.6, 1.0, deArriba) * fuera * 0.32;
    float rrG = length(vec2(p.x, p.y / 0.50));
    col += naranja * doppler * exp(-pow((rrG - R * 1.35) / (R * 0.50), 2.0)) * fuera * 0.20;
    col += uPaleta1 * exp(-pow(dl / (anchoL * 2.4), 1.3)) * (0.25 + 0.5 * vertical) * fuera * 0.22;

    // (4) mitad cercana: NO se recorta. Cruza por delante del círculo negro
    // y lo tapa abajo — sin esto el agujero se ve plano.
    col += gasCol * dens * cercano * 3.7;

    // (5) anillo de fotones, pegado al horizonte: una linea, no una franja
    float foton = exp(-abs(d - R * 1.012) * 150.0);
    col += vec3(1.0, 0.70, 0.26) * foton * 2.2 * fuera;

  } else if (uModo < 0.5 && dentro < 1.0) {
    // Luz de atmósfera SOLO en el canto iluminado.
    // Rodear el planeta entero es físicamente imposible y se nota.
    vec2 dirBorde = normalize(p + vec2(1e-5));
    float ladoLuz = max(dot(vec3(dirBorde, 0.0), L), 0.0);
    float halo = exp(-(d - rEff) * 24.0) * fuera * ladoLuz;
    col += paleta(0.95) * halo * 0.8;
    alfa = max(alfa, halo * 0.7);

  }
  // (La roca no lleva resplandor al frente: iba del lado OSCURO, y un halo del
  // lado oscuro se lee como atmosfera, que una piedra no tiene.)

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

  // LA LUZ DEL SOL Y DEL AGUJERO NEGRO (16/11). Dos arreglos, y los dos son de
  // cuentas, no de gusto.
  //
  // 1. SE COMPRIME EN VEZ DE CORTARSE. Las capas se suman, y sumadas pasan de
  //    1. Recortado canal por canal, el rojo se queda en 1 mientras el verde
  //    sigue subiendo: el naranja se vuelve amarillo, y un amarillo debajo del
  //    velo oscuro que la app pone siempre encima es OLIVA. Ademas el recorte
  //    plancha lo que hay adentro —filamentos, temperatura, doppler— en un
  //    blanco parejo. Aca se comprime el brillo guardando el tono: hasta 0,7
  //    no se toca nada; de ahi para arriba la curva se acuesta y nunca pasa
  //    de 1.
  //
  // 2. NO SE MULTIPLICA DOS VECES POR EL ALFA. col ya viene pesado por cuanto
  //    cubre —cada capa se suma o se mezcla con su propia cobertura—, y la
  //    mezcla del material lo volvia a multiplicar por alfa. Donde el alfa no
  //    llegaba a 1 —justo los bordes y los resplandores, que es donde esta la
  //    luz— el color salia apagado y sucio: el aro oscuro del Sol y el gris
  //    del disco de acrecion. Se deshace: el alfa cubre por lo menos lo que
  //    brilla, y el color se divide por el, asi que a la pantalla llega col
  //    tal cual. (Dentro del horizonte no hace falta: ahi el alfa es 1.)
  if (uModo > 0.5 && uModo < 2.5) {
    float pico = max(col.r, max(col.g, col.b));
    float sobra = max(pico - 0.7, 0.0);
    col *= (min(pico, 0.7) + sobra / (1.0 + 3.3 * sobra)) / max(pico, 1e-4);
    if (!enHorizonte) {
      alfa = clamp(max(alfa, max(col.r, max(col.g, col.b))), 0.0, 1.0);
      col /= max(alfa, 1e-4);
    }
  }

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
