import {
    Program,
    SimulationParameters,
    createTexture,
    createFramebuffer,
} from "./utils.js";

import {
    vertexShader,
    vertexShader3D,
    greyscaleShader,
    conjugationShader,
    timeEvolutionShader,
    fftShader,
    oceanSurfaceShader3D,
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

const ATTRIBUTE_LOCATIONS = {
    position: 0,
    mappos: 1,
    vertexpos: 2,
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
    gl.uniform1f(prog.uniforms["u_size"], params.modes);

    let fbA = createFramebuffer(
        gl,
        createTexture(gl,
                      TEXTURE_UNITS.tempA,
                      params.modes,
                      params.modes,
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
                      params.modes,
                      params.modes,
                      gl.RGBA16F,
                      gl.RGBA,
                      gl.FLOAT,
                      gl.NEAREST,
                      gl.CLAMP_TO_EDGE,
                      null),
    );

    let inputs = [TEXTURE_UNITS.tempB, TEXTURE_UNITS.tempA];
    let outputs = [fbA, fbB];

    let k = Math.log2(params.modes);

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
    if(!gl.getExtension("EXT_color_buffer_float")) {
        console.log("extension for rendering to float textures does not load");
        return;
    }

    // Initalization
    const params = new SimulationParameters();
    console.log(params);

    const omegaMag = params.wind_x * params.wind_x + params.wind_y * params.wind_y;
    console.log(`dx = ${params.scale / params.modes}, dy = ${params.scale / params.modes}`);
    console.log(`omegaMag / g = ${omegaMag / params.g}`);
    console.log(`(omegaMag / g) / dx = ${omegaMag / params.g / (params.scale / params.modes)}`);
    console.log(`(omegaMag / g) / dy = ${omegaMag / params.g / (params.scale / params.modes)}`);

    // WebGL setup
    const bindings2d = { "a_position": ATTRIBUTE_LOCATIONS["position"] };
    const bindings3d = {
        "a_mappos": ATTRIBUTE_LOCATIONS["mappos"],
        "a_vertexpos": ATTRIBUTE_LOCATIONS["vertexpos"]
    };

    const programs = {
        init: new Program(gl, vertexShader, waveInitShader, bindings2d),
        conjugation: new Program(gl, vertexShader, conjugationShader, bindings2d),
        timeEvolution: new Program(gl, vertexShader, timeEvolutionShader, bindings2d),
        fft: new Program(gl, vertexShader, fftShader, bindings2d),
        output: new Program(gl, vertexShader, greyscaleShader, bindings2d),
        output3D: new Program(gl, vertexShader3D, oceanSurfaceShader3D, bindings3d),
    };

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1.0, -1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 1.0]), gl.STATIC_DRAW);

    let positions3D = new Float32Array({length: 5 * params.modes * params.modes / 4});
    let indices3D = new Uint16Array({length: 6 * (params.modes / 2 - 1) * (params.modes / 2 - 1)});
    for (let y = 0; y < params.modes / 2; y++) {
        for (let x = 0; x < params.modes / 2; x++) {
            let pos_ix = (y * params.modes / 2 + x) * 5;
            positions3D[pos_ix + 0] = x / (params.modes / 2 - 1);
            positions3D[pos_ix + 1] = y / (params.modes / 2 - 1);
            positions3D[pos_ix + 2] = x / (params.modes / 2 - 1) * params.scale - params.scale / 2;
            positions3D[pos_ix + 3] = y / (params.modes / 2 - 1) * params.scale - params.scale / 2;
            positions3D[pos_ix + 4] = 0.0;

            let ind_ix = (y * (params.modes / 2 - 1) + x) * 6;
            indices3D[ind_ix + 0] = y * params.modes / 2 + x;
            indices3D[ind_ix + 1] = (y + 1) * params.modes / 2 + x;
            indices3D[ind_ix + 2] = (y + 1) * params.modes / 2 + x + 1;
            indices3D[ind_ix + 3] = indices3D[ind_ix + 2];
            indices3D[ind_ix + 4] = y * params.modes / 2 + x + 1;
            indices3D[ind_ix + 5] = indices3D[ind_ix + 0];
        }
    }

    const position3DBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, position3DBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions3D, gl.STATIC_DRAW);

    const indices3DBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indices3DBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices3D, gl.STATIC_DRAW);

    gl.useProgram(programs.output.prog);
    gl.uniform1i(programs.output.uniforms["u_type"], 0);
    gl.uniform1f(programs.output.uniforms["u_offset"], 0.5);
    gl.uniform1f(programs.output.uniforms["u_scale"], 1);
    gl.uniform2f(programs.output.uniforms["u_coordscale"], 1, 1);
    gl.uniform2f(programs.output.uniforms["u_modes"], params.modes, params.modes);

    gl.useProgram(programs.timeEvolution.prog);
    gl.uniform2f(programs.timeEvolution.uniforms["u_modes"], params.modes, params.modes);
    gl.uniform2f(programs.timeEvolution.uniforms["u_scales"], params.scale, params.scale);

    gl.useProgram(programs.output3D.prog);
    // TODO: correct matrices
    gl.uniform2f(programs.output3D.uniforms["u_modes"], params.modes, params.modes);
    gl.uniform2f(programs.output3D.uniforms["u_scales"], params.scale, params.scale);
    gl.uniform1f(programs.output3D.uniforms["u_n1"], 1.0);
    gl.uniform1f(programs.output3D.uniforms["u_n2"], 1.34);
    gl.uniform1f(programs.output3D.uniforms["u_diffuse"], 0.95);
    gl.uniform3f(programs.output3D.uniforms["u_lightdir"], 0.0, 30.0, 100.0);
    gl.uniform3f(programs.output3D.uniforms["u_camerapos"], 0.5, 0.5, 3.0);
    gl.uniform3f(programs.output3D.uniforms["u_skycolor"], 80 / 255, 160 / 255, 220 / 255);
    gl.uniform3f(programs.output3D.uniforms["u_watercolor"], 0.1, 0.2, 0.3);
    gl.uniform3f(programs.output3D.uniforms["u_aircolor"], 0.10, 0.10, 0.40);
    gl.uniformMatrix4fv(programs.output3D.uniforms["u_projection"], false, new Float32Array([
        0.6666666865348816, 0, 0, 0, 0, 1, 0, 0, 0, 0, -1.0202020406723022, -1, 0, 0, -0.20202019810676575, 0,
    ]));
    let ang_x = -Math.PI / 180 * 30;
    gl.uniformMatrix4fv(programs.output3D.uniforms["u_view"], false, new Float32Array([
        1, 0, 0, 0, 0, Math.cos(ang_x), Math.sin(ang_x), 0, 0, -Math.sin(ang_x), Math.cos(ang_x), 0, 0, 0, 0, 1,
    ]));

    var outputAFb = createFramebuffer(
        gl,
        createTexture(gl,
                      TEXTURE_UNITS.outputA,
                      params.modes,
                      params.modes,
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
                      params.modes,
                      params.modes,
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
                      params.modes,
                      params.modes,
                      gl.RG16F,
                      gl.RG,
                      gl.FLOAT,
                      gl.NEAREST,
                      gl.CLAMP_TO_EDGE,
                      null),
    );

    // Rendering
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.enableVertexAttribArray(ATTRIBUTE_LOCATIONS.position);
    gl.vertexAttribPointer(ATTRIBUTE_LOCATIONS.position, 2, gl.FLOAT, false, 0, 0);

    gl.useProgram(programs.init.prog);
    gl.uniform2f(programs.init.uniforms["u_modes"], params.modes, params.modes);
    gl.uniform2f(programs.init.uniforms["u_scales"], params.scale, params.scale);
    gl.uniform2f(programs.init.uniforms["u_omega"], params.wind_x, params.wind_y);
    gl.uniform2f(programs.init.uniforms["u_seed"], Math.random(), Math.random());
    gl.uniform1f(programs.init.uniforms["u_cutoff"], params.cutoff);
    gl.uniform1f(programs.init.uniforms["u_amp"], params.amp);
    gl.bindFramebuffer(gl.FRAMEBUFFER, amplitudesFb);
    gl.viewport(0, 0, params.modes, params.modes);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    let t = 0.0;
    let channel = 0;
    let paused = true;
    const render = function() {
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.enableVertexAttribArray(ATTRIBUTE_LOCATIONS.position);
        gl.vertexAttribPointer(ATTRIBUTE_LOCATIONS.position, 2, gl.FLOAT, false, 0, 0);

        // TODO: Probably no need to run this every time
        gl.useProgram(programs.conjugation.prog);
        gl.uniform1i(programs.conjugation.uniforms["u_input"], TEXTURE_UNITS.amplitudes);
        gl.bindFramebuffer(gl.FRAMEBUFFER, outputAFb);
        gl.viewport(0, 0, params.modes, params.modes);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        gl.useProgram(programs.timeEvolution.prog);
        gl.uniform1i(programs.timeEvolution.uniforms["u_input"], TEXTURE_UNITS.outputA);
        gl.uniform1f(programs.timeEvolution.uniforms["u_t"], t);
        gl.bindFramebuffer(gl.FRAMEBUFFER, outputBFb);
        gl.viewport(0, 0, params.modes, params.modes);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        fft(gl, programs.fft, TEXTURE_UNITS.outputB, outputBFb, params);

        // gl.useProgram(programs.output.prog);
        // gl.uniform1i(programs.output.uniforms["u_input"], TEXTURE_UNITS.outputB);
        // gl.uniform1i(programs.output.uniforms["u_type"], channel);

        gl.disableVertexAttribArray(ATTRIBUTE_LOCATIONS.position);

        gl.bindBuffer(gl.ARRAY_BUFFER, position3DBuffer);
        gl.enableVertexAttribArray(ATTRIBUTE_LOCATIONS.vertexpos);
        gl.vertexAttribPointer(ATTRIBUTE_LOCATIONS.vertexpos, 3, gl.FLOAT, false, 5 * Float32Array.BYTES_PER_ELEMENT, 2 * Float32Array.BYTES_PER_ELEMENT);

        gl.enableVertexAttribArray(ATTRIBUTE_LOCATIONS.mappos);
        gl.vertexAttribPointer(ATTRIBUTE_LOCATIONS.mappos, 2, gl.FLOAT, false, 5 * Float32Array.BYTES_PER_ELEMENT, 0);

        gl.useProgram(programs.output3D.prog);
        gl.uniform1i(programs.output3D.uniforms["u_displacements"], TEXTURE_UNITS.outputB);

        gl.bindFramebuffer(gl.FRAMEBUFFER, null); // render to canvas
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        //gl.enable(gl.DEPTH_TEST);
        //gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.drawElements(gl.TRIANGLES, indices3D.length, gl.UNSIGNED_SHORT, 0);
        // gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

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
