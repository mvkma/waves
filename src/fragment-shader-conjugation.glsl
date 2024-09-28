#define PI 3.1415926538

precision highp float;

uniform highp sampler2D u_input;
uniform vec2 u_modes;

varying vec4 v_xy;

vec2 phase;
vec2 res;
vec2 hp;
vec2 hm;
vec2 ix_kp;
vec2 ix_km;

vec2 mul_complex(vec2 a, vec2 b) {
  return vec2(a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]);
}

vec2 conjugate(vec2 a) {
  return vec2(a[0], -a[1]);
}

float random(vec2 v) {
  return fract(sin(dot(v.xy, vec2(12.9898,78.233))) * 43758.5453123) * 0.5 + 0.5;
}

void main() {
  ix_kp = gl_FragCoord.xy - 0.5;
  ix_km = mod(u_modes - ix_kp, u_modes);
  ix_kp /= u_modes;
  ix_km /= u_modes;

  hp = texture2D(u_input, ix_kp).xy / 2.0;
  hm = texture2D(u_input, ix_km).xy / 2.0;

  // Initialize with random phases
  phase = vec2(cos(2.0 * PI * random(ix_kp)), sin(2.0 * PI * random(ix_kp)));
  res = mul_complex(hp, phase) + mul_complex(conjugate(hm), conjugate(phase));

  gl_FragColor = vec4(res, 1, 1);
}
