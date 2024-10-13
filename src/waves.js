/*
 * TODO
 * - Skybox and sky reflection?
 * - Better controls, possibly align with some CSS like
 * - Fix sccaling of z-coordinates
 * - Better default parameters for light and colors
 * - Add ocean depth as a parameter
 */

import {
    Program,
    createTexture,
    createFramebuffer,
    loadShaderSources,
    initializeCubeMap,
} from "./utils.js";

import {
    buildControls,
} from "./ui.js";

import * as mat from "./matrices.js";

import {
    G,
    FLOAT_SIZE,
    SHADER_SOURCES,
    VIEW_PARAMS,
    SIMULATION_PARAMS,
} from "./params.js";

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

const CUBE_TEXTURE_UNIT = 2;

const CUBE_FACES = [
    { target: WebGL2RenderingContext.TEXTURE_CUBE_MAP_POSITIVE_X, url: "sky-horizontal.jpg", size: 512 },
    { target: WebGL2RenderingContext.TEXTURE_CUBE_MAP_POSITIVE_Y, url: "sky-horizontal.jpg", size: 512 },
    { target: WebGL2RenderingContext.TEXTURE_CUBE_MAP_POSITIVE_Z, url: "sky-horizontal.jpg", size: 512 },
    { target: WebGL2RenderingContext.TEXTURE_CUBE_MAP_NEGATIVE_X, url: "sky-horizontal.jpg", size: 512 },
    { target: WebGL2RenderingContext.TEXTURE_CUBE_MAP_NEGATIVE_Y, url: "sky-horizontal.jpg", size: 512 },
    { target: WebGL2RenderingContext.TEXTURE_CUBE_MAP_NEGATIVE_Z, url: "sky-horizontal.jpg", size: 512 },
];

/**
 * @param {WebGLRenderingContext} gl
 * @param {Program} prog
 * @param {number} inputTextureUnit
 * @param {WebGLFramebuffer} outputBuffer
 * @param {number} size
 * @param {number} subSize
 * @param {number} horizontal
 */
function fftStep(gl, prog, inputTextureUnit, outputBuffer, size, subSize, horizontal) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, outputBuffer);
    // TODO: this might be wrong
    gl.viewport(0, 0, size, size);
    prog.setUniforms(gl, {"u_input": inputTextureUnit, "u_subsize": subSize, "u_horizontal": horizontal});
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

/**
 * @param {WebGLRenderingContext} gl
 * @param {Program} prog
 * @param {string} input
 * @param {string} output
 * @param {object} params
 */
function fft(gl, prog, bufferA, bufferB, params) {
    gl.useProgram(prog.prog)
    prog.setUniforms(gl, {"u_size": params.modes});

    let inputs = [TEXTURE_UNITS[bufferA], TEXTURE_UNITS[bufferB]];
    let outputs = [FRAMEBUFFERS[bufferB], FRAMEBUFFERS[bufferA]];

    let k = Math.log2(params.modes);
    for (let i = 0; i < 2 * k; i++) {
        let subSize = 2 * Math.pow(2, i % k);
        fftStep(gl, prog, inputs[i % 2], outputs[i % 2], 2**k, subSize, i >= k ? 1 : 0);
    }
}

const Waves = class {
    constructor (shaders) {
        this.gl = document.querySelector("canvas").getContext("webgl2");

        if(!this.gl.getExtension("EXT_color_buffer_float")) {
            console.log("extension for rendering to float textures does not load");
            return;
        }

        this.params = SIMULATION_PARAMS;
        buildControls("simulation-controls", this.params);

        this.view = VIEW_PARAMS;
        buildControls("view-controls", this.view);

        const bindings2d = { "a_position": ATTRIBUTE_LOCATIONS["position"] };
        const bindings3d = {
            "a_mappos": ATTRIBUTE_LOCATIONS["mappos"],
            "a_vertexpos": ATTRIBUTE_LOCATIONS["vertexpos"]
        };

        this.programs = {
            init: new Program(this.gl, shaders["vertexShader2D"], shaders["fragmentShaderWaveInit"], bindings2d),
            conjugation: new Program(this.gl, shaders["vertexShader2D"], shaders["fragmentShaderConjugation"], bindings2d),
            timeEvolution: new Program(this.gl, shaders["vertexShader2D"], shaders["fragmentShaderTime"], bindings2d),
            normals: new Program(this.gl, shaders["vertexShader2D"], shaders["fragmentShaderNormals"], bindings2d),
            fft: new Program(this.gl, shaders["vertexShader2D"], shaders["fragmentShaderFFT"], bindings2d),
            sky: new Program(this.gl, shaders["vertexShader2D"], shaders["fragmentShaderSky"], bindings2d),
            ocean: new Program(this.gl, shaders["vertexShader3D"], shaders["fragmentShaderOcean"], bindings3d),
        };

        this.buffers = { positions2D: this.gl.createBuffer(), positions3D: this.gl.createBuffer(), indices3D: this.gl.createBuffer() };

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffers["positions2D"]);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array([-1.0, -1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 1.0]), this.gl.STATIC_DRAW);

        this.t = 0.0;
        this.channel = 0;
        this.numIndices = 0;
        this.indexType = 0;
        this.paused = true;

        initializeCubeMap(this.gl, CUBE_TEXTURE_UNIT, CUBE_FACES);

        this.initSimulation();
        this.initView();
        window.requestAnimationFrame(() => this.render());
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

        const numSamples = this.params.modes / 2;
        const repeat = 3;
        let positions3D = new Float32Array({length: 5 * numSamples * numSamples});

        let indices3D;
        if (numSamples * numSamples < 2**16) {
            indices3D = new Uint16Array({length: 6 * (numSamples - 1) * (numSamples - 1)});
            this.indexType = this.gl.UNSIGNED_SHORT;
        } else {
            indices3D = new Uint32Array({length: 6 * (numSamples - 1) * (numSamples - 1)});
            this.indexType = this.gl.UNSIGNED_INT;
        }
        this.numIndices = indices3D.length;

        for (let y = 0; y < numSamples; y++) {
            for (let x = 0; x < numSamples; x++) {
                let pos_ix = (y * numSamples + x) * 5;
                positions3D[pos_ix + 0] = repeat * x / (numSamples - 1);
                positions3D[pos_ix + 1] = repeat * y / (numSamples - 1);
                positions3D[pos_ix + 2] = repeat * (x / (numSamples - 1) * this.params.scale - this.params.scale / 2);
                positions3D[pos_ix + 3] = repeat * (y / (numSamples - 1) * this.params.scale - this.params.scale / 2);
                positions3D[pos_ix + 4] = 0.0;

                let ind_ix = (y * (numSamples - 1) + x) * 6;
                if (ind_ix + 5 > this.numIndices) {
                    continue;
                }
                indices3D[ind_ix + 0] = y * numSamples + x;
                indices3D[ind_ix + 1] = (y + 1) * numSamples + x;
                indices3D[ind_ix + 2] = (y + 1) * numSamples + x + 1;
                indices3D[ind_ix + 3] = indices3D[ind_ix + 2];
                indices3D[ind_ix + 4] = y * numSamples + x + 1;
                indices3D[ind_ix + 5] = indices3D[ind_ix + 0];
            }
        }

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffers["positions3D"]);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, positions3D, this.gl.STATIC_DRAW);

        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.buffers["indices3D"]);
        this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, indices3D, this.gl.STATIC_DRAW);

        this.gl.useProgram(this.programs.conjugation.prog);
        this.programs.conjugation.setUniforms(this.gl, {
            "u_modes": [this.params.modes, this.params.modes],
        });

        this.gl.useProgram(this.programs.timeEvolution.prog);
        this.programs.timeEvolution.setUniforms(this.gl, {
            "u_modes": [this.params.modes, this.params.modes],
            "u_scales": [this.params.scale, this.params.scale],
            "u_chopping": this.params.chopping,
        });

        this.gl.useProgram(this.programs.normals.prog);
        this.programs.normals.setUniforms(this.gl, {"u_modes": [this.params.modes, this.params.modes]});

        for (const name of Object.keys(TEXTURE_UNITS)) {
            // TODO if possible destroy existing framebuffers and textures
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
                              this.gl.REPEAT,
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
        this.useFramebuffer("outputA", this.params.modes, this.params.modes);
        this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);

        this.gl.useProgram(this.programs.conjugation.prog);
        this.programs.conjugation.setUniforms(this.gl, {"u_input": TEXTURE_UNITS.outputA});
        this.useFramebuffer("amplitudes", this.params.modes, this.params.modes);
        this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);

        this.params.changed = false;
    }

    initView () {
        const aspectRatio = (this.gl.canvas.width / this.gl.canvas.height);
        const x = this.view.top;
        const projMat = mat.perspectiveProjection(-x / aspectRatio, x / aspectRatio, -x, x, 0.1, 10);

        const cameraPos = [0.0, 0.0, this.view.cameraZ];
        const target = [
            1.0 * Math.sin(this.view.angZ * Math.PI / 180),
            -1.0 * Math.cos(this.view.angZ * Math.PI / 180),
            0.0,
        ];
        const lookAt = mat.lookAt(cameraPos, target, [0, 0, 1]);
        const viewMat = mat.rotateY(
            mat.rotateX(
                mat.scale(lookAt, 1, 1, 1/3),
                this.view.angX * Math.PI / 180
            ),
            this.view.angY * Math.PI / 180,
        );

        this.gl.useProgram(this.programs.ocean.prog);
        this.programs.ocean.setUniforms(this.gl, {
            "u_scales": [this.params.scale, this.params.scale],
            "u_n1": 1.0,
            "u_n2": 1.34,
            "u_lightdir": [1.5, 0.0, 1.0],
            "u_camerapos": cameraPos,
            "u_skycolor": this.view.skyColor,
            "u_suncolor": this.view.sunColor,
            "u_watercolor": this.view.waterColor,
            "u_aircolor": this.view.airColor,
            // "u_cubemap": 2,
        });
        this.gl.uniformMatrix4fv(this.programs.ocean.uniforms["u_projection"][0], false, projMat);
        this.gl.uniformMatrix4fv(this.programs.ocean.uniforms["u_view"][0], false, viewMat);

        this.gl.useProgram(this.programs.sky.prog);
        this.programs.sky.setUniforms(this.gl, {
            "u_skycolor": this.view.skyColor,
        });
        // this.gl.uniformMatrix4fv(this.programs.sky.uniforms["u_projection"][0], false, projMat);
        // this.gl.uniformMatrix4fv(this.programs.sky.uniforms["u_view"][0], false, viewMat);

        this.gl.clearColor(...this.view.skyColor, 1.0);

        this.view.changed = false;
    }

    render () {
        this.gl.disable(this.gl.DEPTH_TEST);

        if (this.params.changed) {
            this.initSimulation();
            this.initView();
        }

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffers.positions2D);
        this.gl.enableVertexAttribArray(ATTRIBUTE_LOCATIONS.position);
        this.gl.vertexAttribPointer(ATTRIBUTE_LOCATIONS.position, 2, this.gl.FLOAT, false, 0, 0);

        this.gl.useProgram(this.programs.timeEvolution.prog);
        this.programs.timeEvolution.setUniforms(this.gl, {"u_input": TEXTURE_UNITS.amplitudes, "u_t": this.t});
        this.useFramebuffer("outputB", this.params.modes, this.params.modes);
        this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);

        fft(this.gl, this.programs.fft, "outputB", "outputA", this.params);

        // Normals
        this.gl.useProgram(this.programs.normals.prog);
        this.programs.normals.setUniforms(this.gl, {"u_displacements": TEXTURE_UNITS.outputB});
        this.useFramebuffer("outputA", this.params.modes, this.params.modes);
        this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);

        if (this.view.changed) {
            this.initView();
        }

        this.useFramebuffer("canvas", this.gl.canvas.width, this.gl.canvas.height);
        this.gl.enable(this.gl.DEPTH_TEST);
        this.gl.clear(this.gl.DEPTH_BUFFER_BIT);
        this.gl.depthFunc(this.gl.LEQUAL);

        this.gl.useProgram(this.programs.sky.prog);
        this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);

        this.gl.disableVertexAttribArray(ATTRIBUTE_LOCATIONS.position);

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffers["positions3D"]);
        this.gl.enableVertexAttribArray(ATTRIBUTE_LOCATIONS.vertexpos);
        this.gl.vertexAttribPointer(ATTRIBUTE_LOCATIONS.vertexpos, 3, this.gl.FLOAT, false, 5 * FLOAT_SIZE, 2 * FLOAT_SIZE);

        this.gl.enableVertexAttribArray(ATTRIBUTE_LOCATIONS.mappos);
        this.gl.vertexAttribPointer(ATTRIBUTE_LOCATIONS.mappos, 2, this.gl.FLOAT, false, 5 * FLOAT_SIZE, 0);

        this.gl.useProgram(this.programs.ocean.prog);
        this.programs.ocean.setUniforms(this.gl, {
            "u_displacements": TEXTURE_UNITS.outputB,
            "u_normals": TEXTURE_UNITS.outputA,
        });
        this.gl.drawElements(this.gl.TRIANGLES, this.numIndices, this.indexType, 0);

        this.t += 0.1;
        if (!this.paused) {
            window.setTimeout(() => window.requestAnimationFrame(() => this.render()), this.view.interval);
        }
    }

    togglePaused () {
        this.paused = !this.paused;
        if (!this.paused) {
            window.requestAnimationFrame(() => this.render());
        }
    }
}

window.onload = async function(ev) {
    const shaderSources = await loadShaderSources(SHADER_SOURCES);

    const waves = new Waves(shaderSources);

    window.addEventListener("keydown", function (ev) {
        switch (ev.key) {
        case " ":
            waves.togglePaused();
            ev.preventDefault();
            break;
        case "ArrowRight":
            waves.view.step(ev.shiftKey ? "angY" : "angZ", +1);
            ev.preventDefault();
            break;
        case "ArrowLeft":
            waves.view.step(ev.shiftKey ? "angY" : "angZ", -1);
            ev.preventDefault();
            break;
        case "ArrowUp":
            if (ev.shiftKey) {
                waves.view.step("cameraZ", +0.1);
            } else {
                waves.view.step("angX", +1);
            }
            ev.preventDefault();
            break;
        case "ArrowDown":
            if (ev.shiftKey) {
                waves.view.step("cameraZ", -0.1);
            } else {
                waves.view.step("angX", -1);
            }
            ev.preventDefault();
            break;
        case "+":
            waves.view.update("top", Math.max(0.01, waves.view["top"] - 0.05));
            ev.preventDefault();
            break;
        case "-":
            waves.view.update("top", Math.max(0.01, waves.view["top"] + 0.05));
            ev.preventDefault();
            break;
        default:
            break;
        }
    });

    const canvas = document.querySelector("canvas");

    canvas.addEventListener("mousemove", function (ev) {
        if (ev.buttons == 0) {
            return;
        }
        if (ev.shiftKey) {
            waves.view.update("cameraZ", waves.view["cameraZ"] + ev.movementY / 10);
        } else {
            waves.view.update("angZ", waves.view["angZ"] + ev.movementX);
            waves.view.update("angX", waves.view["angX"] + ev.movementY);
        }
    });

    canvas.addEventListener("wheel", function (ev) {
        if (ev.deltaY < 0) {
            waves.view.update("top", Math.max(0.01, waves.view["top"] - 0.05));
        } else {
            waves.view.update("top", Math.max(0.01, waves.view["top"] + 0.05));
        }
        ev.preventDefault();
    });

}
