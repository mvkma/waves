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

export { compileShader, createProgram, magnitude, dot };
