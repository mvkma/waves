#define PI 3.1415926538

precision highp float;

uniform highp sampler2D u_displacements;
uniform vec2 u_modes;

varying vec4 v_xy;

vec2 texcoord;
vec2 dx;
vec2 dy;
vec3 mid;
vec3 vr;
vec3 vl;
vec3 vb;
vec3 vt;

vec2 mul_complex(vec2 a, vec2 b) {
  return vec2(a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]);
}

vec3 get_displacement(vec2 pos) {
  return texture2D(u_displacements, pos).zwx;
}

void main() {
  texcoord = (v_xy.xy * 0.5 + 0.5);

  dx = vec2(1.0 / u_modes.x, 0.0);
  dy = vec2(0.0, 1.0 / u_modes.y);

  mid = get_displacement(texcoord);

  vr = get_displacement(texcoord + dx) - mid + vec3(dx, 0.0);
  vl = get_displacement(texcoord - dx) - mid - vec3(dx, 0.0);
  vb = get_displacement(texcoord + dy) - mid + vec3(dy, 0.0);
  vt = get_displacement(texcoord - dy) - mid - vec3(dy, 0.0);

  gl_FragColor = vec4(normalize(cross(vr, vt) + cross(vt, vl) + cross(vl, vb) + cross(vb, vr)), 1.0);
}
