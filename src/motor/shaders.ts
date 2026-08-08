// Shaders del motor de cuerpos celestes.
// Nada de imágenes: todo se genera por código, un solo motor con parámetros.
// El cuerpo se raytracea sobre un quad: eso da control total del borde
// (cobertura parcial contra el fondo) y del anillo/atmósfera fuera del disco.

export const VERTEX = /* glsl */ `
varying vec2 vP;
void main() {
  vP = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
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
uniform float uModo;        // 0 planeta / 1 sol / 2 agujero negro / 3 roca irregular
uniform float uCrateres;    // manchas tipo cráter (Luna)
uniform float uSemilla;
uniform float uApagado;     // 1 = fondo apagado (pérdida de racha)
uniform float uPixel;       // tamaño de un píxel en unidades del quad

// Radio del cuerpo dentro del quad (coordenadas -1..1). Tiene que dejar
// lugar a lo que orbita alrededor: el anillo de Saturno llega a 2.02*R y el
// disco de acreción a 2.1*R — con R mayor a ~0.47 se recortan contra el
// borde del quad y se ve un corte cuadrado.
const float R = 0.46;

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

void main() {
  vec2 p = vP;
  float aa = uPixel * 1.5;
  vec3 col = vec3(0.0);
  float alfa = 0.0;

  // Luz fija arriba a la izquierda: el terminador sale del ángulo real
  // entre la normal y la luz, no de un degradado pegado.
  vec3 L = normalize(vec3(-0.55, 0.6, 0.58));

  // Silueta: los cuerpos rocosos (modo 3) tienen borde irregular
  float rEff = R;
  if (uModo > 2.5) {
    float ang = atan(p.y, p.x);
    rEff = R * (0.9 + 0.10 * ruido(vec3(cos(ang) * 2.4, sin(ang) * 2.4, uSemilla)));
  }

  float d = length(p);
  float dentro = 1.0 - smoothstep(rEff - aa, rEff + aa, d);

  // ================= ANILLO (Saturno) =================
  float zAnillo = -1.0;
  vec3 colAnillo = vec3(0.0);
  float alfaAnillo = 0.0;
  if (uAnillo > 0.5) {
    float tilt = 0.35; // inclinación
    float rr = length(vec2(p.x, p.y / tilt));
    zAnillo = -p.y / tilt * cos(asin(clamp(tilt, 0.0, 1.0)));
    float franjas = ruido(vec3(rr * 14.0, 0.0, uSemilla * 7.0));
    float dentroAnillo = smoothstep(R * 1.28, R * 1.34, rr) * (1.0 - smoothstep(R * 1.95, R * 2.02, rr));
    float gap = 1.0 - 0.8 * smoothstep(R * 1.62, R * 1.66, rr) * (1.0 - smoothstep(R * 1.72, R * 1.76, rr));
    alfaAnillo = dentroAnillo * gap * (0.35 + 0.4 * franjas);
    // sombra del planeta sobre el anillo (lado oscuro)
    float sombra = 1.0 - 0.75 * smoothstep(0.1, -0.2, dot(normalize(vec3(p, 0.001)), L)) * step(d, R * 1.5);
    colAnillo = paleta(0.75 + 0.2 * franjas) * (0.55 + 0.45 * sombra);
  }
  // anillo por detrás del planeta: se dibuja primero y el disco lo tapa
  if (alfaAnillo > 0.0 && (zAnillo < 0.0 || d > rEff)) {
    col = colAnillo;
    alfa = alfaAnillo;
  }

  // ================= CUERPO =================
  if (dentro > 0.0) {
    vec3 n = vec3(p / rEff, 0.0);
    n.z = sqrt(max(0.0, 1.0 - dot(n.xy, n.xy)));

    // Coordenadas cilíndricas (cos/sin del ángulo) para que el ruido
    // no tenga costura en longitud.
    float rot = uTime * 0.02;
    float lon = atan(n.x, n.z) + rot;
    float lat = asin(clamp(n.y, -1.0, 1.0));
    vec3 sc = vec3(cos(lon) * 1.6, sin(lon) * 1.6, lat * 2.2);

    vec3 warp;
    float t = turbulento(sc * 2.0, uTurbulencia, warp);

    // Bandas: seno de la latitud modulado por el ruido deformado
    float banda = 0.0;
    if (uBandas > 0.5) {
      banda = sin(lat * uBandas + warp.x * uTurbulencia * 2.2) * 0.5 + 0.5;
      t = mix(t, banda, uContraste);
    }

    // Cráteres (Luna): manchas oscuras con umbral
    if (uCrateres > 0.0) {
      float c1 = ruido(sc * 5.0 + vec3(3.3));
      t -= uCrateres * smoothstep(0.62, 0.75, c1) * 0.5;
      float c2 = ruido(sc * 11.0 + vec3(9.1));
      t -= uCrateres * smoothstep(0.68, 0.8, c2) * 0.3;
    }

    // Tormenta: mancha elíptica en coordenadas de superficie,
    // rota con el planeta y desaparece por el borde.
    if (uTormenta > 0.0) {
      vec2 dt = vec2(mod(lon - uTormentaPos.x + 3.14159, 6.28318) - 3.14159, (lat - uTormentaPos.y) * 2.4);
      float dist2 = dot(dt, dt) * 22.0;
      float mancha = exp(-dist2) * uTormenta;
      t += mancha * (0.6 + 0.5 * fbm(sc * 6.0 + warp));
    }

    vec3 superficie = paleta(t);

    if (uModo > 0.5 && uModo < 1.5) {
      // ---- SOL: blanco azulado, autoiluminado, granulación ----
      float gran = fbm(sc * 4.0 + vec3(uTime * 0.06));
      superficie = paleta(0.55 + 0.45 * gran);
      float limbo = pow(n.z, 0.55); // oscurecimiento de limbo
      col = mix(col, superficie * (0.65 + 0.6 * limbo), dentro);
      alfa = max(alfa, dentro);
    } else if (uModo > 1.5 && uModo < 2.5) {
      // ---- AGUJERO NEGRO: disco negro + anillo de fotones ----
      col = mix(col, vec3(0.0), dentro);
      alfa = max(alfa, dentro);
    } else {
      // ---- PLANETA / ROCA ----
      float dif = max(dot(n, L), 0.0);
      float term = smoothstep(0.0, 0.35, dif); // terminador
      vec3 lit = superficie * (0.06 + 0.94 * term * (0.55 + 0.45 * dif));

      // Neblina: segunda capa rotando a distinta velocidad que la superficie.
      // La rotación diferencial es lo que evita la calcomanía girando.
      float rot2 = uTime * 0.034;
      float lon2 = atan(n.x, n.z) + rot2;
      vec3 sc2 = vec3(cos(lon2) * 1.1, sin(lon2) * 1.1, lat * 1.5);
      float neb = fbm(sc2 * 2.4 + vec3(31.7));
      lit = mix(lit, paleta(0.92) * (0.1 + 0.9 * term), smoothstep(0.55, 0.9, neb) * 0.22);

      col = mix(col, lit, dentro);
      alfa = max(alfa, dentro);
    }
  }

  // ================= FUERA DEL DISCO =================
  float fuera = smoothstep(rEff - aa, rEff + aa, d);
  if (uModo > 0.5 && uModo < 1.5) {
    // corona del sol
    float glow = exp(-(d - R) * 4.5) * fuera;
    col += paleta(0.85) * glow * 0.9;
    alfa = max(alfa, glow * 0.9);
  } else if (uModo > 1.5 && uModo < 2.5) {
    // AGUJERO NEGRO. Tres cosas que ningún otro rango tiene:
    // lente gravitacional arriba, toque violeta, y el naranja puro
    // solo en la línea fina del disco de acreción.
    float foton = exp(-abs(d - R * 1.04) * 70.0);
    col += vec3(1.0, 0.75, 0.45) * foton * 1.3;
    alfa = max(alfa, foton);
    float rr = length(vec2(p.x, p.y / 0.30));
    float acre = smoothstep(R * 1.05, R * 1.2, rr) * (1.0 - smoothstep(R * 1.9, R * 2.1, rr));
    float doppler = 0.55 + 0.45 * smoothstep(0.5, -0.5, p.x); // más brillante de un lado
    float franjas = 0.5 + 0.5 * ruido(vec3(rr * 10.0, 0.5, 3.0 + uTime * 0.05));
    // el disco pasa por delante abajo y por detrás arriba
    float delante = step(0.0, -p.y) + step(rEff, d);
    vec3 acreCol = mix(uPaleta2, uPaleta3, franjas) * doppler;
    col = mix(col, acreCol, acre * min(delante, 1.0) * 0.85);
    alfa = max(alfa, acre * min(delante, 1.0) * 0.85);
    // Anillo de lente gravitacional ARRIBA: la luz del disco de atrás
    // doblándose por encima del horizonte, con el violeta que lo encadena
    // a la galaxia del rango anterior.
    float lente = exp(-abs(d - R * 1.24) * 42.0) * smoothstep(-0.05, 0.42, p.y);
    vec3 lenteCol = mix(uPaleta3, uPaleta1 * 2.2, 0.45);
    col += lenteCol * lente * 0.85;
    alfa = max(alfa, lente * 0.85);
  } else if (uModo < 0.5 && dentro < 1.0) {
    // Luz de atmósfera SOLO en el canto iluminado.
    // Rodear el planeta entero es físicamente imposible y se nota.
    vec2 dirBorde = normalize(p + vec2(1e-5));
    float ladoLuz = max(dot(vec3(dirBorde, 0.0), L), 0.0);
    float halo = exp(-(d - rEff) * 26.0) * fuera * ladoLuz;
    col += paleta(0.95) * halo * 0.55;
    alfa = max(alfa, halo * 0.55);
  }

  // anillo por delante del planeta
  if (uAnillo > 0.5 && alfaAnillo > 0.0 && zAnillo >= 0.0 && d <= rEff) {
    col = mix(col, colAnillo, alfaAnillo);
    alfa = max(alfa, alfaAnillo);
  }

  // Grano animado sutil: rompe el bandeado en los degradados oscuros
  float grano = hash3(ivec3(int(gl_FragCoord.x), int(gl_FragCoord.y), int(mod(uTime * 24.0, 100.0)))) - 0.5;
  col += grano * 0.02;

  // fondo apagado (pérdida de racha)
  col = mix(col, col * 0.35 + vec3(0.01, 0.012, 0.02), uApagado);

  gl_FragColor = vec4(col, alfa);
}
`;
