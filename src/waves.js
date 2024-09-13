import {
    compileShader,
    createProgram,
    createTexture,
    createFramebuffer,
    magnitude,
    dot
} from "./utils.js";

import {
    vertexShader,
    greyscaleShader,
    conjugationShader,
    timeEvolutionShader,
    fftShader,
    sampleInitShader,
    waveInitShader,
} from "./shaders.js";

const TWOPI = 2.0 * Math.PI;

const TEXTURE_UNITS = {
    outputA: 3,
    outputB: 4,
    amplitudes: 5,
    tempA: 6,
    tempB: 7,
};

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
 * @param {!WebGLRenderingContext} gl
 * @param {!WebGLProgram} prog
 * @param {number} inputTextureUnit
 * @param {!WebGLFramebuffer} outputBuffer
 * @param {number} size
 * @param {number} subSize
 * @param {number} horizontal
 */
function fftStep(gl, prog, inputTextureUnit, outputBuffer, size, subSize, horizontal) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, outputBuffer);
    gl.viewport(0, 0, size, size);
    gl.uniform1i(gl.getUniformLocation(prog, "u_input"), inputTextureUnit);
    gl.uniform1f(gl.getUniformLocation(prog, "u_subsize"), subSize);
    gl.uniform1i(gl.getUniformLocation(prog, "u_horizontal"), horizontal);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

/**
 * @param {!WebGLRenderingContext} gl
 * @param {!WebGLProgram} prog
 * @param {number} inputTextureUnit
 * @param {object} params
 */
function fft(gl, prog, inputTextureUnit, outputBuffer, params) {
    gl.useProgram(prog)
    gl.uniform1f(gl.getUniformLocation(prog, "u_size"), params.modes.x);

    let fbA = createFramebuffer(
        gl,
        createTexture(gl,
                      TEXTURE_UNITS.tempA,
                      params.modes.x,
                      params.modes.y,
                      gl.RG16F,
                      gl.RG,
                      gl.FLOAT,
                      gl.NEAREST,
                      gl.CLAMP_TO_EDGE,
                      null),
    );
    let fbB = createFramebuffer(
        gl,
        createTexture(gl,
                      TEXTURE_UNITS.tempB,
                      params.modes.x,
                      params.modes.y,
                      gl.RG16F,
                      gl.RG,
                      gl.FLOAT,
                      gl.NEAREST,
                      gl.CLAMP_TO_EDGE,
                      null),
    );

    let inputs = [TEXTURE_UNITS.tempB, TEXTURE_UNITS.tempA];
    let outputs = [fbA, fbB];

    let k = Math.log2(params.modes.x);

    // console.log(`i = 0, subsize = 1`);
    fftStep(gl, prog, inputTextureUnit, fbA, 2**k, 1, 0);

    for (let i = 1; i < 2 * k - 1; i++) {
        let subSize = Math.pow(2, i % k);
        // console.log(`i = ${i}, subsize = ${subSize}`);

        fftStep(gl, prog, inputs[i % 2], outputs[i % 2], 2**k, subSize, i >= k ? 1 : 0);
    }

    // console.log(`i = ${2 * k - 1}, subsize = ${2**(k-1)}`);
    let input = ((2 * k) % 2 === 0) ? inputs[1] : inputs[0];
    fftStep(gl, prog, input, outputBuffer, 2**k, 2**(k - 1), 1);
}

const main = function() {
    const gl = document.querySelector("canvas").getContext("webgl2");
    const ext = gl.getExtension("EXT_color_buffer_float");
    if (!ext) {
        console.log("extension for rendering to float textures does not load");
        return;
    }

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    console.log(gl.canvas.width, gl.canvas.height, canvas.clientWidth, canvas.clientHeight);

    const initProg = createProgram(
        gl,
        compileShader(gl, vertexShader, gl.VERTEX_SHADER),
        compileShader(gl, waveInitShader, gl.FRAGMENT_SHADER),
    );
    const conjugationProg = createProgram(
        gl,
        compileShader(gl, vertexShader, gl.VERTEX_SHADER),
        compileShader(gl, conjugationShader, gl.FRAGMENT_SHADER),
    );
    const timeEvolutionProgram = createProgram(
        gl,
        compileShader(gl, vertexShader, gl.VERTEX_SHADER),
        compileShader(gl, timeEvolutionShader, gl.FRAGMENT_SHADER),
    );
    const fftProg = createProgram(
        gl,
        compileShader(gl, vertexShader, gl.VERTEX_SHADER),
        compileShader(gl, fftShader, gl.FRAGMENT_SHADER)
    );
    const outputProg = createProgram(
        gl,
        compileShader(gl, vertexShader, gl.VERTEX_SHADER),
        compileShader(gl, greyscaleShader, gl.FRAGMENT_SHADER)
    );

    gl.useProgram(outputProg);

    var positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER,
                  // new Float32Array([-1, -1, +1, -1, -1, +1, -1, +1, +1, -1, +1, +1,]),
                  new Float32Array([-1.0, -1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 1.0]),
                  gl.STATIC_DRAW);

    gl.enableVertexAttribArray(gl.getAttribLocation(outputProg, "a_position"));
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.vertexAttribPointer(positionBuffer, 2, gl.FLOAT, false, 0, 0);

    // Initalization
    const params = {
        modes: { x: 512, y: 512 },
        scales: { x: 600, y: 400 },
        g: 9.81,
        wind: [0.0, 20.0],
        amp: 1 / 512 / 50,
        cutoff: 0.0,
    };

    var omegaMag = magnitude(params.wind);
    console.log(`dx = ${params.scales.x / params.modes.x}, dy = ${params.scales.y / params.modes.y}`);
    console.log(`omegaMag / g = ${omegaMag / params.g}`);
    console.log(`(omegaMag / g) / dx = ${omegaMag / params.g / (params.scales.y / params.modes.y)}`);
    console.log(`(omegaMag / g) / dy = ${omegaMag / params.g / (params.scales.y / params.modes.y)}`);

    var outputAFb = createFramebuffer(
        gl,
        createTexture(gl,
                      TEXTURE_UNITS.outputA,
                      params.modes.x,
                      params.modes.y,
                      gl.RG16F,
                      gl.RG,
                      gl.FLOAT,
                      gl.NEAREST,
                      gl.CLAMP_TO_EDGE,
                      null),
    );

    var outputBFb = createFramebuffer(
        gl,
        createTexture(gl,
                      TEXTURE_UNITS.outputB,
                      params.modes.x,
                      params.modes.y,
                      gl.RG16F,
                      gl.RG,
                      gl.FLOAT,
                      gl.NEAREST,
                      gl.CLAMP_TO_EDGE,
                      null),
    );


    var amplitudesFb = createFramebuffer(
        gl,
        createTexture(gl,
                      TEXTURE_UNITS.amplitudes,
                      params.modes.x,
                      params.modes.y,
                      gl.RG16F,
                      gl.RG,
                      gl.FLOAT,
                      gl.NEAREST,
                      gl.CLAMP_TO_EDGE,
                      null),
    );

    gl.useProgram(initProg);
    gl.uniform2f(gl.getUniformLocation(initProg, "u_modes"), params.modes.x, params.modes.y);
    gl.uniform2f(gl.getUniformLocation(initProg, "u_scales"), params.scales.x, params.scales.y);
    gl.uniform2f(gl.getUniformLocation(initProg, "u_omega"), params.wind[0], params.wind[1]);
    gl.uniform2f(gl.getUniformLocation(initProg, "u_seed"), Math.random(), Math.random());
    gl.uniform1f(gl.getUniformLocation(initProg, "u_cutoff"), params.cutoff);
    gl.uniform1f(gl.getUniformLocation(initProg, "u_amp"), params.amp);
    gl.bindFramebuffer(gl.FRAMEBUFFER, amplitudesFb);
    gl.viewport(0, 0, params.modes.x, params.modes.y);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    let t = 0.0;
    let paused = true;
    const render = function() {
        // TODO: Probably no need to run this every time
        gl.useProgram(conjugationProg);
        gl.uniform1i(gl.getUniformLocation(conjugationProg, "u_input"), TEXTURE_UNITS.amplitudes);
        gl.bindFramebuffer(gl.FRAMEBUFFER, outputAFb);
        gl.viewport(0, 0, params.modes.x, params.modes.y);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        gl.useProgram(timeEvolutionProgram);
        gl.uniform1i(gl.getUniformLocation(timeEvolutionProgram, "u_input"), TEXTURE_UNITS.outputA);
        gl.uniform2f(gl.getUniformLocation(timeEvolutionProgram, "u_modes"), params.modes.x, params.modes.y);
        gl.uniform2f(gl.getUniformLocation(timeEvolutionProgram, "u_scales"), params.scales.x, params.scales.y);
        gl.uniform1f(gl.getUniformLocation(timeEvolutionProgram, "u_t"), t);
        gl.bindFramebuffer(gl.FRAMEBUFFER, outputBFb);
        gl.viewport(0, 0, params.modes.x, params.modes.y);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        fft(gl, fftProg, TEXTURE_UNITS.outputB, outputBFb, params);

        gl.useProgram(outputProg);
        gl.uniform1i(gl.getUniformLocation(outputProg, "u_input"), TEXTURE_UNITS.outputB);
        gl.uniform1i(gl.getUniformLocation(outputProg, "u_type"), 0);
        gl.uniform1f(gl.getUniformLocation(outputProg, "u_offset"), 0.5);
        gl.uniform1f(gl.getUniformLocation(outputProg, "u_scale"), 1);
        gl.uniform2f(gl.getUniformLocation(outputProg, "u_coordscale"), 1, 1);
        gl.uniform2f(gl.getUniformLocation(outputProg, "u_modes"), params.modes.x, params.modes.y);

        // gl.useProgram(outputProg);
        // gl.uniform1i(gl.getUniformLocation(outputProg, "u_input"), TEXTURE_UNITS.output);
        // gl.uniform1i(gl.getUniformLocation(outputProg, "u_type"), 4);
        // gl.uniform1f(gl.getUniformLocation(outputProg, "u_offset"), 0.0);
        // gl.uniform1f(gl.getUniformLocation(outputProg, "u_scale"), 0.1);
        // gl.uniform2f(gl.getUniformLocation(outputProg, "u_coordScale"), 1, 1);

        gl.bindFramebuffer(gl.FRAMEBUFFER, null); // render to canvas
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        t += 0.1;
        // console.log(t);
        if (!paused) {
            window.setTimeout(() => window.requestAnimationFrame(render), 100);
        }
    }

    window.addEventListener("keyup", function (ev) {
        if (ev.key === " ") {
            paused = !paused;
            if (!paused) {
                window.requestAnimationFrame(render);
            }
        }
    });
}

window.onload = function(ev) {
    console.log("loaded");
    main();
}
