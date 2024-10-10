#define PI 3.1415926538

precision highp float;

uniform highp sampler2D u_input;

uniform vec2 u_modes;

vec4 value;
float h;

void main() {
  value = texture2D(u_input, (gl_FragCoord.xy - 0.5) / u_modes);

  h = length(value.z) * 0.5;

  gl_FragColor = vec4(h, h, h, 1.0);
}
