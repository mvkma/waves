#define PI 3.1415926538

precision highp float;

uniform highp sampler2D u_normals;
// uniform highp samplerCube u_cubemap;

uniform float u_n1;
uniform float u_n2;
uniform float u_diffuse;
uniform vec3 u_lightdir;
uniform vec3 u_camerapos;
uniform vec3 u_skycolor;
uniform vec3 u_suncolor;
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
vec3 skycolor;
vec3 view;

// Light contributions according to https://www.shadertoy.com/view/tdSfWG
// - Reflected sky color (according to Fresnel)
//
// - Specular reflection of the sun
//
// - Diffuse parts:
//   - some small reflection of sun color?
//   - some small reflection of sky color?
//
// - Ambient parts:
//   - Water color

void main() {
  normal = -texture2D(u_normals, v_mappos).xyz;
  view = v_vertexpos - u_camerapos;

  // Schlick's approximation
  costh = dot(normalize(view), normal);
  refl0 = pow((u_n1 - u_n2) / (u_n1 + u_n2), 2.0);
  refl = refl0 + (1.0 - refl0) * pow(1.0 - costh, 5.0);

  // skycolor = textureCube(u_cubemap, reflect(normalize(v_vertexpos - u_camerapos), -normal)).rgb;

  color = vec3(0.0);

  // Diffuse parts
  color += u_aircolor * (0.1 * max(dot(normal, vec3(0.0, 0.0, 1.0)), 0.0) * u_skycolor +
                         0.1 * max(dot(normal, normalize(u_lightdir)), 0.0) * u_suncolor);

  // Ambient parts
  color += 0.5 * 0.5 * u_watercolor;

  // Specular part (TODO)
  color += u_suncolor * u_suncolor * pow(max(dot(normal, normalize(normalize(u_lightdir) - normalize(view))), 0.0), 512.0);

  // Fresnel
  color = mix(color, 0.5 * u_skycolor, refl);

  color *= 0.25;

  color = pow(color, vec3(0.4545));

  gl_FragColor = vec4(color, 1.0);
}
