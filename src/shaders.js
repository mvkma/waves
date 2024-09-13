const vertexShader = `
attribute vec4 a_position;

varying vec4 v_xy;

void main() {
  gl_Position = a_position;
  v_xy = a_position;
}
`;

const greyscaleShader = `
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
    value = vec4(mul_complex(value.xy, vec2(cos(phase), sin(phase))), value.zw);

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

`;

const fftShader = `
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

vec2 even;
vec2 odd;
vec2 twiddle;
vec2 res;
vec2 offset;

vec2 mul_complex(vec2 a, vec2 b) {
    return vec2(a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]);
}

void main() {

    if (u_horizontal == 1) {
        ix = (v_xy.x * 0.5 + 0.5) * u_size;
        jx = (v_xy.y * 0.5 + 0.5) * u_size;
    } else {
        ix = (v_xy.y * 0.5 + 0.5) * u_size;
        jx = (v_xy.x * 0.5 + 0.5) * u_size;
    }

    ratio = u_size / u_subsize; // 2**(k - i)
    ix_even = mod(mod(ix, ratio / 2.0) + ratio * floor(ix / (ratio / 2.0)), u_size);
    ix_odd = ix_even + ratio / 2.0;

    arg_twiddle = -2.0 * PI * floor(ix / (ratio / 2.0)) / (2.0 * u_subsize);
    twiddle = vec2(cos(arg_twiddle), sin(arg_twiddle));

    offset = vec2(0.0, 0.0);
    if (u_horizontal == 1) {
        even = texture2D(u_input, (vec2(ix_even, jx) + offset) / u_size).rg;
        odd  = texture2D(u_input, (vec2(ix_odd , jx) + offset) / u_size).rg;
    } else {
        even = texture2D(u_input, (vec2(jx, ix_even) + offset) / u_size).rg;
        odd  = texture2D(u_input, (vec2(jx, ix_odd ) + offset) / u_size).rg;
    }

    res = even + mul_complex(twiddle, odd);
    arg_twiddle = -PI * (ix - u_size / 2.0);
    res = mul_complex(res, vec2(cos(arg_twiddle), sin(arg_twiddle)));

    gl_FragColor = vec4(res, 0, 0);
}
`;

const sampleInitShader = `
#define PI 3.1415926538

precision highp float;

uniform float u_size_x;
uniform float u_size_y;
uniform float u_amp;

varying vec4 v_xy; // [-1, 1]

float re;
float im;

vec2 k;

void main() {
    k = v_xy.xy + vec2(0.0, 0.0);

    // re = u_amp * exp(-(k.x * k.x + k.y * k.y) * 5.0) * cos(k.x * k.x * 40.0) * sin(k.y * 20.0);
    // im = u_amp * 0.0;

    // re = u_amp * sin(k.x * 20.0 - k.y * 10.0);
    // im = u_amp * 0.0;

    if (abs(k.x) < 0.05 && abs(k.y) < 0.10) {
        re = 1.0;
    } else {
        re = 0.0;
    }
    im = u_amp * 0.0;

    gl_FragColor = vec4(re, im, 0, 0);
}
`;

const waveInitShader = `
#define PI 3.1415926538
#define G 9.81

precision highp float;

uniform vec2 u_modes;
uniform vec2 u_scales;
uniform vec2 u_omega;
uniform vec2 u_seed;
uniform float u_cutoff;
uniform float u_amp;

varying vec4 v_xy; // [-1, 1]

// more or less uniform on [0, 1]
float random(vec2 v) {
    return fract(sin(dot(v.xy, vec2(12.9898,78.233))) * 43758.5453123) * 0.5 + 0.5;
}

float gaussian(vec2 xy) {
    float u = 1.0 - random(xy);
    if (u == 0.0) {
        u = 0.33; // very random
    }
    float v = random(xy);

    return sqrt(-2.0 * log(u)) * cos(2.0 * PI * v);
}

float phillips(vec2 k, vec2 omega, float omegaMag, float cutoff) {
    float kMag = k.x * k.x + k.y * k.y;
    if (kMag > 0.0) {
        return exp(-pow(G, 2.0) / kMag / pow(omegaMag, 2.0) / 2.0) / kMag * abs(dot(normalize(k), normalize(omega))) / pow(2.0, 0.25) * exp(-pow(cutoff, 2.0) * kMag / 2.0);
    } else {
        return 0.0;
    }
}

float re;
float im;
float pp;

vec2 k;
vec2 omega;

void main() {
    // k = v_xy.xy * 2.0 * PI / vec2(u_scale_x, u_scale_y);
    k = v_xy.xy * PI * u_modes / u_scales;

    pp = phillips( k, u_omega, u_omega.x * u_omega.x + u_omega.y * u_omega.y, u_cutoff);

    re = pp * u_amp * gaussian(v_xy.xy - u_seed);
    im = pp * u_amp * gaussian(v_xy.xy + u_seed);

    gl_FragColor = vec4(re, im, 0, 0);
}
`;

const conjugationShader = `
#define PI 3.1415926538

precision highp float;

uniform highp sampler2D u_input;

varying vec4 v_xy;

vec2 phase;
vec2 res;
vec2 hp;
vec2 hm;
vec2 kp;
vec2 km;

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
    kp = ( v_xy.xy * 0.5 + 0.5);
    km = (-v_xy.xy * 0.5 + 0.5);

    hp = 1.0 * texture2D(u_input, kp).xy / 2.0;
    hm = 1.0 * texture2D(u_input, km).xy / 2.0;

    // Initialize with random phases
    phase = vec2(cos(PI * random(kp)), sin(PI * random(kp)));
    res = mul_complex(hp, phase) + mul_complex(conjugate(hm), conjugate(phase));

    gl_FragColor = vec4(res, 1, 1);
}
`;

const timeEvolutionShader = `
#define PI 3.1415926538
#define G 9.81

precision highp float;

uniform highp sampler2D u_input;
uniform vec2 u_modes;
uniform vec2 u_scales;
uniform float u_t;

varying vec4 v_xy;

float omegat;
vec2 phase;
vec2 res;
vec2 hp;
vec2 hm;
vec2 kp;
vec2 km;
vec2 k;

vec2 mul_complex(vec2 a, vec2 b) {
    return vec2(a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]);
}

vec2 conjugate(vec2 a) {
    return vec2(a[0], -a[1]);
}

void main() {
    kp = ( v_xy.xy * 0.5 + 0.5);
    km = (-v_xy.xy * 0.5 + 0.5);

    k = v_xy.xy * PI * u_modes / u_scales;
    omegat = sqrt(G * length(k)) * u_t;

    hp = 1.0 * texture2D(u_input, kp).xy / 2.0;
    hm = 1.0 * texture2D(u_input, km).xy / 2.0;

    phase = vec2(cos(omegat), sin(omegat));

    res = mul_complex(hp, phase) + mul_complex(conjugate(hm), conjugate(phase));

    gl_FragColor = vec4(res, 1, 1);
}

`;

const fs = `
#define MODES_MAX 2048
#define PI 3.1415926538

precision highp float;

uniform highp sampler2D amplitudes;
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

export {
    vertexShader,
    greyscaleShader,
    conjugationShader,
    timeEvolutionShader,
    fftShader,
    sampleInitShader,
    waveInitShader,
};
