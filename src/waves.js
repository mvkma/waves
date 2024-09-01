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
#define MODES_MAX 2048
#define PI 3.1415926538

precision mediump float;

uniform sampler2D amplitudes;
uniform vec2 modes;
uniform vec2 scales;

varying vec4 xy;

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
      hr += amp[0] * cos(dot(k, xy.xy)) - amp[1] * sin(dot(k, xy.xy));
      hi += amp[0] * sin(dot(k, xy.xy)) + amp[1] * cos(dot(k, xy.xy));
    }
  }

  // h = sqrt(hr*hr + hi*hi);
  h = hr;

  h /= modes[0] * modes[1];
  h /= sqrt(scales[0] * scales[1]);
  // h *= 50.0; // arbitrary
  h *= 0.5;
  h += 0.5;

  // h = texture2D(amplitudes, vec2((xy.x + 1.0) * 0.5, (xy.y + 1.0) * 0.5))[1] / 150.0;

  gl_FragColor = vec4(h, h, h, 1);
}
`;

const TWOPI = 2.0 * Math.PI;

/**
 * @param {Float32Array} k
 * @param {Float32Array} omega
 * @param {number} omegaMag
 * @param {number} g
 * @param {number} cutoff
 *
 * @return {number}
 */
const phililipsSpectrum = function(k, omega, omegaMag, g, amp, cutoff) {
    // exp(-1/(k L)^2) / k^4 |\hat{k} \dot \hat{\omega}|^2
    // L = V^2 / g
    const kMag = magnitude(k);
    if (kMag > 0) {
        return amp * Math.exp(-(g**2) / kMag / omegaMag**2 / 2) / kMag * dot(k.map(t => t / Math.sqrt(kMag)), omega) / Math.pow(2, 1/4) * Math.exp(-(cutoff**2) * kMag);
    } else {
        return 0;
    }
}

function gaussian(mean, std) {
    const u = 1 - Math.random();
    const v = Math.random();
    const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return z * std + mean;
}

/**
 * @param {Float32Array} amplitudes
 * @param {object} params
 *
 * @return
 */
function initializeAmplitudes(amplitudes, params) {
    let n, m, ii, jj;
    let xir, xii, p;
    let k = new Float32Array({length: 2});

    for (let j = 0; j < params.modes.y; j++) {
        jj = params.modes.y - 1 - j;
        n = j / (params.modes.y - 1) * 2 - 1;
        k[1] = TWOPI * n / params.scales.y;

        for (let i = 0; i < 2 * params.modes.x; i += 2) {
            ii = 2 * params.modes.x - 2 - i;
            m = i / (2 * params.modes.x - 2) * 2 - 1;
            k[0] = TWOPI * m / params.scales.x;

            p = phililipsSpectrum(k, params.windDirection, params.windMagnitude, params.g, params.amp, params.cutoff);
            xir = gaussian(0, 1) / 2;
            xii = gaussian(0, 1) / 2;
            amplitudes[j * 2 * params.modes.x + i + 0] += xir * p;
            amplitudes[j * 2 * params.modes.x + i + 1] += xii * p;
            amplitudes[jj * 2 * params.modes.x + ii + 0] += xir * p;
            amplitudes[jj * 2 * params.modes.x + ii + 1] += -xii * p;
        }
    }
}

/**
 * @param {Float32Array} amplitudes
 *
 * @return
 */
function initializeSampleAmplitudes(amplitudes, params) {
    let n, m, kx, ky;

    for (let j = 0; j < params.modes.y; j++) {
        n = j / params.modes.y * 2 - 1;
        ky = TWOPI * n / params.scales.y;

        for (let i = 0; i < 2 * params.modes.x; i += 2) {
            m = i / (2 * params.modes.x) * 2 - 1;
            kx = TWOPI * m / params.scales.x;

            // amplitudes[j * 2 * params.modes.x + i + 0] = 1.0 * Math.exp(-(kx * kx + ky * ky) * 100);
            amplitudes[j * 2 * params.modes.x + i + 0] = 1.0 * (Math.cos((kx * kx + ky * ky)) + 1.0);
            amplitudes[j * 2 * params.modes.x + i + 1] = 0.0 * (Math.cos((kx * kx + ky * ky)) + 1.0);
        }
    }
}

const main = function() {
    const gl = document.querySelector("canvas").getContext("webgl2");
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    console.log(gl.canvas.width, gl.canvas.height, canvas.clientWidth, canvas.clientHeight);

    const prog = createProgram(gl, compileShader(gl, vs, gl.VERTEX_SHADER), compileShader(gl, fs, gl.FRAGMENT_SHADER));
    const positionLoc = gl.getAttribLocation(prog, "position");
    const modesLoc = gl.getUniformLocation(prog, "modes");
    const scalesLoc = gl.getUniformLocation(prog, "scales");

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

    var omega = new Float32Array([0.0, 20.0]);
    var omegaMag = magnitude(omega);

    const params = {
        modes: { x: 128, y: 128 },
        scales: { x: 60, y: 40 },
        g: 9.81,
        windDirection: omega.map(t => t / Math.sqrt(omegaMag)),
        windMagnitude: omegaMag,
        amp: 4.0,
        cutoff: 1.0,
    };

    var initialAmplitudes = new Float32Array(2 * params.modes.x * params.modes.y);

    initializeAmplitudes(initialAmplitudes, params);
    // initializeSampleAmplitudes(initialAmplitudes, params);
    console.log(`dx = ${params.scales.x / params.modes.x}, dy = ${params.scales.y / params.modes.y}`);
    console.log(`omegaMag / g = ${omegaMag / params.g}`);
    console.log(`(omegaMag / g) / dx = ${omegaMag / params.g / (params.scales.y / params.modes.y)}`);
    console.log(`(omegaMag / g) / dy = ${omegaMag / params.g / (params.scales.y / params.modes.y)}`);
    console.log(params);
    console.log("amplitudes set");
    console.log(initialAmplitudes);

    let com, som, ii, jj, om;
    let h0p, h0m, h1p, h1m;
    let n, m;

    var t = 0.0;
    var amplitudes = initialAmplitudes.slice();
    var k = new Float32Array({length: 2});

    var amplitudesBuffer = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, amplitudesBuffer);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameterf(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameterf(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    gl.uniform2f(modesLoc, params.modes.x, params.modes.y);
    gl.uniform2f(scalesLoc, params.scales.x, params.scales.y);

    const render = function() {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG16F, params.modes.x, params.modes.y, 0, gl.RG, gl.FLOAT, amplitudes);
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        for (let j = 0; j < params.modes.y; j++){
            jj = params.modes.y - 1 - j;
            n = j / (params.modes.y - 1) * 2 - 1;
            k[1] = TWOPI * n / params.scales.y;

            for (let i = 0; i < 2 * params.modes.x; i += 2) {
                ii = 2 * params.modes.x - 2 - i;
                m = i / (2 * params.modes.x - 2) * 2 - 1;
                k[0] = TWOPI * m / params.scales.x;

                om = Math.sqrt(params.g * Math.sqrt(magnitude(k)));
                com = Math.cos(om * t);
                som = Math.sin(om * t);

                // TODO: slices
                h0p = initialAmplitudes[j * 2 * params.modes.x + i + 0];
                h1p = initialAmplitudes[j * 2 * params.modes.x + i + 1];
                h0m = initialAmplitudes[jj * 2 * params.modes.x + ii + 0];
                h1m = initialAmplitudes[jj * 2 * params.modes.x + ii + 1];

                amplitudes[j * 2 * params.modes.x + i + 0] = (h0p + h0m) / 1.0 * com - (h1p + h1m) / 1.0 * som;
                amplitudes[j * 2 * params.modes.x + i + 1] = (h1p - h1m) / 1.0 * com + (h0p - h0m) / 1.0 * som;
            }
        }

        // console.log(amplitudes);
        t += 0.1;
        if (t < 0.0) {
            window.setTimeout(() => window.requestAnimationFrame(render), 100);
        }
    }

    window.requestAnimationFrame(render);
}

window.onload = function(ev) {
    console.log("loaded");
    main();
}
