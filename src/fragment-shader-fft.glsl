#define PI 3.1415926538

precision highp float;

uniform highp sampler2D u_input;

uniform float u_size;       // 2**k
uniform float u_subsize;    // 2**i
uniform int u_horizontal;

varying vec4 v_xy; // [-1, 1]

float ratio;
float arg_twiddle;

float ix;      // [0, u_size]
float ix_even; // [0, u_size / 2]
float ix_odd;  // [u_size / 2, u_size]
float jx;      // [0, u_size]

vec4 even;
vec4 odd;
vec2 twiddle;
vec2 res;
vec2 dis;
vec2 offset;

vec2 mul_complex(vec2 a, vec2 b) {
  return vec2(a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]);
}

void main() {

  if (u_horizontal == 1) {
    ix = gl_FragCoord.x - 0.5;
    jx = gl_FragCoord.y - 0.5;
  } else {
    ix = gl_FragCoord.y - 0.5;
    jx = gl_FragCoord.x - 0.5;
  }

  ix_even = floor(ix / u_subsize) * (u_subsize / 2.0) + mod(ix, u_subsize / 2.0);
  ix_odd = ix_even + u_size / 2.0;

  arg_twiddle = -2.0 * PI * ix / u_subsize;
  twiddle = vec2(cos(arg_twiddle), sin(arg_twiddle));

  if (u_horizontal == 1) {
    even = texture2D(u_input, vec2(ix_even, jx) / u_size).rgba;
    odd  = texture2D(u_input, vec2(ix_odd , jx) / u_size).rgba;
  } else {
    even = texture2D(u_input, vec2(jx, ix_even) / u_size).rgba;
    odd  = texture2D(u_input, vec2(jx, ix_odd ) / u_size).rgba;
  }

  res = even.xy + mul_complex(twiddle, odd.xy);
  dis = even.zw + mul_complex(twiddle, odd.zw);

  gl_FragColor = vec4(res, dis);
}
