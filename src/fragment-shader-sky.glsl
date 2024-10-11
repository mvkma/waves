#define PI 3.1415926538

precision highp float;

uniform vec3 u_skycolor;
// uniform mat4 u_projection;
// uniform mat4 u_view;

varying vec4 v_xy;

vec4 t;
vec3 color;

void main() {
  color = mix(1.5 * u_skycolor, u_skycolor, v_xy.y * 0.5 + 0.5);

  gl_FragColor = vec4(color, 1.0);
}
