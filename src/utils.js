const WEBGL_UNIFORM_SETTERS = {
    [WebGL2RenderingContext.INT]          : "uniform1i",
    [WebGL2RenderingContext.FLOAT]        : "uniform1f",
    [WebGL2RenderingContext.FLOAT_VEC2]   : "uniform2fv",
    [WebGL2RenderingContext.FLOAT_VEC3]   : "uniform3fv",
    [WebGL2RenderingContext.SAMPLER_2D]   : "uniform1i",
    [WebGL2RenderingContext.SAMPLER_CUBE] : "uniform1i",
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

export {
    Program,
    ParameterGroup,
    vecToColor,
    colorToVec,
    createTexture,
    createFramebuffer,
    loadShaderSources
};
