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
 * @param {!WebGLShader} vertexShader
 * @param {!WebGLShader} fragmentShader
 *
 * @return {Program}
 */
function Program(gl, vertexShader, fragmentShader) {
    this.prog = gl.createProgram();
    
    gl.attachShader(this.prog, vertexShader);
    gl.attachShader(this.prog, fragmentShader);

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

/**
 * @param {!WebGLRenderingContext} gl
 * @param {!WebGLShader} vertexShader
 * @param {!WebGLShader} fragmentShader
 *
 * @return {!WebGLProgram}
 */
function createProgram(gl, vertexShader, fragmentShader) {
    var prog = gl.createProgram();

    gl.attachShader(prog, vertexShader);
    gl.attachShader(prog, fragmentShader);

    gl.linkProgram(prog);

    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        throw "Failed to create program: " + gl.getProgramInfoLog(prog);
    }

    return prog;
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

/**
 * @param {Float32Array} vec
 *
 * @return number
 */
function magnitude(vec) {
    return dot(vec, vec);
}

/**
 * @param {Float32Array} a
 * @param {Float32Array} b
 *
 * @return number
 */
function dot(a, b) {
    let d = 0;
    for (let i = 0; i < a.length; i++) {
        d += a[i] * b[i];
    }
    return d;
}

export { Program, compileShader, createTexture, createFramebuffer, magnitude, dot };
