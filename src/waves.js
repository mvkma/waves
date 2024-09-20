import {
    Program,
    simulationParameters,
    viewParameters,
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

import {
    buildControls,
} from "./ui.js";

import * as mat from "./matrices.js";

const FLOAT_SIZE = Float32Array.BYTES_PER_ELEMENT;

const G = 9.81;

const TEXTURE_UNITS = {
    outputA: 3,
    outputB: 4,
    amplitudes: 5,
    tempA: 6,
    tempB: 7,
};

const FRAMEBUFFERS = {
    canvas: null,
    outputA: null,
    outputB: null,
    amplitudes: null,
    tempA: null,
    tempB: null,
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
    prog.setUniforms(gl, {"u_input": inputTextureUnit, "u_subsize": subSize, "u_horizontal": horizontal});
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
    prog.setUniforms(gl, {"u_size": params.modes});

    let inputs = [TEXTURE_UNITS.tempB, TEXTURE_UNITS.tempA];
    let outputs = [FRAMEBUFFERS.tempA, FRAMEBUFFERS.tempB];

    let k = Math.log2(params.modes);

    fftStep(gl, prog, inputTextureUnit, FRAMEBUFFERS.tempA, 2**k, 1, 0);
    for (let i = 1; i < 2 * k - 1; i++) {
        let subSize = Math.pow(2, i % k);
        fftStep(gl, prog, inputs[i % 2], outputs[i % 2], 2**k, subSize, i >= k ? 1 : 0);
    }

    let input = ((2 * k) % 2 === 0) ? inputs[1] : inputs[0];
    fftStep(gl, prog, input, outputBuffer, 2**k, 2**(k - 1), 1);
}

const Waves = class {
    constructor () {
        this.gl = document.querySelector("canvas").getContext("webgl2");

        if(!this.gl.getExtension("EXT_color_buffer_float")) {
            console.log("extension for rendering to float textures does not load");
            return;
        }

        this.params = simulationParameters;
        buildControls("simulationControls", this.params);

        this.view = viewParameters;
        buildControls("viewControls", this.view);

        const bindings2d = { "a_position": ATTRIBUTE_LOCATIONS["position"] };
        const bindings3d = {
            "a_mappos": ATTRIBUTE_LOCATIONS["mappos"],
            "a_vertexpos": ATTRIBUTE_LOCATIONS["vertexpos"]
        };

        this.programs = {
            init: new Program(this.gl, vertexShader, waveInitShader, bindings2d),
            conjugation: new Program(this.gl, vertexShader, conjugationShader, bindings2d),
            timeEvolution: new Program(this.gl, vertexShader, timeEvolutionShader, bindings2d),
            fft: new Program(this.gl, vertexShader, fftShader, bindings2d),
            output: new Program(this.gl, vertexShader, greyscaleShader, bindings2d),
            output3D: new Program(this.gl, vertexShader3D, oceanSurfaceShader3D, bindings3d),
        };

        this.buffers = { positions2D: this.gl.createBuffer(), positions3D: this.gl.createBuffer(), indices3D: this.gl.createBuffer() };

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffers["positions2D"]);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array([-1.0, -1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 1.0]), this.gl.STATIC_DRAW);

        this.t = 0.0;
        this.channel = 0;
        this.paused = true;

        console.log(this.view);
        console.log(this.params);

        this.initSimulation();
        this.initView();
    }

    useFramebuffer(fb, width, height) {
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, FRAMEBUFFERS[fb]);
        this.gl.viewport(0, 0, width, height);
    }

    initSimulation () {
        const omegaMag = this.params.wind_x * this.params.wind_x + this.params.wind_y * this.params.wind_y;
        console.log(`dx = ${this.params.scale / this.params.modes}`);
        console.log(`omegaMag / g = ${omegaMag / G}`);
        console.log(`(omegaMag / g) / dy = ${omegaMag / G / (this.params.scale / this.params.modes)}`);

        let positions3D = new Float32Array({length: 5 * this.params.modes * this.params.modes / 4});
        let indices3D = new Uint16Array({length: 6 * (this.params.modes / 2 - 1) * (this.params.modes / 2 - 1)});

        for (let y = 0; y < this.params.modes / 2; y++) {
            for (let x = 0; x < this.params.modes / 2; x++) {
                let pos_ix = (y * this.params.modes / 2 + x) * 5;
                positions3D[pos_ix + 0] = x / (this.params.modes / 2 - 1);
                positions3D[pos_ix + 1] = y / (this.params.modes / 2 - 1);
                positions3D[pos_ix + 2] = x / (this.params.modes / 2 - 1) * this.params.scale - this.params.scale / 2;
                positions3D[pos_ix + 3] = y / (this.params.modes / 2 - 1) * this.params.scale - this.params.scale / 2;
                positions3D[pos_ix + 4] = 0.0;

                let ind_ix = (y * (this.params.modes / 2 - 1) + x) * 6;
                indices3D[ind_ix + 0] = y * this.params.modes / 2 + x;
                indices3D[ind_ix + 1] = (y + 1) * this.params.modes / 2 + x;
                indices3D[ind_ix + 2] = (y + 1) * this.params.modes / 2 + x + 1;
                indices3D[ind_ix + 3] = indices3D[ind_ix + 2];
                indices3D[ind_ix + 4] = y * this.params.modes / 2 + x + 1;
                indices3D[ind_ix + 5] = indices3D[ind_ix + 0];
            }
        }

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffers["positions3D"]);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, positions3D, this.gl.STATIC_DRAW);

        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.buffers["indices3D"]);
        this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, indices3D, this.gl.STATIC_DRAW);

        this.gl.useProgram(this.programs.output.prog);
        this.programs.output.setUniforms(this.gl, {
            "u_type": 0,
            "u_offset": 0.5,
            "u_scale": 1,
            "u_coordscale": [1, 1],
            "u_modes": [this.params.modes, this.params.modes],
        });

        this.gl.useProgram(this.programs.timeEvolution.prog);
        this.programs.timeEvolution.setUniforms(this.gl, {
            "u_modes": [this.params.modes, this.params.modes],
            "u_scales": [this.params.scale, this.params.scale],
        });

        for (const name of Object.keys(TEXTURE_UNITS)) {
            FRAMEBUFFERS[name] = createFramebuffer(
                this.gl,
                createTexture(this.gl,
                              TEXTURE_UNITS[name],
                              this.params.modes,
                              this.params.modes,
                              this.gl.RGBA16F,
                              this.gl.RGBA,
                              this.gl.FLOAT,
                              this.gl.NEAREST,
                              this.gl.CLAMP_TO_EDGE,
                              null),
            );
        }

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffers.positions2D);
        this.gl.enableVertexAttribArray(ATTRIBUTE_LOCATIONS.position);
        this.gl.vertexAttribPointer(ATTRIBUTE_LOCATIONS.position, 2, this.gl.FLOAT, false, 0, 0);

        this.gl.useProgram(this.programs.init.prog);
        this.programs.init.setUniforms(this.gl, {
            "u_modes": [this.params.modes, this.params.modes],
            "u_scales": [this.params.scale, this.params.scale],
            "u_omega": [this.params.wind_x, this.params.wind_y],
            "u_seed": [Math.random(), Math.random()],
            "u_cutoff": this.params.cutoff,
            "u_amp": 1 / this.params.modes / 50, // TODO
        });
        this.useFramebuffer("amplitudes", this.params.modes, this.params.modes);
        this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);

        this.params.changed = false;
    }

    initView () {
        const aspectRatio = this.gl.canvas.width / this.gl.canvas.height;
        const x = 0.8;
        const projMat = mat.perspectiveProjection(-x / aspectRatio, x / aspectRatio, -x, x, 0.2, 10);
        const viewMat = mat.rotateX(mat.rotationZ(Math.PI / 180 * this.view.angZ), Math.PI / 180 * this.view.angX);

        this.gl.useProgram(this.programs.output3D.prog);
        this.programs.output3D.setUniforms(this.gl, {
            "u_modes": [this.params.modes, this.params.modes],
            "u_scales": [this.params.scale, this.params.scale],
            "u_n1": 1.0,
            "u_n2": 1.34,
            "u_diffuse": this.view.diffuse,
            "u_lightdir": [0.0, 30.0, 100.0],
            "u_camerapos": [0.5, 0.5, 3.0],
            "u_skycolor": this.view.skyColor,
            "u_watercolor": this.view.waterColor,
            "u_aircolor": this.view.airColor,
        });
        this.gl.uniformMatrix4fv(this.programs.output3D.uniforms["u_projection"][0], false, projMat);
        this.gl.uniformMatrix4fv(this.programs.output3D.uniforms["u_view"][0], false, viewMat);

        this.view.changed = false;
    }

    render () {
        if (this.params.changed) {
            this.initSimulation();
            this.initView();
        }

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffers.positions2D);
        this.gl.enableVertexAttribArray(ATTRIBUTE_LOCATIONS.position);
        this.gl.vertexAttribPointer(ATTRIBUTE_LOCATIONS.position, 2, this.gl.FLOAT, false, 0, 0);

        // TODO: Probably no need to run this every time
        this.gl.useProgram(this.programs.conjugation.prog);
        this.programs.conjugation.setUniforms(this.gl, {"u_input": TEXTURE_UNITS.amplitudes});
        this.useFramebuffer("outputA", this.params.modes, this.params.modes);
        this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);

        this.gl.useProgram(this.programs.timeEvolution.prog);
        this.programs.timeEvolution.setUniforms(this.gl, {"u_input": TEXTURE_UNITS.outputA, "u_t": this.t});
        this.useFramebuffer("outputB", this.params.modes, this.params.modes);
        this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);

        fft(this.gl, this.programs.fft, TEXTURE_UNITS.outputB, FRAMEBUFFERS["outputB"], this.params);

        this.gl.disableVertexAttribArray(ATTRIBUTE_LOCATIONS.position);

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffers["positions3D"]);
        this.gl.enableVertexAttribArray(ATTRIBUTE_LOCATIONS.vertexpos);
        this.gl.vertexAttribPointer(ATTRIBUTE_LOCATIONS.vertexpos, 3, this.gl.FLOAT, false, 5 * FLOAT_SIZE, 2 * FLOAT_SIZE);

        this.gl.enableVertexAttribArray(ATTRIBUTE_LOCATIONS.mappos);
        this.gl.vertexAttribPointer(ATTRIBUTE_LOCATIONS.mappos, 2, this.gl.FLOAT, false, 5 * FLOAT_SIZE, 0);

        if (this.view.changed) {
            this.initView();
        }
        this.gl.useProgram(this.programs.output3D.prog);
        this.programs.output3D.setUniforms(this.gl, {"u_displacements": TEXTURE_UNITS.outputB});

        this.useFramebuffer("canvas", this.gl.canvas.width, this.gl.canvas.height);
        //this.gl.enable(this.gl.DEPTH_TEST);
        //this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
        this.gl.drawElements(this.gl.TRIANGLES, 6 * (this.params.modes / 2 - 1) * (this.params.modes / 2 - 1), this.gl.UNSIGNED_SHORT, 0);
        // this.gl.drawArrays(this.gl.TRIANTHIS.GLE_STRIP, 0, 4);

        this.t += 0.1;
        if (!this.paused) {
            window.setTimeout(() => window.requestAnimationFrame(() => this.render()), this.view.interval);
        }
    }
}

window.onload = function(ev) {
    console.log("loaded");

    const waves = new Waves();

    window.addEventListener("keyup", function (ev) {
        if (ev.key === " ") {
            waves.paused = !waves.paused;
            if (!waves.paused) {
                window.requestAnimationFrame(() => waves.render());
            }
        } else if (ev.key === "0" || ev.key === "1" || ev.key === "2" || ev.key === "3") {
            waves.channel = parseInt(ev.key);
        }
    });
}
