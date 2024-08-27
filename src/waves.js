const vs = `
attribute vec4 position;

void main() {
  gl_Position = position;
  gl_PointSize = 5.0;
}
`;

const fs = `
precision mediump float;

uniform vec4 color;

void main() {
  gl_FragColor = color;
}
`;

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

const main = function() {
    const gl = document.querySelector("canvas").getContext("webgl");

    const prog = createProgram(gl, compileShader(gl, vs, gl.VERTEX_SHADER), compileShader(gl, fs, gl.FRAGMENT_SHADER));
    const positionLoc = gl.getAttribLocation(prog, "position");
    const colorLoc = gl.getUniformLocation(prog, "color");

    gl.useProgram(prog);

    const N = 40;
    for (let i = 0; i < N; i++) {
        const u = i / (N - 1) * 2 - 1;
        gl.vertexAttrib2f(positionLoc, u, 0);
        gl.uniform4f(colorLoc, u, 0, 0, 1);
        gl.drawArrays(gl.POINTS, 0, 1);

        gl.vertexAttrib2f(positionLoc, 0, u);
        gl.uniform4f(colorLoc, 0, u, 0, 1);
        gl.drawArrays(gl.POINTS, 0, 1);
    }
}

window.onload = function(ev) {
    console.log("loaded");
    main();
}
