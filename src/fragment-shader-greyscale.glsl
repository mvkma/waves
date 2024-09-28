#define PI 3.1415926538

precision highp float;

uniform highp sampler2D u_input;
uniform float u_scale;
uniform float u_offset;

uniform vec2 u_coordscale;
uniform vec2 u_modes;

uniform int u_type;

varying vec4 v_xy; // [-1, 1]

float h;
float phase;
vec4 value;
vec2 texcoord;

vec2 mul_complex(vec2 a, vec2 b) {
  return vec2(a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]);
}

void main() {
  texcoord = vec2(v_xy.xy / u_coordscale * 0.5 + 0.5);
  value = texture2D(u_input, vec2(v_xy.xy / u_coordscale * 0.5 + 0.5));

  phase = -PI * (floor(texcoord.x * u_modes.x) / u_modes.x + floor(texcoord.y * u_modes.y) / u_modes.y);
  // phase = 0.0;
  value = vec4(
               mul_complex(value.xy, vec2(cos(phase), sin(phase))),
               mul_complex(value.zw, vec2(cos(phase), sin(phase)))
               );

  if (u_type == 0) {
    h = value[0];
  } else if (u_type == 1) {
    h = value[1];
  } else if (u_type == 2) {
    h = value[2];
  } else if (u_type == 3) {
    h = value[3];
  } else if (u_type == 4) {
    h = sqrt(value[0] * value[0] + value[1] * value[1]);
  } else if (u_type == 5) {
    h = atan(value[1], value[0]) / PI;
  } else {
    h = 0.0;
  }

  h = h / u_scale + u_offset;

  gl_FragColor = vec4(h, h, h, 1);
}
