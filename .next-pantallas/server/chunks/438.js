"use strict";exports.id=438,exports.ids=[438],exports.modules={16438:(a,b,c)=>{c.d(b,{montarFondo:()=>F});var d=c(42101),e=c(81046),f=c(72023),g=c(20889);let h=`
varying vec2 vP;
void main() {
  vP = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`,i=`
precision highp float;
varying vec2 vP;
uniform float uTime;
uniform vec3 uColor;
uniform float uFuerza;

// ruido barat\xedsimo, solo para romper el bandeo
float ruidoP(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  float d = length(vP);
  // exponente alto sobre un smoothstep que muere adentro del quad: da una
  // ca\xedda sin contorno. Bajarlo hace aparecer un disco, que es justo lo que
  // no puede pasar.
  float campo = pow(1.0 - smoothstep(0.0, 1.0, clamp(d, 0.0, 1.0)), 2.6);
  // respiraci\xf3n de doce segundos: vivo, pero nunca llamando la atenci\xf3n.
  float respira = 0.82 + 0.18 * sin(uTime * 0.52);
  float a = campo * respira * uFuerza;
  // sin dither, un degradado tan tenue sale en anillos conc\xe9ntricos y el
  // anillo ES una forma.
  a += (ruidoP(gl_FragCoord.xy) - 0.5) * 0.004;
  if (a <= 0.0) discard;
  gl_FragColor = vec4(uColor, a);
}
`,j=`
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
  // deriva lenta: el gas nunca est\xe1 del todo quieto
  p.x += sin(uTime * 0.08 + position.y * 5.0) * 0.012;
  p.y += cos(uTime * 0.06 + position.x * 4.0) * 0.010;
  gl_PointSize = tamano * uDpr;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`,k=`
precision highp float;
varying vec3 vColor;
varying float vBrillo;
void main() {
  // distancia al centro del punto: 0 en el medio, 1 en el borde
  float d = length(gl_PointCoord - vec2(0.5)) * 2.0;
  if (d > 1.0) discard;
  // n\xfacleo compacto y halo que se apaga suave
  float nucleo = 1.0 - smoothstep(0.0, 0.45, d);
  float halo = 1.0 - smoothstep(0.15, 1.0, d);
  float a = clamp(nucleo * 0.85 + halo * 0.5, 0.0, 1.0) * vBrillo;
  if (a < 0.004) discard;
  gl_FragColor = vec4(vColor, a);
}
`,l=`
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
uniform float uTurbulencia; // intensidad de la deformaci\xf3n de dominio
uniform float uTormenta;    // 0 = sin tormenta
uniform vec2 uTormentaPos;  // posici\xf3n (lon, lat) de la tormenta
uniform float uAnillo;      // 0 = sin anillo (Saturno)
uniform float uAnilloVert;  // anillo casi vertical (Urano)
uniform float uModo;        // 0 planeta / 1 sol / 2 agujero negro / 3 roca
uniform float uCrateres;    // cr\xe1teres de verdad, con borde y sombra
uniform float uCasquetes;   // casquetes polares
uniform float uContinentes; // tierra firme sobre oc\xe9ano
uniform float uPuntos;      // dep\xf3sitos brillantes (Ceres)
uniform float uMares;       // mares oscuros grandes (la Luna)
uniform float uManchas;     // zonas de hielo claro y oscuro (Plut\xf3n)
uniform float uRayos;       // rayos claros de cr\xe1teres j\xf3venes (la Luna)
uniform float uReposo;      // d\xeda de descanso: cara nocturna y giro frenado
uniform float uAtenua;      // 1 normal; menos = fantasma de la mejor racha
uniform float uSemilla;
uniform float uApagado;     // 1 = fondo apagado (p\xe9rdida de racha)
uniform float uPixel;       // tama\xf1o de un p\xedxel en unidades del quad

const float R = 0.46; // radio del cuerpo; deja lugar al anillo (2.02*R)
const float PI = 3.14159265;

// ---- hash entero (no sin(): el cl\xe1sico fract(sin()) banda en m\xf3viles) ----
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

// ---- ruido de valor 3D con interpolaci\xf3n suave ----
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

// ---- deformaci\xf3n de dominio: dos campos desplazan a un tercero.
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
// CR\xc1TERES — segunda pasada (2026-09-15, "siguen quedando pobres").
//
// TRES COSAS LOS HAC\xcdAN VERSE COMO MANCHAS, y ninguna era el ruido:
//
// 1. ESTABAN ESTIRADOS AL DOBLE. Se calculaban sobre (lon \xd7 0.55, lat \xd7 1.1):
//    un c\xedrculo ah\xed es un \xf3valo dos veces m\xe1s ancho que alto sobre la esfera,
//    y m\xe1s ancho todav\xeda lejos del ecuador. Ahora las celdas van por FILAS DE
//    LATITUD, cada fila con tantas celdas como le entran a su circunferencia,
//    y la distancia se mide en la superficie: un cr\xe1ter es redondo en
//    cualquier latitud, y sin costura aunque el cuerpo gire para siempre.
//
// 2. NO TEN\xcdAN LUZ PROPIA. El piso se oscurec\xeda parejo, as\xed que un cr\xe1ter era
//    un c\xedrculo m\xe1s oscuro. Lo que hace que el ojo lea un pozo es que la pared
//    que da a la luz est\xe9 clara y la de enfrente en sombra. Ahora cada cr\xe1ter
//    es una altura —un taz\xf3n con labio— y lo que se devuelve es la PENDIENTE
//    contra la luz: la sombra y el brillo salen de la forma, no pintados.
//
// 3. EL BORDE SE PINTABA SUMANDO GRIS, y el gris lava el color del cuerpo.
//    Ahora la luz multiplica: el Ceres terroso sigue terroso.
//
// x = hundimiento (oclusi\xf3n suave del piso), y = sombreado por pendiente
// =====================================================================
vec2 crateres(float lon, float lat, float escala, float sem, vec2 luz2) {
  float piso = 0.0;
  float luz = 0.0;
  float gy = lat * escala + sem * 0.37;
  float fila = floor(gy);
  for (int y = -1; y <= 1; y++) {
    float fy = fila + float(y);
    // cu\xe1ntas celdas le entran a esta fila: su circunferencia en celdas
    float latFila = (fy + 0.5 - sem * 0.37) / escala;
    float nx = max(3.0, floor(6.2831853 * escala * max(cos(latFila), 0.05)));
    float gx = lon / 6.2831853 * nx + sem * 1.3;
    float colX = floor(gx);
    float anchoCelda = 6.2831853 / nx; // en radianes de longitud
    for (int x = -1; x <= 1; x++) {
      float cx = colX + float(x);
      vec2 id = vec2(mod(cx, nx), fy);
      float hSel = hash2f(id + 31.0, sem);
      if (hSel < 0.34) continue; // no toda celda tiene cr\xe1ter
      float hProf = hash2f(id + 53.0, sem);
      float hAgu = hash2f(id + 71.0, sem);
      // centro del cr\xe1ter, en la superficie
      float cLon = (cx + 0.15 + 0.7 * hash2f(id, sem) - sem * 1.3) * anchoCelda;
      float cLat = (fy + 0.15 + 0.7 * hash2f(id + 17.0, sem) - sem * 0.37) / escala;
      // desplazamiento en la superficie: la longitud se achica con la latitud
      vec2 rel = vec2((lon - cLon) * cos(lat), lat - cLat) * escala;
      float dist = length(rel) + 1e-5;
      if (dist > 0.75) continue;
      vec2 dir = rel / dist;

      // contorno apenas comido: redondo, pero no de comp\xe1s
      float rug = ruido(vec3(dir * 2.3, hSel * 40.0));
      float r = (0.14 + hSel * 0.32) * (0.86 + 0.24 * rug);
      float t = dist / r;
      if (t > 1.6) continue;

      // la mayor\xeda quedan apenas marcados; unos pocos, hondos
      float prof = pow(hProf, 2.2) * 1.2 + 0.08;
      // labio blando: uno filoso dibuja un anillo, y un anillo parece de comp\xe1s
      float agu = 3.0 + hAgu * 3.5;

      // ALTURA: taz\xf3n hasta el borde, y el labio levantado alrededor.
      //   taz\xf3n  h = prof \xb7 (t\xb2 − 1)        dh/dt = 2\xb7prof\xb7t
      //   labio  h = labio \xb7 e^(−((t−1)\xb7agu)\xb2)
      float adentro = 1.0 - smoothstep(0.92, 1.02, t);
      float dTazon = 2.0 * prof * t * adentro;
      float labio = prof * (0.18 + 0.30 * hAgu);
      float e = exp(-pow((t - 1.0) * agu, 2.0));
      float dLabio = -2.0 * agu * agu * (t - 1.0) * labio * e;
      float dhdt = dTazon + dLabio;

      // LUZ POR PENDIENTE: la normal se inclina contra la pendiente, as\xed que
      // la pared que mira a la luz es la del lado opuesto a ella.
      luz += -dot(dir, luz2) * dhdt;
      // piso: oclusi\xf3n suave, no un plato negro
      piso += prof * (1.0 - smoothstep(0.2, 0.95, t)) * (0.8 + 0.4 * ruido(vec3(rel * 7.0, hSel * 5.0)));
    }
  }
  // erosi\xf3n: hay regiones enteras casi lisas y otras muy castigadas
  float ero = 0.35 + 0.9 * fbm(vec3(lon * 0.9, lat * 1.7, sem * 11.0));
  return vec2(clamp(piso * ero, 0.0, 1.0), clamp(luz * ero * 0.5, -1.5, 1.5));
}

// Ruido "ridged": crestas afiladas en vez de ondas suaves. Es lo que hace
// que una roca se lea como piedra y no como l\xedquido.
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
// se estiran y se apagan. Cada una con su tama\xf1o, \xe1ngulo y tiempo, as\xed
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

    // el \xe1ngulo deriva apenas, como si el plasma rotara con la estrella
    float ang = sa * 6.2831 + uTime * 0.015 + sc * 0.4;
    vec2 dir = vec2(cos(ang), sin(ang));

    float alto = (0.020 + sb * 0.055) * vida; // apenas asoma del limbo
    float ancho = 0.011 + sc * 0.016;

    // el arco es un anillo cuyo centro est\xe1 apoyado sobre el limbo
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
  // El gas entre las part\xedculas: sin esto se leen como puntos sueltos y no
  // como una nube. Densidad despareja a prop\xf3sito, con zonas cargadas y
  // zonas casi vac\xedas, y color mezclado —azules, violetas y algo c\xe1lido—
  // en vez de un gris plano.
  if (uModo > 4.5) {
    vec3 w;
    float base = turbulento(vec3(p * 1.25, uTime * 0.022), 3.0, w);
    // segunda escala: los grumos finos dentro de las masas grandes
    float fino = fbm(vec3(p * 4.5 + w.xy * 0.6, uTime * 0.03));

    // huecos: el gas no llena parejo
    float hueco = smoothstep(0.30, 0.62, fbm(vec3(p * 1.8 + vec2(11.0), 0.5)));
    float densidad = smoothstep(0.34, 0.86, base) * (0.45 + 0.75 * fino) * hueco;

    // el color viaja del violeta profundo al azul y toca un c\xe1lido donde
    // el gas est\xe1 m\xe1s denso, como en una nebulosa de verdad
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
  // Usa la misma ley de espiral con la que se arman las part\xedculas y el
  // mismo achatado, as\xed que se lee como parte de la galaxia. El quad rota
  // con ella, de modo que tambi\xe9n gira en el plano del disco.
  if (uModo > 3.5) {
    vec2 q = vec2(p.x, p.y / 0.42);   // mismo achatado que las part\xedculas
    float r = length(q) + 1e-5;
    float th = atan(q.y, q.x);
    // fase de la espiral: brazo = th - (r/0.85)*5.0, igual que las part\xedculas
    float tt = clamp((r - 0.03) / 0.85, 0.0, 1.6);
    float fase = th - tt * 5.0;

    // turbulencia muestreada en coordenadas del disco: se enrosca con \xe9l
    vec3 w;
    float base = turbulento(vec3(cos(fase) * 1.4, sin(fase) * 1.4, r * 2.6 + uTime * 0.05), 2.6, w);

    // cuatro brazos: el gas se acumula sobre ellos y ondula a lo largo
    float onda = cos(fase * 4.0 + w.x * 2.6 + sin(r * 6.0 + uTime * 0.12) * 0.9);
    float brazo = pow(max(0.0, onda * 0.5 + 0.5), 2.2);

    // estr\xedas siguiendo el brazo, no verticales
    float estria = 0.4 + 0.85 * fbm(vec3(fase * 2.4, r * 9.0, uTime * 0.07));

    // se apaga en el n\xfacleo (ah\xed mandan las part\xedculas) y hacia afuera
    float radial = smoothstep(0.06, 0.30, r) * smoothstep(1.25, 0.45, r);

    float inten = brazo * estria * radial * (0.35 + 0.8 * base);
    // el color corre del violeta interior al verde-azulado de los bordes
    col = mix(uPaleta2, uPaleta3, clamp(tt * 0.9 + base * 0.35, 0.0, 1.0)) * inten;
    alfa = inten * 0.75;

    gl_FragColor = vec4(col * uAtenua, clamp(alfa, 0.0, 1.0) * uAtenua);
    return;
  }

  // Luz fija arriba a la izquierda: el terminador sale del \xe1ngulo real
  // entre la normal y la luz, no de un degradado pegado.
  vec3 L = normalize(vec3(-0.55, 0.6, 0.58));
  vec2 L2 = normalize(L.xy);

  // ---- silueta ----
  float rEff = R;
  if (uModo > 2.5) {
    // ROCA: contorno irregular fijo, que gira entero como cuerpo r\xedgido.
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
    // va detr\xe1s, en sentido contrario a la marcha: gas encendido que
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

    // Coordenadas cil\xedndricas (cos/sin del \xe1ngulo) para que el ruido
    // no tenga costura en longitud.
    // En reposo el giro se frena: el cuerpo queda quieto, entero.
    float vel = uModo > 2.5 ? 0.09 : 0.02;
    float rot = uTime * vel * (1.0 - uReposo);
    float lon = atan(n.x, n.z) + rot;
    float lat = asin(clamp(n.y, -1.0, 1.0));
    vec3 sc = vec3(cos(lon) * 1.6, sin(lon) * 1.6, lat * 2.2);
    // La roca NO se deforma: su superficie es fija y solo gira como cuerpo
    // r\xedgido. Cualquier ruido que dependa del tiempo ac\xe1 la vuelve l\xedquida.

    vec3 warp;
    float t = turbulento(sc * 2.0, uTurbulencia, warp);

    // Bandas: seno de la latitud modulado por el ruido deformado
    float banda = 0.0;
    if (uBandas > 0.5) {
      banda = sin(lat * uBandas + warp.x * uTurbulencia * 2.2) * 0.5 + 0.5;
      // las bandas no son sim\xe9tricas: unas m\xe1s anchas que otras
      banda = mix(banda, smoothstep(0.35, 0.65, banda), 0.5);
      t = mix(t, banda, uContraste);
    }

    // Tormenta: mancha el\xedptica en coordenadas de superficie,
    // rota con el planeta y desaparece por el borde.
    if (uTormenta > 0.0) {
      vec2 dt = vec2(mod(lon - uTormentaPos.x + PI, 2.0 * PI) - PI, (lat - uTormentaPos.y) * 2.4);
      // el \xf3valo gira sobre s\xed mismo, como el ojo de J\xfapiter
      float a2 = uTime * 0.05;
      dt = vec2(dt.x * cos(a2) - dt.y * sin(a2), dt.x * sin(a2) + dt.y * cos(a2));
      float dist2 = dot(dt * vec2(1.0, 1.7), dt * vec2(1.0, 1.7)) * 20.0;
      float mancha = exp(-dist2) * uTormenta;
      t += mancha * (0.6 + 0.5 * fbm(sc * 6.0 + warp));
    }

    vec3 superficie = paleta(t);

    // ---- CONTINENTES (Tierra): tierra firme con costa, sobre oc\xe9ano ----
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

    // ---- ROCA: superficie p\xe9trea, con crestas y facetas ----
    if (uModo > 2.5) {
      float cr = ridged(sc * 3.2);
      float cr2 = ridged(sc * 9.0 + vec3(7.0));
      float piedra = cr * 0.7 + cr2 * 0.3;
      // escalones: la piedra tiene caras planas, no degrad\xe9s continuos
      piedra = mix(piedra, floor(piedra * 7.0) / 7.0, 0.45);
      superficie = paleta(clamp(piedra * 1.15, 0.0, 1.0));
      superficie *= 0.75 + 0.5 * ridged(sc * 20.0); // grano mineral
    }

    // ---- CR\xc1TERES ----
    if (uCrateres > 0.0) {
      // Cuatro tama\xf1os, de pocos grandes a muchos chicos, y los chicos se
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

    // ---- MANCHAS DE HIELO (Plut\xf3n) ----
    // Zonas claras y oscuras muy contrastadas, con bordes difusos: la
    // llanura brillante de nitr\xf3geno contra las regiones oscuras rojizas.
    if (uManchas > 0.0) {
      vec3 wm;
      float campo = turbulento(sc * 1.05, 2.0, wm);
      // claro: enorme, de bordes suaves
      float claro = smoothstep(0.46, 0.68, campo);
      // oscuro: otra regi\xf3n, en otra frecuencia y desfasada
      float oscuro = smoothstep(0.58, 0.72, fbm(sc * 0.85 + vec3(19.0, 7.0, 3.0)));
      oscuro *= (1.0 - claro);
      vec3 hielo = vec3(0.94, 0.91, 0.84);
      vec3 mancha = vec3(0.20, 0.13, 0.10);
      superficie = mix(superficie, hielo, claro * uManchas);
      superficie = mix(superficie, mancha, oscuro * uManchas * 0.95);
      // vetas finas dentro del hielo, como las celdas de convecci\xf3n
      float veta = smoothstep(0.48, 0.52, fbm(sc * 7.0 + vec3(5.0)));
      superficie *= 1.0 - 0.10 * veta * claro * uManchas;
    }

    // ---- MARES oscuros (la Luna los tiene; los dem\xe1s no) ----
    if (uMares > 0.0) {
      float mar = smoothstep(0.54, 0.70, fbm(sc * 1.25 + vec3(4.4)));
      superficie *= (1.0 - 0.34 * mar * uMares);
    }

    // ---- RAYOS: las estr\xedas claras que dejan los cr\xe1teres j\xf3venes ----
    if (uRayos > 0.0) {
      float rr2 = fbm(sc * 2.2 + vec3(13.0));
      float estrias = pow(max(0.0, ruido(sc * 14.0 + vec3(31.0))), 3.0);
      float rayo = smoothstep(0.55, 0.80, rr2) * estrias;
      superficie += vec3(0.22, 0.23, 0.26) * rayo * uRayos;
    }

    // ---- DEP\xd3SITOS BRILLANTES (la marca de Ceres) ----
    if (uPuntos > 0.0) {
      float pt = smoothstep(0.74, 0.86, fbm(sc * 5.5 + vec3(21.0)));
      float pt2 = smoothstep(0.80, 0.92, fbm(sc * 12.0 + vec3(9.0)));
      superficie += vec3(0.85, 0.88, 0.95) * (pt * 0.9 + pt2 * 0.5) * uPuntos;
    }

    if (uModo > 0.5 && uModo < 1.5) {
      // ---- SOL: granulaci\xf3n viva y limbo oscurecido ----
      float gran = fbm(sc * 5.0 + vec3(uTime * 0.09));
      float gran2 = fbm(sc * 13.0 - vec3(uTime * 0.15));
      superficie = paleta(0.45 + 0.55 * gran + 0.18 * gran2);
      // manchas solares
      float mancha = smoothstep(0.66, 0.78, fbm(sc * 3.0 + vec3(uTime * 0.03, 0.0, 9.0)));
      superficie *= (1.0 - 0.45 * mancha);
      float limbo = pow(n.z, 0.45);
      // brillo contenido: encandilaba y se com\xeda el resto de la escena
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

      // D\xcdA DE DESCANSO: se lo ve desde su lado nocturno. La cara queda en
      // sombra y solo queda un filo de luz en el canto. El cuerpo sigue
      // entero: no se apaga ni se aten\xfaa, se lo mira de noche.
      if (uReposo > 0.5) {
        float rim = pow(1.0 - n.z, 4.0);
        vec2 dirB = normalize(n.xy + vec2(1e-5));
        float ladoLuz = max(dot(dirB, L2), 0.0);
        vec3 nocturno = superficie * 0.055;
        nocturno += paleta(0.92) * rim * pow(ladoLuz, 1.4) * 1.9;
        lit = nocturno;
      }

      // Neblina: segunda capa rotando a distinta velocidad que la superficie.
      // La rotaci\xf3n diferencial es lo que evita la calcoman\xeda girando.
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
    // Se compone por capas, de atr\xe1s hacia adelante, que es lo que da volumen:
    //   1. mitad LEJANA del disco  -> se recorta contra el horizonte
    //   2. arcos de lente          -> rodean el horizonte, arriba y abajo
    //   3. el horizonte negro ya qued\xf3 pintado en el bloque del cuerpo
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

    // La mitad de abajo del anillo es la que viene hacia la c\xe1mara; la de
    // arriba es la que se aleja. El borde suave evita una costura en y=0.
    float cercano = smoothstep(0.03, -0.03, p.y);

    // (1) mitad lejana: solo se ve fuera del horizonte
    col += gasCol * dens * (1.0 - cercano) * fuera * 1.8;
    alfa = max(alfa, min(1.0, dens * (1.0 - cercano) * fuera * 2.0));

    // (2) LENTE GRAVITACIONAL: la luz del disco que pasa DETR\xc1S se curva y
    // reaparece rodeando al horizonte, formando un arco arriba y otro abajo.
    // Es lo que cierra el aro naranja alrededor del c\xedrculo negro.
    float dl = abs(d - R * 1.13);
    float aro = exp(-pow(dl / (R * 0.14), 2.0));
    vec2 dirp = normalize(p + vec2(1e-5));
    // m\xe1s fuerte arriba y abajo, que es adonde no llega el disco directo
    float refuerzo = 0.30 + 1.15 * pow(abs(dirp.y), 1.4);
    float texL = 0.55 + 0.6 * fbm(vec3(cos(angD * 1.5 + uTime * 0.25) * 2.0,
                                       sin(angD * 1.5 + uTime * 0.25) * 2.0, 4.0));
    float lente = aro * refuerzo * doppler * texL * fuera;
    col += mix(uPaleta2, uPaleta3, 0.45) * lente * 1.6;
    alfa = max(alfa, min(1.0, lente * 1.6));

    // segundo arco, m\xe1s fino y pegado: la imagen de orden superior
    float aro2 = exp(-pow((d - R * 1.055) / (R * 0.045), 2.0));
    col += mix(uPaleta3, vec3(1.0, 0.82, 0.5), 0.4) * aro2 * refuerzo * doppler * 1.1 * fuera;
    alfa = max(alfa, aro2 * refuerzo * fuera);

    // (4) mitad cercana: NO se recorta. Cruza por delante del c\xedrculo negro
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
    // Luz de atm\xf3sfera SOLO en el canto iluminado.
    // Rodear el planeta entero es f\xedsicamente imposible y se nota.
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
  // ni el tinte de "apagado". Lo \xfanico que puede verse ah\xed es el gas que
  // pasa por delante, que ya se compuso arriba. Ojo: no se puede poner el
  // color en cero ac\xe1, porque eso borrar\xeda justamente ese gas.
  bool enHorizonte = (uModo > 1.5 && uModo < 2.5 && d < rEff);

  // Grano animado sutil: rompe el bandeado en los degradados oscuros.
  // En la roca va casi apagado: cualquier titileo sobre la piedra la hace
  // parecer agua.
  float grano = hash3(ivec3(int(gl_FragCoord.x), int(gl_FragCoord.y), int(mod(uTime * 24.0, 100.0)))) - 0.5;
  if (!enHorizonte) col += grano * (uModo > 2.5 ? 0.004 : 0.018);

  // fondo apagado (p\xe9rdida de racha)
  if (!enHorizonte) col = mix(col, col * 0.35 + vec3(0.01, 0.012, 0.02), uApagado);

  // el c\xedrculo del horizonte es opaco: tapa las estrellas de atr\xe1s
  if (enHorizonte) alfa = 1.0;

  col *= uAtenua;
  alfa *= uAtenua;
  gl_FragColor = vec4(col, clamp(alfa, 0.0, 1.0));
}
`;var m=c(21359),n=c(86854),o=c(25463),p=c(28581),q=c(96307);let r=new d.bdM(2,2);function s(a){return new d.Q1f(a)}function t(){return Math.min(window.devicePixelRatio||1,2)}let u={bajo:.3,medio:.6,alto:1};function v(a){return Math.max(24,Math.round(a*u[(0,g.S)()]))}let w=null,x=null,y=!1;function z(a,b,c,e=!1,f=1){return new d.BKk({vertexShader:h,fragmentShader:l,transparent:!0,depthWrite:!1,uniforms:{uTime:{value:0},uPaleta0:{value:s(a.paleta[0])},uPaleta1:{value:s(a.paleta[1])},uPaleta2:{value:s(a.paleta[2])},uPaleta3:{value:s(a.paleta[3])},uBandas:{value:a.bandas},uContraste:{value:a.contraste},uTurbulencia:{value:a.turbulencia},uTormenta:{value:a.tormenta},uTormentaPos:{value:new d.I9Y(...a.tormentaPos)},uAnillo:{value:+!!a.anillo},uAnilloVert:{value:+!!a.anilloVertical},uModo:{value:a.modo},uCrateres:{value:a.crateres},uCasquetes:{value:a.casquetes},uContinentes:{value:a.continentes},uPuntos:{value:a.puntos},uMares:{value:a.mares},uManchas:{value:a.manchas},uRayos:{value:a.rayos},uReposo:{value:+!!e},uAtenua:{value:f},uSemilla:{value:.37},uApagado:{value:+!!b},uPixel:{value:c}}})}let A={paleta:["#3c3f46","#5c6069","#949aa5","#d8dce4"],bandas:0,contraste:0,turbulencia:.7,tormenta:0,tormentaPos:[0,0],anillo:!1,anilloVertical:!1,crateres:1,casquetes:0,continentes:0,puntos:0,mares:.5,manchas:0,rayos:.4,lunas:0,modo:0},B=["#1b1235","#2c3d86","#7d5cc4","#e0946a"],C={paleta:B,bandas:0,contraste:0,turbulencia:1.4,tormenta:0,tormentaPos:[0,0],anillo:!1,anilloVertical:!1,crateres:0,casquetes:0,continentes:0,puntos:0,mares:0,manchas:0,rayos:0,lunas:0,modo:5},D={paleta:["#1a0f38","#4A2A8C","#7F4FD0","#8fe3d0"],bandas:0,contraste:0,turbulencia:1,tormenta:0,tormentaPos:[0,0],anillo:!1,anilloVertical:!1,crateres:0,casquetes:0,continentes:0,puntos:0,mares:0,manchas:0,rayos:0,lunas:0,modo:4};function E(){return new d.BKk({vertexShader:j,fragmentShader:k,uniforms:{uTime:{value:0},uDpr:{value:t()}},vertexColors:!0,transparent:!0,blending:d.EZo,depthWrite:!1})}function F(a,b){let c=function(){if(y)return null;if(w&&x)return{renderer:w,lienzo:x};try{let a=document.createElement("canvas");a.style.width="100%",a.style.height="100%",a.style.display="block";let b=new e.JeP({canvas:a,alpha:!0,antialias:"bajo"!==(0,g.S)(),powerPreference:"high-performance"});return w=b,x=a,{renderer:b,lienzo:a}}catch{return y=!0,null}}();if(!c)return null;let{renderer:j,lienzo:k}=c;a.appendChild(k);let l=new d.Z58,u=new d.qUd(-1,1,1,-1,.1,10);u.position.z=2;let F=[],G=[],H=null,I=null,J=null;(0,o.Hy)("ascent:particulas-inicio");let K=function(a,b,c){let e=Math.min(v(a),1400),f=new Float32Array(3*e),g=new Float32Array(3*e),h=new Float32Array(e),i=new Float32Array(e),j=(0,n.rV)(b,c),k=new d.Q1f(j.principal),l=new d.Q1f(j.claro);for(let a=0;a<e;a++){f[3*a]=(Math.random()-.5)*4,f[3*a+1]=(Math.random()-.5)*4,f[3*a+2]=-1-2*Math.random();let b=.3+.9*Math.pow(Math.random(),2),c=Math.random(),e=c<.55?new d.Q1f(.92,.95,1):c<.85?l.clone():k.clone();g[3*a]=e.r,g[3*a+1]=e.g,g[3*a+2]=e.b;let j=.04>Math.random();h[a]=j?3.4+2.2*Math.random():1+1.9*Math.pow(Math.random(),2.5),i[a]=b*(j?1.3:1)}let m=new d.LoY;return m.setAttribute("position",new d.THS(f,3)),m.setAttribute("color",new d.THS(g,3)),m.setAttribute("tamano",new d.THS(h,1)),m.setAttribute("brillo",new d.THS(i,1)),new d.ONl(m,E())}(m.Ml[b.rango]??150,b.rango,b.planeta);F.push(K.material),l.add(K);let L=4===b.rango&&b.planeta&&m.gg[b.planeta]?m.gg[b.planeta]:m.A$[b.rango],M=new d.YJl;if(l.add(M),b.presagio){let a=function(a,b){let c=(0,n.rV)(a,b);return new d.BKk({vertexShader:h,fragmentShader:i,uniforms:{uTime:{value:0},uColor:{value:s(c.claro)},uFuerza:{value:.5}},transparent:!0,blending:d.EZo,depthWrite:!1})}(b.rango,b.planeta);F.push(a);let c=new d.eaF(r,a);c.scale.setScalar(2),c.position.z=-.3,M.add(c)}else if(b.fantasma){let a=4===b.fantasma.rango&&b.fantasma.planeta&&m.gg[b.fantasma.planeta]?m.gg[b.fantasma.planeta]:m.A$[b.fantasma.rango];if(a){let b=z(a,!1,.004,!1,.16);F.push(b);let c=new d.eaF(r,b);c.scale.setScalar(1.95),c.position.z=-.2,M.add(c)}}if(b.vacio||1===b.rango){let a=z(C,!!b.apagado,.004);a.blending=d.EZo,F.push(a);let c=new d.eaF(r,a);c.scale.setScalar(1.5),c.position.z=-.1,M.add(c),J=function(a){let b=a?8:v(700),c=new Float32Array(3*b),e=new Float32Array(3*b),f=new Float32Array(b),g=new Float32Array(b),h=B.map(a=>new d.Q1f(a)),i=Array.from({length:5},()=>({x:(Math.random()-.5)*.8,y:(Math.random()-.5)*.6,r:.1+.2*Math.random()}));for(let j=0;j<b;j++){let b,k,l;if(!a&&.68>Math.random()){let a=i[Math.floor(Math.random()*i.length)],c=Math.random()*Math.PI*2,d=Math.pow(Math.random(),.7)*a.r;b=a.x+Math.cos(c)*d,k=a.y+Math.sin(c)*d*.8}else{let c=Math.random()*Math.PI*2,d=a?.42+.22*Math.random():.62*Math.pow(Math.random(),.5);b=Math.cos(c)*d,k=Math.sin(c)*d*.78}c[3*j]=b,c[3*j+1]=k,c[3*j+2]=0;let m=.06>Math.random();f[j]=m?4.5+4*Math.random():1.1+2.6*Math.pow(Math.random(),2.2),g[j]=m?.85+.5*Math.random():.18+.75*Math.pow(Math.random(),2);let n=Math.random();l=n<.42?h[1].clone().lerp(h[2],Math.random()):n<.74?h[2].clone().lerp(h[0],.6*Math.random()):n<.88?h[3].clone().lerp(h[2],.5*Math.random()):new d.Q1f("#eaf0ff").lerp(h[2],.35*Math.random()),e[3*j]=l.r,e[3*j+1]=l.g,e[3*j+2]=l.b}let j=new d.LoY;return j.setAttribute("position",new d.THS(c,3)),j.setAttribute("color",new d.THS(e,3)),j.setAttribute("tamano",new d.THS(f,1)),j.setAttribute("brillo",new d.THS(g,1)),new d.ONl(j,E())}(!!b.vacio),F.push(J.material),M.add(J),M.scale.setScalar(.95)}else if(7===b.rango){let a=z(D,!!b.apagado,.004);F.push(a);let c=new d.eaF(r,a);c.scale.setScalar(1.35),c.position.z=-.05,a.blending=d.EZo,M.add(c),I=c,H=function(a){let b=v(4200),c=new Float32Array(3*b),e=new Float32Array(3*b),f=new Float32Array(b),g=new Float32Array(b),h=(0,n.rV)(a,null),i=new d.Q1f("#fff3d0"),j=new d.Q1f(h.claro),k=new d.Q1f(h.principal),l=new d.Q1f(h.apagado);for(let a=0;a<b;a++){let b,d=Math.pow(Math.random(),2.2),h=.03+.85*d,m=(Math.random()-.5)*(.12+.75*d),n=Math.PI/2*(a%4)+5*d+m,o=(Math.random()-.5)*(.1-.06*d);c[3*a]=Math.cos(n)*h+(Math.random()-.5)*.03,c[3*a+1]=Math.sin(n)*h*.42+.4*o,c[3*a+2]=(Math.random()-.5)*.05,b=d<.12?i.clone():d<.4?i.clone().lerp(j,(d-.12)/.28):d<.75?j.clone().lerp(k,(d-.4)/.35):k.clone().lerp(l,(d-.75)/.25),e[3*a]=b.r,e[3*a+1]=b.g,e[3*a+2]=b.b;let p=.05>Math.random();f[a]=p?3+2*Math.random():1+1.8*Math.pow(Math.random(),2.2),g[a]=(.35+1.2*Math.pow(Math.random(),3))*(1.25-.5*d)}let m=new d.LoY;return m.setAttribute("position",new d.THS(c,3)),m.setAttribute("color",new d.THS(e,3)),m.setAttribute("tamano",new d.THS(f,1)),m.setAttribute("brillo",new d.THS(g,1)),new d.ONl(m,E())}(b.rango),F.push(H.material),M.add(H),M.scale.setScalar(1.5)}else if(L){let a=b.rango>=5?1.45:1.25,c=2/(a*Math.min(k.clientWidth||400,k.clientHeight||700)),e=z(L,!!b.apagado,c,!!b.reposo);F.push(e);let f=new d.eaF(r,e);f.scale.setScalar(a),M.add(f);for(let c=0;c<L.lunas;c++){let e=z(A,!!b.apagado,.02,!!b.reposo);F.push(e);let f=new d.eaF(r,e);f.scale.setScalar(a*(.16+.05*c)),f.position.z=.01,M.add(f),G.push({obj:f,r:a*(.78+.28*c),v:.3/(1+.5*c),f:2.1*c,ry:.3})}if(6===b.rango){f.scale.setScalar(.17*a);let c=["Mercurio","Venus","Tierra","Marte","J\xfapiter","Saturno","Neptuno"];for(let e=0;e<c.length;e++){let f=z(m.gg[c[e]],!!b.apagado,.008,!!b.reposo);F.push(f);let g=new d.eaF(r,f);g.scale.setScalar(a*(.045+.011*e)),M.add(g),G.push({obj:g,r:a*(.26+.155*e),v:.3/(1+.55*e),f:1.35*e,ry:.34})}}}(0,o.Hy)("ascent:particulas-fin"),(0,o.UU)("ascent:escena-armado","ascent:particulas-inicio","ascent:particulas-fin");let N=b.esquina??"abajo-derecha",O=!0,P=!1,Q=new d.zD7,R=100*Math.random();function S(){for(let a of G)a.obj.position.set(Math.cos(R*a.v+a.f)*a.r,Math.sin(R*a.v+a.f)*a.r*a.ry,0)}function T(){let b=a.clientWidth||window.innerWidth,c=a.clientHeight||window.innerHeight;j.setSize(b,c,!1),j.setPixelRatio(t());let d=b/c;u.left=-d,u.right=d,u.updateProjectionMatrix(),"abajo-derecha"===N?M.position.set(.8*d,-.72,0):"arriba-derecha"===N?M.position.set(.82*d,.72,0):M.position.set(0,0,0)}for(let a of(T(),F))a.uniforms.uTime.value=R;S(),(0,o.Hy)("ascent:shader-inicio"),j.render(l,u),(0,o.Hy)("ascent:shader-fin"),(0,o.UU)("ascent:shader-compilacion","ascent:shader-inicio","ascent:shader-fin"),!1!==b.animar&&requestAnimationFrame(function a(){if(O){if(!P){for(let a of(R+=Q.getDelta(),F))a.uniforms.uTime.value=R;S(),H&&(H.rotation.z=.022*R),I&&(I.rotation.z=.022*R),J&&(J.rotation.z=.03*R),j.render(l,u)}!1!==b.animar&&requestAnimationFrame(a)}});let U=q.S.ciclo.alCambiar(a=>{P=!a,a&&Q.getDelta()}),V=(0,f.u)(a,()=>T()),W=0;function X(a){return void 0===a.userData.atenuaBase&&(a.userData.atenuaBase=a.uniforms.uAtenua?.value??1),a.userData.atenuaBase}return{soltar:()=>{O=!1,U(),V(),l.traverse(a=>{a.geometry&&a.geometry!==r&&a.geometry.dispose(),a.material&&(Array.isArray(a.material)?a.material:[a.material]).forEach(a=>a.dispose())})},pulso:function(){if((0,o.Hy)("ascent:pulso"),!1===b.animar)return;let a=W;if(W=performance.now(),a)return;let c=a=>{if(!O)return;let b=a-W,d=(0,p._r)(b);for(let a of F)a.uniforms.uAtenua&&(a.uniforms.uAtenua.value=X(a)*(1+p.Gx*d));if((0,p.k1)(b))requestAnimationFrame(c);else{for(let a of F)a.uniforms.uAtenua&&(a.uniforms.uAtenua.value=X(a));W=0}};requestAnimationFrame(c)}}}},20889:(a,b,c)=>{c.d(b,{S:()=>d});function d(){return"medio"}},21359:(a,b,c)=>{c.d(b,{A$:()=>f,Ml:()=>g,gg:()=>e});let d={bandas:0,contraste:0,turbulencia:.8,tormenta:0,tormentaPos:[.8,-.3],anillo:!1,anilloVertical:!1,crateres:0,casquetes:0,continentes:0,puntos:0,mares:0,manchas:0,rayos:0,lunas:0,modo:0},e={Ceres:{...d,paleta:["#2a241e","#463b30","#6b5b4a","#8f7c66"],crateres:.85,puntos:.9,turbulencia:.9},Plutón:{...d,paleta:["#5a4436","#7d6450","#a08a6e","#c9b49a"],manchas:1,turbulencia:1.2},Mercurio:{...d,paleta:["#2e2b28","#4f4a45","#837b72","#b3aaa0"],crateres:1,turbulencia:.8},Marte:{...d,paleta:["#6e1f08","#a83812","#d9531e","#f0925c"],casquetes:.85,turbulencia:1.1},Venus:{...d,paleta:["#8a7040","#b89a5e","#dcc48c","#f5ecd2"],bandas:5,contraste:.3,turbulencia:2.2},Tierra:{...d,paleta:["#0b1e42","#12244e","#1e4a8e","#dbe7f5"],continentes:1,casquetes:.6,turbulencia:1.4,lunas:1},Neptuno:{...d,paleta:["#0e2258","#1c3f96","#3a68d0","#9db8f0"],bandas:7,contraste:.32,turbulencia:1.3,tormenta:.9,tormentaPos:[1.4,-.35],lunas:1},Urano:{...d,paleta:["#28536b","#3e7a96","#7ab4cc","#c9e6f0"],bandas:3,contraste:.16,turbulencia:.55,anillo:!0,anilloVertical:!0},Saturno:{...d,paleta:["#6e6248","#94845e","#c4b088","#ecdfc0"],bandas:10,contraste:.5,turbulencia:.9,anillo:!0},Júpiter:{...d,paleta:["#5a4432","#8a6a4a","#c0a078","#ecd8b8"],bandas:13,contraste:.62,turbulencia:1.6,tormenta:1,tormentaPos:[.9,-.4]}},f={1:null,2:{...d,paleta:["#241408","#5c2a10","#95491a","#c9762e"],modo:3,turbulencia:.5,crateres:.75},3:{...d,paleta:["#3c3f46","#5c6069","#949aa5","#d8dce4"],crateres:1,mares:1,rayos:.6,turbulencia:.7},4:e.Tierra,5:{...d,paleta:["#EF9F27","#F2C230","#FFF1C2","#ffffff"],modo:1,turbulencia:1.3},6:{...d,paleta:["#EF9F27","#F2C230","#FFF1C2","#ffffff"],modo:1,turbulencia:1.3},7:null,8:{...d,paleta:["#05050A","#4A2A8C","#FF6A00","#FFC46B"],modo:2}},g={1:120,2:190,3:280,4:400,5:540,6:700,7:900,8:1150}},72023:(a,b,c)=>{c.d(b,{u:()=>d});function d(a,b){window.addEventListener("resize",b);let c=null;return"undefined"!=typeof ResizeObserver&&(c=new ResizeObserver(()=>b())).observe(a),()=>{window.removeEventListener("resize",b),c?.disconnect()}}}};