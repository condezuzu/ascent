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
void main() {
  vColor = color;
  vBrillo = brillo;
  vec3 p = position;
  // deriva lenta: el gas nunca está del todo quieto
  p.x += sin(uTime * 0.08 + position.y * 5.0) * 0.012;
  p.y += cos(uTime * 0.06 + position.x * 4.0) * 0.010;
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
uniform float uModo;        // 0 planeta / 1 sol / 2 agujero negro / 3 roca
uniform float uCrateres;    // cráteres de verdad, con borde y sombra
uniform float uCasquetes;   // casquetes polares
uniform float uContinentes; // tierra firme sobre océano
uniform float uPuntos;      // depósitos brillantes (Ceres)
uniform float uMares;       // mares oscuros grandes (la Luna)
uniform float uManchas;     // zonas de hielo claro y oscuro (Plutón)
uniform float uRayos;       // rayos claros de cráteres jóvenes (la Luna)
uniform float uReposo;      // día de descanso: cara nocturna y giro frenado
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
  for (int i = 0; i < 5; i++) {
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

vec3 paleta(float t) {
  t = clamp(t, 0.0, 1.0);
  if (t < 0.3333) return mix(uPaleta0, uPaleta1, t * 3.0);
  if (t < 0.6666) return mix(uPaleta1, uPaleta2, (t - 0.3333) * 3.0);
  return mix(uPaleta2, uPaleta3, (t - 0.6666) * 3.0);
}

// =====================================================================
// CRÁTERES. Un radio constante ES un círculo: por eso quedaban geométricos.
// Acá el radio depende del ángulo (borde comido, en dos escalas), la
// profundidad varía muchísimo de uno a otro — muchos apenas se insinúan —,
// cada uno tiene su propia agudeza de borde, y un campo de erosión borra
// zonas enteras. Las capas van desfasadas para que se pisen entre sí.
// x = hundimiento del piso, y = realce del borde con su luz (-1..1)
// =====================================================================
vec2 crateres(vec2 uv, float escala, float sem, vec2 luz2) {
  vec2 g = uv * escala + vec2(sem * 3.7, sem * 1.9); // capas desalineadas
  vec2 celda = floor(g);
  vec2 f = fract(g);
  float piso = 0.0;
  float borde = 0.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 o = vec2(float(x), float(y));
      vec2 c = celda + o;
      float hSel = hash2f(c + 31.0, sem);
      if (hSel < 0.30) continue; // no toda celda tiene cráter
      float hProf = hash2f(c + 53.0, sem);
      float hAgu = hash2f(c + 71.0, sem);
      vec2 centro = o + vec2(hash2f(c, sem), hash2f(c + 17.0, sem)) * 0.8 + 0.1;
      vec2 rel = f - centro;
      float dist = length(rel) + 1e-5;
      if (dist > 1.05) continue;

      // radio irregular: el contorno se come en dos frecuencias
      vec2 dir = rel / dist;
      float rug1 = ruido(vec3(dir * 2.3, hSel * 40.0));
      float rug2 = ruido(vec3(dir * 6.5, hSel * 13.0));
      float r = (0.14 + hSel * 0.44) * (0.70 + 0.40 * rug1 + 0.16 * rug2);
      float t = dist / r;
      if (t > 1.25) continue;

      // profundidad muy dispar: la mayoría quedan apenas marcados
      float prof = pow(hProf, 2.4) * 1.5 + 0.06;
      // piso irregular, no un plato liso
      float fondo = (1.0 - smoothstep(0.30, 0.95, t));
      fondo *= 0.75 + 0.5 * ruido(vec3(rel * 9.0, hSel * 5.0));
      piso += fondo * prof;

      // borde: cada uno con su agudeza, y algunos casi sin labio
      float agu = 3.0 + hAgu * 8.0;
      float aro = exp(-pow((t - 0.88 - hAgu * 0.06) * agu, 2.0));
      float lado = dot(dir, luz2);
      borde += aro * lado * prof * (0.5 + hAgu);
    }
  }
  // erosión: hay regiones enteras casi lisas y otras muy castigadas
  float ero = 0.35 + 0.9 * fbm(vec3(uv * 1.7, sem * 11.0));
  return vec2(clamp(piso * ero, 0.0, 1.0), clamp(borde * ero, -1.2, 1.2));
}

// Ruido "ridged": crestas afiladas en vez de ondas suaves. Es lo que hace
// que una roca se lea como piedra y no como líquido.
float ridged(vec3 p) {
  float v = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 5; i++) {
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
  for (int i = 0; i < 9; i++) {
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
    float brazo = pow(max(0.0, onda * 0.5 + 0.5), 2.2);

    // estrías siguiendo el brazo, no verticales
    float estria = 0.4 + 0.85 * fbm(vec3(fase * 2.4, r * 9.0, uTime * 0.07));

    // se apaga en el núcleo (ahí mandan las partículas) y hacia afuera
    float radial = smoothstep(0.06, 0.30, r) * smoothstep(1.25, 0.45, r);

    float inten = brazo * estria * radial * (0.35 + 0.8 * base);
    // el color corre del violeta interior al verde-azulado de los bordes
    col = mix(uPaleta2, uPaleta3, clamp(tt * 0.9 + base * 0.35, 0.0, 1.0)) * inten;
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
    // ROCA: contorno irregular fijo, que gira entero como cuerpo rígido.
    // El perfil no cambia de forma: solo rota.
    float ang = atan(p.y, p.x) + uTime * 0.11 * (1.0 - uReposo);
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
      float turb = fbm(vec3(p * 7.0 + marcha * uTime * 1.6, uTime * 0.5));
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
    float vel = uModo > 2.5 ? 0.09 : 0.02;
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
      vec2 uvc = vec2(lon * 0.55, lat * 1.1);
      vec2 c1 = crateres(uvc, 2.6, 1.0, L2);
      vec2 c2 = crateres(uvc, 5.5, 2.0, L2);
      vec2 c3 = crateres(uvc, 11.0, 3.0, L2);
      vec2 c4 = crateres(uvc, 22.0, 4.0, L2);
      float piso = min(1.0, c1.x + c2.x * 0.8 + c3.x * 0.55 + c4.x * 0.35);
      float aro = c1.y + c2.y * 0.8 + c3.y * 0.5 + c4.y * 0.3;
      superficie *= (1.0 - 0.40 * piso * uCrateres);
      superficie += vec3(0.26) * aro * uCrateres;
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
      // ---- SOL: granulación viva y limbo oscurecido ----
      float gran = fbm(sc * 5.0 + vec3(uTime * 0.09));
      float gran2 = fbm(sc * 13.0 - vec3(uTime * 0.15));
      superficie = paleta(0.45 + 0.55 * gran + 0.18 * gran2);
      // manchas solares
      float mancha = smoothstep(0.66, 0.78, fbm(sc * 3.0 + vec3(uTime * 0.03, 0.0, 9.0)));
      superficie *= (1.0 - 0.45 * mancha);
      float limbo = pow(n.z, 0.45);
      // brillo contenido: encandilaba y se comía el resto de la escena
      col = mix(col, superficie * (0.52 + 0.5 * limbo), dentro);
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
      if (uReposo > 0.5) {
        float rim = pow(1.0 - n.z, 4.0);
        vec2 dirB = normalize(n.xy + vec2(1e-5));
        float ladoLuz = max(dot(dirB, L2), 0.0);
        vec3 nocturno = superficie * 0.055;
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
    // ---- corona + protuberancias (ambas contenidas) ----
    float glow = exp(-(d - R) * 9.0) * fuera;
    col += paleta(0.9) * glow * 0.55;
    alfa = max(alfa, glow * 0.55);

    float pr = protuberancias(p, d);
    vec3 cPr = mix(paleta(0.85), vec3(1.0, 0.8, 0.5), 0.4);
    col += cPr * pr * 1.0;
    alfa = max(alfa, min(1.0, pr * 0.9));

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
    float franjas = 0.5 + 0.5 * fbm(vec3(cos(angD + uTime * velD * 0.5) * 2.0,
                                         sin(angD + uTime * velD * 0.5) * 2.0,
                                         rr * 9.0));
    franjas = pow(smoothstep(0.15, 0.9, franjas), 1.5);
    // doppler: el lado que viene hacia nosotros encandila
    float doppler = 0.30 + 1.0 * smoothstep(0.6, -0.6, p.x);
    vec3 gasCol = mix(uPaleta2, mix(uPaleta2, uPaleta3, 0.55), franjas) * doppler;
    float dens = banda * (0.35 + 0.85 * franjas);

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
