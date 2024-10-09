#define PI 3.1415926538
#define G 9.81

precision highp float;

uniform vec2 u_modes;
uniform vec2 u_scales;
uniform vec2 u_omega;
uniform vec2 u_seed;
uniform float u_cutoff;
uniform float u_amp;

varying vec4 v_xy; // [-1, 1]

// more or less uniform on [0, 1]
float random(vec2 v) {
  return fract(sin(dot(v.xy, vec2(12.9898,78.233))) * 43758.5453123) * 0.5 + 0.5;
}

float gaussian(vec2 xy) {
  float u = 1.0 - random(xy);
  if (u == 0.0) {
    u = 0.33; // very random
  }
  float v = random(xy);

  return sqrt(-2.0 * log(u)) * cos(2.0 * PI * v);
}

float phillips(vec2 k, vec2 omega, float omegaMag, float cutoff) {
  float kMag = k.x * k.x + k.y * k.y;
  if (kMag > 0.0) {
    return exp(-pow(G, 2.0) / kMag / pow(omegaMag, 2.0) / 2.0) / kMag * abs(dot(normalize(k), normalize(omega))) / pow(2.0, 0.25) * exp(-pow(cutoff, 2.0) * kMag / 2.0);
  } else {
    return 0.0;
  }
}

float re;
float im;
float pp;

vec2 k;
vec2 omega;

/*
 * ||-------------------------------------------------------------------||--------------------------------------------------------------------------||
 * || (0, 0)          | (1, 0)          | ... | (N / 2 - 1, 0)          || (-N / 2, 0)          | (-N / 2 + 1, 0)          | ... | (-1, 0)          ||
 * || (0, 1)          | (1, 1)          | ... | (N / 2 - 1, 1)          || (-N / 2, 1)          | (-N / 2 + 1, 1)          | ... | (-1, 1)          ||
 * ||  ...            |  ...            | ... |      ...                ||     ...              |       ...                | ... |   ...            ||
 * || (0, N / 2 - 1)  | (1, N / 2 - 1)  | ... | (N / 2 - 1, N / 2 - 1)  || (-N / 2, N / 2 - 1)  | (-N / 2 + 1, N / 2 - 1)  | ... | (-1, N / 2 - 1)  ||
 * ||-------------------------------------------------------------------||--------------------------------------------------------------------------||
 * || (0, -N / 2)     | (1, -N / 2)     | ... | (N / 2 - 1, -N / 2)     || (-N / 2, -N / 2)     | (-N / 2 + 1, -N / 2)     | ... | (-1, -N / 2)     ||
 * || (0, -N / 2 + 1) | (1, -N / 2 + 1) | ... | (N / 2 - 1, -N / 2 + 1) || (-N / 2, -N / 2 + 1) | (-N / 2 + 1, -N / 2 + 1) | ... | (-1, -N / 2 + 1) ||
 * ||  ...            |  ...            | ... |      ...                ||     ...              |       ...                | ... |   ...            ||
 * || (0, -1)         | (1, -1)         | ... | (N / 2 - 1, -1)         || (-N / 2, -1)         | (-N / 2 + 1, -1)         | ... | (-1, -1)         ||
 * ||-------------------------------------------------------------------||--------------------------------------------------------------------------||
 */

void main() {
  // 0, 1, ..., N / 2 - 1, -N / 2, -N / 2 + 1, ..., -1
  k.x = gl_FragCoord.x < 0.5 * u_modes.x ? gl_FragCoord.x - 0.5 : gl_FragCoord.x - 0.5 - u_modes.x;
  k.y = gl_FragCoord.y < 0.5 * u_modes.y ? gl_FragCoord.y - 0.5 : gl_FragCoord.y - 0.5 - u_modes.y;
  k *= PI * 2.0 / u_scales;

  pp = phillips(k, u_omega, u_omega.x * u_omega.x + u_omega.y * u_omega.y, u_cutoff);

  re = pp * u_amp * gaussian(v_xy.xy - u_seed);
  im = pp * u_amp * gaussian(v_xy.xy + u_seed);

  gl_FragColor = vec4(re, im, 0, 0);
}
