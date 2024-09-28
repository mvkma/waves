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
