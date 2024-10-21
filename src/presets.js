import {
    colorToVec
} from "./utils.js";

const PRESET0 = {
    params: {
        modes: 512,
        scale: 150,
        windX: 11,
        windY: 5,
        cutoff: 0.5,
        chopping: 0.7,
    },
    view: {
        angX: 40,
        angY: 0,
        angZ: 60,
        cameraZ: 1.5,
        top: 0.1,
        interval: 30,
    },
    colors: {
        skyColor: [0.60, 0.76, 0.95],
        sunColor: [1.0, 1.0, 1.0],
        waterColor: [0.00, 0.04, 0.07],
        airColor: [0.01, 0.08, 0.13],
        ambient: 0.25,
        specular: 1.0,
    },
};

const PRESET1 = {
    params: {
        modes: 128,
        scale: 150,
        windX: 11,
        windY: 11,
        cutoff: 0.5,
        chopping: 0.7,
    },
    view: {
        angX: 18,
        angY: 0,
        angZ: 114,
        cameraZ: 0.7,
        top: 0.2,
        interval: 30,
    },
    colors: {
        skyColor: colorToVec("#241f317"),
        sunColor: colorToVec("#c0bfbc7"),
        waterColor: colorToVec("#000a12"),
        airColor: colorToVec("#0314217"),
        ambient: 0.25,
        specular: 1,
    },
};

const PRESET2 = {
    params: {
        modes: 512,
        scale: 150,
        windX: 11,
        windY: 11,
        cutoff: 0.5,
        chopping: 0.7,
    },
    view: {
        angX: 5,
        angY: 0,
        angZ: 40,
        cameraZ: 1.2,
        top: 0.2,
        interval: 30,
    },
    colors: {
        skyColor: colorToVec("#ffbe6f"),
        sunColor: colorToVec("#ffffff"),
        waterColor: colorToVec("#000a12"),
        airColor: colorToVec("#031421"),
        ambient: 0.5,
    }
};

const PRESET3 = {
    params: {
        modes: 1024,
        scale: 150,
        windX: 2,
        windY: 2,
        cutoff: 0.399,
        chopping: 0.5,
    },
    view: {
        angX: -1,
        angY: 0,
        angZ: 104,
        cameraZ: 1.2,
        top: 0.26,
        interval: 30,
    },
    colors: {
        skyColor: colorToVec("#1a5fb4"),
        sunColor: colorToVec("#c0bfbc"),
        waterColor: colorToVec("#031421"),
        airColor: colorToVec("#031421"),
        ambient: 0.299,
        specular: 0.597
    }
}

const PRESETS = {
    preset0: PRESET0,
    preset1: PRESET1,
    preset2: PRESET2,
    preset3: PRESET3,
};

export {
    PRESETS,
};
