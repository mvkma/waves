import {
    Program,
    createTexture,
    createFramebuffer,
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

const TEXTURE_UNITS = {
    outputA: 3,
    outputB: 4,
    amplitudes: 5,
    tempA: 6,
    tempB: 7,
};

/**
 * @param {!WebGLRenderingContext} gl
 * @param {!Program} prog
 * @param {number} inputTextureUnit
 * @param {!WebGLFramebuffer} outputBuffer
 * @param {number} size
 * @param {number} subSize
 * @param {number} horizontal
 */
function fftStep(gl, prog, inputTextureUnit, outputBuffer, size, subSize, horizontal) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, outputBuffer);
    gl.viewport(0, 0, size, size);
    gl.uniform1i(prog.uniforms["u_input"], inputTextureUnit);
    gl.uniform1f(prog.uniforms["u_subsize"], subSize);
    gl.uniform1i(prog.uniforms["u_horizontal"], horizontal);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

/**
 * @param {!WebGLRenderingContext} gl
 * @param {!Program} prog
 * @param {number} inputTextureUnit
 * @param {object} params
 */
function fft(gl, prog, inputTextureUnit, outputBuffer, params) {
    gl.useProgram(prog.prog)
    gl.uniform1f(prog.uniforms["u_size"], params.modes.x);

    let fbA = createFramebuffer(
        gl,
        createTexture(gl,
                      TEXTURE_UNITS.tempA,
                      params.modes.x,
                      params.modes.y,
                      gl.RGBA16F,
                      gl.RGBA,
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
                      gl.RGBA16F,
                      gl.RGBA,
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

    const initProg = new Program(gl, vertexShader, waveInitShader);
    const conjugationProg = new Program(gl, vertexShader, conjugationShader);
    const timeEvolutionProgram = new Program(gl, vertexShader, timeEvolutionShader);
    const fftProg = new Program(gl, vertexShader, fftShader);
    const outputProg = new Program(gl, vertexShader, greyscaleShader);

    var positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER,
                  new Float32Array([-1.0, -1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 1.0]),
                  gl.STATIC_DRAW);

    gl.enableVertexAttribArray(gl.getAttribLocation(outputProg.prog, "a_position"));
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.vertexAttribPointer(positionBuffer, 2, gl.FLOAT, false, 0, 0);

    // Initalization
    const params = {
        modes: { x: 512, y: 512 },
        scales: { x: 600, y: 400 },
        g: 9.81,
        wind: [25.0, 0.0],
        amp: 1 / 512 / 50,
        cutoff: 1.0,
    };

    var omegaMag = params.wind[0] * params.wind[0] + params.wind[1] * params.wind[1];
    console.log(`dx = ${params.scales.x / params.modes.x}, dy = ${params.scales.y / params.modes.y}`);
    console.log(`omegaMag / g = ${omegaMag / params.g}`);
    console.log(`(omegaMag / g) / dx = ${omegaMag / params.g / (params.scales.y / params.modes.y)}`);
    console.log(`(omegaMag / g) / dy = ${omegaMag / params.g / (params.scales.y / params.modes.y)}`);

    gl.useProgram(outputProg.prog);
    gl.uniform1i(outputProg.uniforms["u_type"], 0);
    gl.uniform1f(outputProg.uniforms["u_offset"], 0.5);
    gl.uniform1f(outputProg.uniforms["u_scale"], 1);
    gl.uniform2f(outputProg.uniforms["u_coordscale"], 1, 1);
    gl.uniform2f(outputProg.uniforms["u_modes"], params.modes.x, params.modes.y);

    gl.useProgram(timeEvolutionProgram.prog);
    gl.uniform2f(timeEvolutionProgram.uniforms["u_modes"], params.modes.x, params.modes.y);
    gl.uniform2f(timeEvolutionProgram.uniforms["u_scales"], params.scales.x, params.scales.y);

    var outputAFb = createFramebuffer(
        gl,
        createTexture(gl,
                      TEXTURE_UNITS.outputA,
                      params.modes.x,
                      params.modes.y,
                      gl.RGBA16F,
                      gl.RGBA,
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
                      gl.RGBA16F,
                      gl.RGBA,
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

    gl.useProgram(initProg.prog);
    gl.uniform2f(initProg.uniforms["u_modes"], params.modes.x, params.modes.y);
    gl.uniform2f(initProg.uniforms["u_scales"], params.scales.x, params.scales.y);
    gl.uniform2f(initProg.uniforms["u_omega"], params.wind[0], params.wind[1]);
    gl.uniform2f(initProg.uniforms["u_seed"], Math.random(), Math.random());
    gl.uniform1f(initProg.uniforms["u_cutoff"], params.cutoff);
    gl.uniform1f(initProg.uniforms["u_amp"], params.amp);
    gl.bindFramebuffer(gl.FRAMEBUFFER, amplitudesFb);
    gl.viewport(0, 0, params.modes.x, params.modes.y);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    let t = 0.0;
    let channel = 0;
    let paused = true;
    const render = function() {
        // TODO: Probably no need to run this every time
        gl.useProgram(conjugationProg.prog);
        gl.uniform1i(conjugationProg.uniforms["u_input"], TEXTURE_UNITS.amplitudes);
        gl.bindFramebuffer(gl.FRAMEBUFFER, outputAFb);
        gl.viewport(0, 0, params.modes.x, params.modes.y);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        gl.useProgram(timeEvolutionProgram.prog);
        gl.uniform1i(timeEvolutionProgram.uniforms["u_input"], TEXTURE_UNITS.outputA);
        gl.uniform1f(timeEvolutionProgram.uniforms["u_t"], t);
        gl.bindFramebuffer(gl.FRAMEBUFFER, outputBFb);
        gl.viewport(0, 0, params.modes.x, params.modes.y);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        fft(gl, fftProg, TEXTURE_UNITS.outputB, outputBFb, params);

        gl.useProgram(outputProg.prog);
        gl.uniform1i(outputProg.uniforms["u_input"], TEXTURE_UNITS.outputB);
        gl.uniform1i(outputProg.uniforms["u_type"], channel);

        gl.bindFramebuffer(gl.FRAMEBUFFER, null); // render to canvas
        // gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
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
        } else if (ev.key === "0" || ev.key === "1" || ev.key === "2" || ev.key === "3") {
            channel = parseInt(ev.key);
        }
    });
}

window.onload = function(ev) {
    console.log("loaded");
    main();
}
