const vertexShader = `
attribute vec4 a_position;

varying vec4 v_xy;

void main() {
  gl_Position = a_position;
  v_xy = a_position;
}
`;

const magntitudeShader = `
#define PI 3.1415926538

precision highp float;

uniform sampler2D u_input;

varying vec4 v_xy; // [-1, 1]

void main() {
    vec4 value = texture2D(u_input, vec2(v_xy * 0.5 + 0.5));
    float h = sqrt(value[0] * value[0] + value[1] * value[1]) / 1.0;
    h = 1.0 - h;
    gl_FragColor = vec4(h, h, h, 1);
}
`;

const argumentShader = `
#define PI 3.1415926538

precision highp float;

uniform sampler2D u_input;

varying vec4 v_xy; // [-1, 1]

void main() {
    vec4 value = texture2D(u_input, vec2(v_xy * 0.5 + 0.5));
    float h = atan(value[1], value[0]) / PI;
    gl_FragColor = vec4(h, h, h, 1);
}
`;

const fftShader = `
#define PI 3.1415926538

precision highp float;

uniform sampler2D u_input;

uniform float u_size;       // 2**k
uniform float u_subsize;    // 2**i
uniform int u_horizontal;

varying vec4 v_xy; // [-1, 1]

float ratio;
float arg_twiddle;

float ix;      // [0, u_size]
float ix_even; // [0, u_size / 2]
float ix_odd;  // [u_size / 2, u_size]

vec2 even;
vec2 odd;
vec2 twiddle;
vec2 res;

vec2 mul_complex(vec2 a, vec2 b) {
    return vec2(a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]);
}

void main() {

    if (u_horizontal == 1) {
        ix = (v_xy.x * 0.5 + 0.5) * u_size;
    } else {
        ix = (v_xy.y * 0.5 + 0.5) * u_size;
    }

    ratio = u_size / u_subsize; // 2**(k - i)
    ix_even = mod(mod(ix, ratio / 2.0) + ratio * floor(ix / (ratio / 2.0)), u_size);
    ix_odd = ix_even + ratio / 2.0;

    arg_twiddle = -2.0 * PI * floor(ix / (ratio / 2.0)) / (2.0 * u_subsize);
    twiddle = vec2(cos(arg_twiddle), sin(arg_twiddle));

    if (u_horizontal == 1) {
        even = texture2D(u_input, vec2(ix_even - 0.0, gl_FragCoord.y) / u_size).rg;
        odd  = texture2D(u_input, vec2(ix_odd  - 0.0, gl_FragCoord.y) / u_size).rg;
    } else {
        even = texture2D(u_input, vec2(gl_FragCoord.x, ix_even + 0.0) / u_size).rg;
        odd  = texture2D(u_input, vec2(gl_FragCoord.x, ix_odd  + 0.0) / u_size).rg;
    }

    res = even + mul_complex(twiddle, odd);
    gl_FragColor = vec4(res, 0, 0);
}
`;

const fs = `
#define MODES_MAX 2048
#define PI 3.1415926538

precision highp float;

uniform sampler2D amplitudes;
uniform vec2 modes;
uniform vec2 scales;

varying vec4 v_xy;

vec2 amp;
vec2 k;

void main() {
  float hr = 0.0;
  float hi = 0.0;
  float h = 0.0;
  int M = int(modes[0]);
  int N = int(modes[1]);

  for (int j = 0; j < MODES_MAX; j++) {
    if (j >= N) { break; }

    for (int i = 0; i < MODES_MAX; i++) {
      if (i >= M) { break; }

      k = vec2(float(i), float(j)) / (modes - 1.0);
      amp = vec2(texture2D(amplitudes, k));
      k = (2.0 * k - 1.0) * scales * (2.0 * PI) / 2.0;
      hr += amp[0] * cos(dot(k, v_xy.v_xy)) - amp[1] * sin(dot(k, v_xy.v_xy));
      hi += amp[0] * sin(dot(k, v_xy.v_xy)) + amp[1] * cos(dot(k, v_xy.v_xy));
    }
  }

  // h = sqrt(hr*hr + hi*hi);
  h = hr;

  h /= modes[0] * modes[1];
  h /= sqrt(scales[0] * scales[1]);
  // h *= 50.0; // arbitrary
  h *= 0.5;
  h += 0.5;

  // h = texture2D(amplitudes, vec2((v_xy.x + 1.0) * 0.5, (v_xy.y + 1.0) * 0.5))[1] / 150.0;

  gl_FragColor = vec4(h, h, h, 1);
}
`;

export { vertexShader, magntitudeShader, argumentShader, fftShader };
