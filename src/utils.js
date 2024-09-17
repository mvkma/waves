/**
 * @param {!WebGLRenderingContext} gl
 * @param {string} source
 * @param {number} type
 *
 * @return {!WebGLShader}
 */
function compileShader(gl, source, type) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, source);

    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw "Shader compilation error: " + gl.getShaderInfoLog(shader);
    }

    return shader;
}

/**
 * @param {!WebGLRenderingContext} gl
 * @param {!number} textureUnit
 * @param {!number} width
 * @param {!number} height
 * @param {!number} internalFormat
 * @param {!number} format
 * @param {!number} type
 * @param {ArrayBufferView | null} pixels
 *
 * @return {!WebGLTexture}
 */
function createTexture(gl, textureUnit, width, height, internalFormat, format, type, filterParam, clampParam, pixels) {
    var texture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + textureUnit);
    gl.bindTexture(gl.TEXTURE_2D, texture);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filterParam);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filterParam);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, clampParam);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, clampParam);

    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, width, height, 0, format, type, pixels);

    return texture;
}

/**
 * @param {!WebGLRenderingContext} gl
 * @param {!WebGLTexture} texture
 *
 * @return {!WebGLFramebuffer}
 */
function createFramebuffer(gl, texture) {
    var fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

    return fb;
}

const Program = class {
    /**
     * @param {!WebGLRenderingContext} gl
     * @param {!string} vertexShaderSrc
     * @param {!string} fragmentShaderSrc
     * @param {!object} attribBindings
     *
     * @return {Program}
     */
    constructor(gl, vertexShaderSrc, fragmentShaderSrc, attribBindings) {
        this.prog = gl.createProgram();

        gl.attachShader(this.prog, compileShader(gl, vertexShaderSrc, gl.VERTEX_SHADER));
        gl.attachShader(this.prog, compileShader(gl, fragmentShaderSrc, gl.FRAGMENT_SHADER));

        for (let attrib in attribBindings) {
            gl.bindAttribLocation(this.prog, attribBindings[attrib], attrib);
        }

        gl.linkProgram(this.prog);

        if (!gl.getProgramParameter(this.prog, gl.LINK_STATUS)) {
            throw "Failed to create program: " + gl.getProgramInfoLog(this.prog);
        }

        this.uniforms = {};
        var n = gl.getProgramParameter(this.prog, gl.ACTIVE_UNIFORMS);
        for (var i = 0; i < n; i++) {
            var uniform = gl.getActiveUniform(this.prog, i);
            var location = gl.getUniformLocation(this.prog, uniform.name);
            this.uniforms[uniform.name] = location;
        }
    }
}

const SimulationParameters = class {
    constructor () {
        /** @type {number} */
        this.modes = 512;

        /** @type {number} */
        this.scale = 200;

        /** @type {number} */
        this.g = 9.81;

        /** @type {number} */
        this.wind_x = 10.0;

        /** @type {number} */
        this.wind_y = 15.0;

        /** @type {number} */
        this.cutoff = 1.0;

        /** @type {number} */
        this.amp = 1 / 512 / 50; // TODO

        /** @type {bool} */
        this.changed = false;
    }

    update(key, value) {
        this[key] = value;
        this.changed = true;
    }

    getParameters() {
        return {
            "modes": {
                type: "range",
                value: this.modes,
                attributes: { min: 4, max: 12, step: 1 },
                name: "FFT size",
                onChange: (n) => this.update("modes", 2**parseInt(n)),
            },
            "scale": {
                type: "range",
                value: this.scale,
                attributes: { min: 50, max: 1000, step: 50 },
                name: "Scale",
                onChange: (n) => this.update("scale", parseInt(n)),
            },
            "wind_x": {
                type: "range",
                value: this.wind_x,
                attributes: { min: 0, max: 50, step: 0.5 },
                name: "Wind X",
                onChange: (n) => this.update("wind_x", parseInt(n)),
            },
            "wind_y": {
                type: "range",
                value: this.wind_y,
                attributes: { min: 0, max: 50, step: 0.5 },
                name: "Wind Y",
                onChange: (n) => this.update("wind_y", parseInt(n)),
            },
            "cutoff": {
                type: "range",
                value: this.wind_y,
                attributes: { min: 0, max: 10, step: 0.5 },
                name: "Cutoff",
                onChange: (n) => this.update("cutoff", parseInt(n)),
            },
        };
    }
}


export { Program, SimulationParameters, createTexture, createFramebuffer, };
