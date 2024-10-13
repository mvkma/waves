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
    fragmentShaderSky: "./src/fragment-shader-sky.glsl",
    fragmentShaderOcean: "./src/fragment-shader-ocean.glsl",
    fragmentShaderNormals: "./src/fragment-shader-normals.glsl",
    fragmentShaderConjugation: "./src/fragment-shader-conjugation.glsl",
    fragmentShaderTime: "./src/fragment-shader-time.glsl",
    fragmentShaderWaveInit: "./src/fragment-shader-wave-init.glsl",
    fragmentShaderDebug: "./src/fragment-shader-debug.glsl",
};

const VIEW_PARAMS = new ParameterGroup({
    "skyColor": {
        type: "color",
        value: [0.60, 0.76, 0.95],
        name: "Sky color",
        transformation: (n) => colorToVec(n),
        inverseTransformation: (n) => vecToColor(n),
    },
    "sunColor": {
        type: "color",
        value: [1.0, 1.0, 1.0],
        name: "Sun color",
        transformation: (n) => colorToVec(n),
        inverseTransformation: (n) => vecToColor(n),
    },
    "waterColor": {
        type: "color",
        value: [0.00, 0.04, 0.07],
        name: "Water color",
        transformation: (n) => colorToVec(n),
        inverseTransformation: (n) => vecToColor(n),
    },
    "airColor": {
        type: "color",
        value: [0.01, 0.08, 0.13], // colorToVec("#202066"),
        name: "Air color",
        transformation: (n) => colorToVec(n),
        inverseTransformation: (n) => vecToColor(n),
    },
    "angX": {
        type: "",
        value: 0.0,
        attributes: { maxlength: 5, step: 1.0 },
        name: "Angle X (deg)",
        transformation: (n) => parseFloat(n),
        inverseTransformation: (n) => n.toString().slice(0, 5),
    },
    "angY": {
        type: "",
        value: 0.0,
        attributes: { maxlength: 5, step: 1.0 },
        name: "Angle Y (deg)",
        transformation: (n) => parseFloat(n),
        inverseTransformation: (n) => n.toString().slice(0, 5),
    },
    "angZ": {
        type: "",
        value: -65.0,
        attributes: { maxlength: 5, step: 1.0 },
        name: "Angle Z (deg)",
        transformation: (n) => parseFloat(n),
        inverseTransformation: (n) => n.toString().slice(0, 5),
    },
    "cameraZ": {
        type: "",
        value: 1.5,
        attributes: { maxlength: 5, step: 0.1 },
        name: "Camera height",
        transformation: (n) => parseFloat(n),
        inverseTransformation: (n) => n.toString().slice(0, 5),
    },
    "top": {
        type: "",
        value: 0.1,
        attributes: { maxlength: 5, step: 0.05 },
        name: "Top",
        transformation: (n) => parseFloat(n),
        inverseTransformation: (n) => n.toString().slice(0, 5),
    },
    "interval": {
        type: "",
        value: 100,
        attributes: { maxlength: 5, step: 10 },
        name: "Interval (ms)",
        transformation: (n) => parseFloat(n),
        inverseTransformation: (n) => n.toString().slice(0, 5),
    },
});

const SIMULATION_PARAMS = new ParameterGroup({
    "modes": {
        type: "select",
        value: 512,
        attributes: { options: [16, 32, 64, 128, 256, 512, 1024, 2048] },
        name: "FFT size",
        //transformation: (n) => 2**parseInt(n),
        //inverseTransformation: (n) => Math.log2(n),
    },
    "scale": {
        type: "",
        value: 150,
        attributes: { maxlength: 5, step: 10 },
        name: "Scale",
        transformation: (n) => parseInt(n),
        inverseTransformation: (n) => n.toString().slice(0, 5),
    },
    "wind_x": {
        type: "",
        value: 9.0,
        attributes: { maxlength: 5, step: 1.0 },
        name: "Wind X",
        transformation: (n) => parseFloat(n),
        inverseTransformation: (n) => n.toString().slice(0, 5),
    },
    "wind_y": {
        type: "",
        value: 3.0,
        attributes: { maxlength: 5, step: 1.0 },
        name: "Wind Y",
        transformation: (n) => parseFloat(n),
        inverseTransformation: (n) => n.toString().slice(0, 5),
    },
    "cutoff": {
        type: "",
        value: 0.5,
        attributes: { maxlength: 5, step: 0.1 },
        name: "Cutoff",
        transformation: (n) => parseFloat(n),
        inverseTransformation: (n) => n.toString().slice(0, 5),
    },
    "chopping": {
        type: "",
        value: 0.7,
        attributes: { maxlength: 5, step: 0.1 },
        name: "Chopping",
        transformation: (n) => parseFloat(n),
        inverseTransformation: (n) => n.toString().slice(0, 5),
    },
});

export {
    G,
    FLOAT_SIZE,
    SHADER_SOURCES,
    VIEW_PARAMS,
    SIMULATION_PARAMS
};
