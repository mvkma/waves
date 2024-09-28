#define PI 3.1415926538
#define G 9.81

precision highp float;

uniform highp sampler2D u_input;
uniform vec2 u_modes;
uniform vec2 u_scales;
uniform float u_chopping;
uniform float u_t;

varying vec4 v_xy;

float omegat;
vec2 phase;
vec2 res;
vec2 dis;
vec2 hp;
vec2 hm;
vec2 ix_kp;
vec2 ix_km;
vec2 k;

vec2 mul_complex(vec2 a, vec2 b) {
  return vec2(a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]);
}

vec2 conjugate(vec2 a) {
  return vec2(a[0], -a[1]);
}

void main() {
  // 0, 1, ..., N / 2 - 1, -N / 2, -N / 2 + 1, ..., -1
  k.x = gl_FragCoord.x < 0.5 * u_modes.x ? gl_FragCoord.x - 0.5 : gl_FragCoord.x - 0.5 - u_modes.x;
  k.y = gl_FragCoord.y < 0.5 * u_modes.y ? gl_FragCoord.y - 0.5 : gl_FragCoord.y - 0.5 - u_modes.y;
  k *= PI * 2.0 / u_scales;

  omegat = sqrt(G * length(k)) * u_t;
  phase = vec2(cos(omegat), sin(omegat));

  ix_kp = gl_FragCoord.xy - 0.5;
  ix_km = mod(u_modes - ix_kp, u_modes);
  ix_kp /= u_modes;
  ix_km /= u_modes;

  hp = texture2D(u_input, ix_kp).xy / 2.0;
  hm = texture2D(u_input, ix_km).xy / 2.0;

  if (k.x == 0.0 && k.y == 0.0) {
    res = vec2(0.0, 0.0);
    dis = vec2(0.0, 0.0);
  } else {
    res = mul_complex(hp, phase) + mul_complex(conjugate(hm), conjugate(phase));
    dis = mul_complex(normalize(k).x * res, vec2(0, -1)) + normalize(k).y * res;
  }

  gl_FragColor = vec4(res, u_chopping * dis);
}
