/**
 * @param {Element} parent
 * @param {string} key
 * @param {object} param
 * @param {ParameterGroup} parameterGroup
 */
function buildInputElement(parent, key, param, parameterGroup) {
    const label = document.createElement("label");
    label.setAttribute("for", key);
    label.textContent = param.name + ":";

    const input = document.createElement("input");
    input.type = param.type;
    input.id = key;
    if (param.attributes) {
        Object.keys(param.attributes).forEach(k => input.setAttribute(k, param.attributes[k]));
    }
    input.value = param.inverseTransformation(param.value);
    input.addEventListener("input", function (ev) {
        parameterGroup.update(key, param.transformation(ev.target.value), false)
    });
    input.addEventListener("keydown", function (ev) {
        const step = param.attributes && param.attributes.hasOwnProperty("step") ? param.attributes["step"] : 0;

        switch (ev.key) {
        case "Escape":
            ev.target.blur();
            break;
        case "ArrowRight":
        case "ArrowLeft":
            ev.stopPropagation();
            break;
        case "ArrowUp":
            if (step) {
                parameterGroup.update(key, param.transformation(ev.target.value) + step);
            }
            ev.stopPropagation();
            break;
        case "ArrowDown":
            if (step) {
                parameterGroup.update(key, param.transformation(ev.target.value) - step);
            }
            ev.stopPropagation();
            break;
        default:
            break;
        }
    });
    parameterGroup.callbacks[key].push((value) => input.value = param.inverseTransformation(value));

    const container = document.createElement("div");
    container.setAttribute("class", "param-row");
    container.appendChild(label);
    container.appendChild(input);

    parent.appendChild(container);
}

/**
 * @param {Element} parent
 * @param {string} key
 * @param {object} param
 * @param {ParameterGroup} parameterGroup
 */
function buildSelectElement(parent, key, param, parameterGroup) {
    const label = document.createElement("label");
    label.setAttribute("for", key);
    label.textContent = param.name + ":";

    const select = document.createElement("select");
    select.id = key;
    const options = param.attributes.options;
    let option;
    options.forEach(function (value) {
        option = document.createElement("option");
        option.value = value;
        option.text = value;
        select.appendChild(option);
    });
    select.selectedIndex = options.indexOf(param.value);

    select.addEventListener("input", function (ev) {
        parameterGroup.update(key, options[ev.target.selectedIndex], false)
    });

    parameterGroup.callbacks[key].push((value) => select.selectedIndex = options.indexOf(value));

    const container = document.createElement("div");
    container.setAttribute("class", "param-row");
    container.appendChild(label);
    container.appendChild(select);

    parent.appendChild(container);
}

/**
 * @param {string} parentId
 * @param {ParameterGroup} parameterGroup
 */
function buildControls(parentId, parameterGroup) {
    const parent = document.querySelector(`#${parentId}`);

    while (parent.firstChild) {
        parent.removeChild(parent.firstChild);
    }

    for (const k of Object.keys(parameterGroup.specs)) {
        const param = parameterGroup.specs[k];

        if (param.type === "select") {
            buildSelectElement(parent, k, param, parameterGroup);
        } else {
            buildInputElement(parent, k, param, parameterGroup);
        }
    }
}

export { buildControls };
