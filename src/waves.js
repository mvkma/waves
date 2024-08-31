import { compileShader, createProgram, magnitude, dot } from "./utils.js";

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

vec2 amp;
vec2 k;

void main() {
  float h = 0.0;
  for (int i = 0; i < 32; i++) {
    for (int j = 0; j < 32; j++) {
      k = vec2(float(i) / (32.0 - 1.0) * 2.0 - 1.0, float(j) / (32.0 - 1.0) * 2.0 - 1.0);
      amp = vec2(texture2D(amplitudes, k));
      h += amp[0] * cos(2.0 * PI * dot(k, xy.xy)) - amp[1] * sin(2.0 * PI * dot(k, xy.xy));
    }
  }
  h /= 32.0;
  h *= 0.5;
  h += 0.5;
  // h = texture2D(amplitudes, vec2((xy.x + 1.0) * 0.5, (xy.y + 1.0) * 0.5))[0];
  gl_FragColor = vec4(h, h, h, 1);
}
`;

const GRAVITY = 1.0;

/**
 * @param {Float32Array} k
 * @param {Float32Array} omega
 * @param {number} omegaMag
 *
 * @return {number}
 */
const phililipsSpectrum = function(k, omega, omegaMag) {
    // exp(-1/(k L)^2) / k^4 |\hat{k} \dot \hat{\omega}|^2
    // L = V^2 / g
    const kMag = magnitude(k);
    for (let i = 0; i < k.length; i++) {
        k[i] /= kMag;
    }

    return Math.exp(-(GRAVITY**2) / kMag / omegaMag**2) / kMag**2 * dot(k, omega)**2 / Math.sqrt(2);
}

function gaussian(mean, std) {
    const u = 1 - Math.random();
    const v = Math.random();
    const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return z * std + mean;
}

/**
 * @param {Float32Array} amplitudes
 * @param {object} omega
 *
 * @return
 */
function initializeAmplitudes(amplitudes, omega, omegaMag) {
    const N = amplitudes.length;
    let k = new Float32Array({length: 2});
    for (let j = 0; j < N; j++) {
        k[1] = j / (N - 1) * 2 - 1;
        for (let i = 0; i < 2 * N; i += 2) {
            k[0] = i / (2 * N - 1) * 2 - 1;
            let p = Math.sqrt(phililipsSpectrum(k, omega, omegaMag));
            amplitudes[j * N + i + 0] = p * gaussian(0, 1);
            amplitudes[j * N + i + 1] = p * gaussian(0, 1);
        }
    }
}


/**
 * @param {Float32Array} amplitudes
 *
 * @return
 */
function initializeSampleAmplitudes(amplitudes) {
    for (let j = 0; j < N; j++) {
        let y = j / (N - 1) * 2 - 1;
        for (let i = 0; i < 2 * N; i += 2) {
            let x = i / (2 * N - 1) * 2 - 1;
            amplitudes[j * 2 * N + i + 0] = Math.exp(-(x * x + y * y) * 8);
            amplitudes[j * 2 * N + i + 1] = 0.5 * (Math.cos(2 * (x * x + y * y) * 2 * Math.PI) + 1.0);
        }
    }
}

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
    var omega = new Float32Array([0.9, 9.0]);
    var omegaMag = magnitude(omega);

    var initialAmplitudes = new Float32Array({length: 2 * N * N});
    var amplitudes = new Float32Array({length: 2 * N * N});

    initializeAmplitudes(initialAmplitudes, omega.map(t => t / omegaMag), omegaMag);
    console.log("amplitudes set");
    console.log(initialAmplitudes);

    var t = 0.0;
    let com, som, ii, jj, om;
    let h0p, h0m, h1p, h1m;
    var k = new Float32Array({length: 2});
    const render = function() {
        for (let j = 0; j < N; j++){
            jj = N - 1 - j;
            k[1] = j / (N - 1) * 2 - 1;
            for (let i = 0; i < 2 * N; i += 2) {
                ii = 2 * N - 1 - i;
                k[0] = i / (2 * N - 1) * 2 - 1;

                om = Math.sqrt(GRAVITY * Math.sqrt(magnitude(k)));
                com = Math.cos(om * t);
                som = Math.sin(om * t);

                // TODO: slices
                h0p = initialAmplitudes[j * 2 * N + i + 0];
                h1p = initialAmplitudes[j * 2 * N + i + 1];
                h0m = initialAmplitudes[jj * 2 * N + ii - 1 + 0];
                h1m = initialAmplitudes[jj * 2 * N + ii - 1 + 1];

                // console.log(i, j, ii, jj, t, om, h0p, h0m, h1p, h1m, com, som);

                amplitudes[j * 2 * N + i + 0] = (h0p + h0m) * com - (h1p + h1m) * som;
                amplitudes[j * 2 * N + i + 1] = (h1p - h1m) * com + (h0p - h0m) * som;
            }
        }
        // console.log(amplitudes);
        t += 0.5;

        var amplitudesBuffer = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, amplitudesBuffer);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        //gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        //gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        //gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG16F, N, N, 0, gl.RG, gl.FLOAT, amplitudes);

        gl.drawArrays(gl.TRIANGLES, 0, 6);
        if (t < 100.0) {
            window.setTimeout(() => window.requestAnimationFrame(render), 50);
        }
    }

    window.requestAnimationFrame(render);
}

window.onload = function(ev) {
    console.log("loaded");
    main();
}
