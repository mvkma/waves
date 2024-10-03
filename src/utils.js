const WEBGL_UNIFORM_SETTERS = {
    [WebGL2RenderingContext.INT]        : "uniform1i",
    [WebGL2RenderingContext.FLOAT]      : "uniform1f",
    [WebGL2RenderingContext.FLOAT_VEC2] : "uniform2fv",
    [WebGL2RenderingContext.FLOAT_VEC3] : "uniform3fv",
    [WebGL2RenderingContext.SAMPLER_2D] : "uniform1i",
};

/**
 * @param {object} shaderSources
 *
 * @return {object}
 */
async function loadShaderSources(shaderSources) {
    const sources = await Promise.all(Object.values(shaderSources).map((url) => fetch(url).then(r => r.text())));
    return Object.fromEntries(Object.keys(shaderSources).map((k, i) => [k, sources[i]]))
}

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
            this.uniforms[uniform.name] = [location, uniform.type];
        }
    }

    /**
     * @param {WebGLRenderingContext} gl
     * @param {object} uniformValues
     */
    setUniforms(gl, uniformValues) {
        let location, type;
        for (const key of Object.keys(uniformValues)) {
            if (!this.uniforms.hasOwnProperty(key)) {
                console.log(`uniform '${key}' does not exist`);
                continue;
            }
            [location, type] = this.uniforms[key];
            gl[WEBGL_UNIFORM_SETTERS[type]](location, uniformValues[key]);
        }
    }
}

/**
 * @param {string} color
 *
 * @return {number[]}
 */
function colorToVec(color) {
    return [1, 3, 5].map(ix => parseInt(color.slice(ix, ix + 2), 16) / 255);
}

/**
 * @param {number[]} vec
 *
 * @return {string}
 */
function vecToColor(vec) {
    return "#" + vec.map(x => Math.round(x * 255).toString(16).padStart(2, "0")).reduce((a, b) => a + b, "");
}

const ParameterGroup = class {
    constructor(params) {
        this.callbacks = {};
        this.defaults = {};
        this.specs = {};

        for (const [name, spec] of Object.entries(params)) {
            this[name] = spec.value;
            this.callbacks[name] = [];
            this.defaults[name] = spec.value;
            this.specs[name] = spec;
        }

        this.changed = false;
    }

    update(key, value) {
        this[key] = value;
        for (const fn of this.callbacks[key]) {
            fn(value);
        }
        this.changed = true;
    }

    reset() {
        for (const [k, v] of Object.entries(this.defaults)) {
            this[k] = v;
            this.callbacks[k] = [];
        }
    }
}

const viewParameters = new ParameterGroup({
    "diffuse": {
        type: "range",
        value: 0.3,
        attributes: { min: 0, max: 1, step: 0.05 },
        name: "Diffuse",
        transformation: (n) => parseFloat(n),
        inverseTransformation: (n) => n,
    },
    "skyColor": {
        type: "color",
        value: [0.98, 0.94, 0.42], //colorToVec("#50a0dc"),
        name: "Sky color",
        transformation: (n) => colorToVec(n),
        inverseTransformation: (n) => vecToColor(n),
    },
    "waterColor": {
        type: "color",
        value: [0.0, 0.2, 0.3], // colorToVec("#20334d"),
        name: "Water color",
        transformation: (n) => colorToVec(n),
        inverseTransformation: (n) => vecToColor(n),
    },
    "airColor": {
        type: "color",
        value: [0.1, 0.1, 0.1], // colorToVec("#202066"),
        name: "Air color",
        transformation: (n) => colorToVec(n),
        inverseTransformation: (n) => vecToColor(n),
    },
    "angX": {
        type: "range",
        value: 0.0,
        attributes: { min: -180, max: 180, step: 1 },
        name: "Angle X",
        transformation: (n) => parseFloat(n),
        inverseTransformation: (n) => n,
    },
    "angY": {
        type: "range",
        value: 0.0,
        attributes: { min: -180, max: 180, step: 1 },
        name: "Angle Y",
        transformation: (n) => parseFloat(n),
        inverseTransformation: (n) => n,
    },
    "angZ": {
        type: "range",
        value: 0.0,
        attributes: { min: -180, max: 180, step: 1 },
        name: "Angle Z",
        transformation: (n) => parseFloat(n),
        inverseTransformation: (n) => n,
    },
    "interval": {
        type: "range",
        value: 100,
        attributes: { min: 0, max: 200, step: 20 },
        name: "Interval",
        transformation: (n) => parseFloat(n),
        inverseTransformation: (n) => n,
    },
});

const simulationParameters = new ParameterGroup({
    "modes": {
        type: "range",
        value: 512,
        attributes: { min: 4, max: 12, step: 1 },
        name: "FFT size",
        transformation: (n) => 2**parseInt(n),
        inverseTransformation: (n) => Math.log2(n),
    },
    "scale": {
        type: "range",
        value: 200,
        attributes: { min: 50, max: 1000, step: 50 },
        name: "Scale",
        transformation: (n) => parseInt(n),
        inverseTransformation: (n) => n,
    },
    "wind_x": {
        type: "range",
        value: 20.0,
        attributes: { min: 0, max: 50, step: 0.5 },
        name: "Wind X",
        transformation: (n) => parseFloat(n),
        inverseTransformation: (n) => n,
    },
    "wind_y": {
        type: "range",
        value: 18.0,
        attributes: { min: 0, max: 50, step: 0.5 },
        name: "Wind Y",
        transformation: (n) => parseFloat(n),
        inverseTransformation: (n) => n,
    },
    "cutoff": {
        type: "range",
        value: 0.5,
        attributes: { min: 0, max: 10, step: 0.5 },
        name: "Cutoff",
        transformation: (n) => parseFloat(n),
        inverseTransformation: (n) => n,
    },
    "chopping": {
        type: "range",
        value: 0.7,
        attributes: { min: 0, max: 2, step: 0.1 },
        name: "Chopping",
        transformation: (n) => parseFloat(n),
        inverseTransformation: (n) => n,
    },
});


export { Program, simulationParameters, viewParameters, createTexture, createFramebuffer, loadShaderSources };
