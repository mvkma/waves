import {
    ParameterGroup,
    vecToColor,
    colorToVec,
} from "./utils.js";

const G = 9.81;

const FLOAT_SIZE = Float32Array.BYTES_PER_ELEMENT;

const SHADER_SOURCES = {
    vertexShader2D: "./src/vertex-shader-2d.glsl",
    vertexShader3D: "./src/vertex-shader-3d.glsl",
    fragmentShaderFFT: "./src/fragment-shader-fft.glsl",
    fragmentShaderOcean: "./src/fragment-shader-ocean.glsl",
    fragmentShaderNormals: "./src/fragment-shader-normals.glsl",
    fragmentShaderConjugation: "./src/fragment-shader-conjugation.glsl",
    fragmentShaderTime: "./src/fragment-shader-time.glsl",
    fragmentShaderWaveInit: "./src/fragment-shader-wave-init.glsl",
};

const VIEW_PARAMS = new ParameterGroup({
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
        value: [0.98, 0.94, 0.42],
        name: "Sky color",
        transformation: (n) => colorToVec(n),
        inverseTransformation: (n) => vecToColor(n),
    },
    "waterColor": {
        type: "color",
        value: [0.0, 0.2, 0.3],
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
        value: -65.0,
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

const SIMULATION_PARAMS = new ParameterGroup({
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

export {
    G,
    FLOAT_SIZE,
    SHADER_SOURCES,
    VIEW_PARAMS,
    SIMULATION_PARAMS
};
