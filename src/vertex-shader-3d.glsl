#define PI 3.1415926538

precision highp float;

attribute vec2 a_mappos;
attribute vec3 a_vertexpos;

uniform highp sampler2D u_displacements;

uniform mat4 u_projection;
uniform mat4 u_view;
uniform vec2 u_scales;

varying vec2 v_mappos;
varying vec3 v_vertexpos;

vec4 dis;

vec4 get_displacement(vec2 pos) {
  return texture2D(u_displacements, pos).zwxy;
}

void main() {
  dis = get_displacement(a_mappos);

  v_mappos = a_mappos;
  v_vertexpos = vec3((a_vertexpos.xy + dis.xy) / u_scales * 2.0, 1.0 * dis.z);

  gl_Position = u_projection * u_view * vec4(v_vertexpos, 1.0);
}
