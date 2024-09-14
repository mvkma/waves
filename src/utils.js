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

/**
 * @param {!WebGLRenderingContext} gl
 * @param {!string} vertexShaderSrc
 * @param {!string} fragmentShaderSrc
 * @param {!object} attribBindings
 *
 * @return {Program}
 */
function Program(gl, vertexShaderSrc, fragmentShaderSrc, attribBindings) {
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

export { Program, createTexture, createFramebuffer, };
