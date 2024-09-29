#define PI 3.1415926538

precision highp float;

uniform highp sampler2D u_normals;

uniform float u_n1;
uniform float u_n2;
uniform float u_diffuse;
uniform vec3 u_lightdir;
uniform vec3 u_camerapos;
uniform vec3 u_skycolor;
uniform vec3 u_watercolor;
uniform vec3 u_aircolor;

varying vec2 v_mappos;
varying vec3 v_vertexpos;

float costh;
float refl0;
float refl;
float dist;
vec3 color;
vec3 normal;

void main() {
  normal = texture2D(u_normals, v_mappos).xyz;

  // Schlick's approximation
  costh = dot(normalize(u_lightdir), -normal);
  refl0 = pow((u_n1 - u_n2) / (u_n1 + u_n2), 2.0);
  refl = refl0 + (1.0 - refl0) * pow(1.0 - costh, 5.0);

  dist = exp(-u_diffuse * length(v_vertexpos - u_camerapos));

  color = mix(u_aircolor, mix(u_watercolor, u_skycolor, refl), dist);

  gl_FragColor = vec4(color, 1.0);
}
