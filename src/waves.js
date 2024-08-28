import { compileShader, createProgram } from "./utils.js";

const vs = `
attribute vec4 position;
varying vec4 xy;

void main() {
  gl_Position = position;
  gl_PointSize = 5.0;
  xy = position;
}
`;

const fs = `
#define PI 3.1415926538

precision mediump float;

uniform sampler2D amplitudes;
varying vec4 xy;

float amp;
vec2 k;

void main() {
  float h = 0.0;
  for (int i = 0; i < 32; i++) {
    for (int j = 0; j < 32; j++) {
      k = vec2(float(i) / (32.0 - 1.0) * 2.0 - 1.0, float(j) / (32.0 - 1.0) * 2.0 - 1.0);
      amp = texture2D(amplitudes, k)[0];
      h += amp * cos(8.0 * PI * dot(k, xy.xy));
    }
  }
  h /= 32.0;
  h *= 0.5;
  h += 0.5;
  // h = texture2D(amplitudes, vec2((xy.x + 1.0) * 0.5, (xy.y + 1.0) * 0.5))[0];
  gl_FragColor = vec4(h, h, h, 1);
}
`;

const main = function() {
    const gl = document.querySelector("canvas").getContext("webgl2");

    const prog = createProgram(gl, compileShader(gl, vs, gl.VERTEX_SHADER), compileShader(gl, fs, gl.FRAGMENT_SHADER));
    const positionLoc = gl.getAttribLocation(prog, "position");

    gl.useProgram(prog);

    var positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([
            -1, -1,
            +1, -1,
            -1, +1,
            -1, +1,
            +1, -1,
            +1, +1,
        ]),
        gl.STATIC_DRAW);

    gl.enableVertexAttribArray(positionLoc);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.vertexAttribPointer(positionBuffer, 2, gl.FLOAT, false, 0, 0);

    const N = 32;
    var amplitudes = new Float32Array({length: N * N});
    for (let j = 0; j < N; j++) {
        let y = j / (N - 1) * 2 - 1;
        for (let i = 0; i < N; i++) {
            let x = i / (N - 1) * 2 - 1;
            amplitudes[j * N + i] = Math.exp(-(x * x + y * y) * 8);
            // amplitudes[j * N + i] = 0.5 * (Math.cos(2 * (x * x + y * y) * 2 * Math.PI) + 1.0);
        }
    }

    var amplitudesBuffer = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, amplitudesBuffer);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    //gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    //gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    //gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, N, N, 0, gl.RED, gl.FLOAT, amplitudes);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
}

window.onload = function(ev) {
    console.log("loaded");
    main();
}
