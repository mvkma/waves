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

        const label = document.createElement("label");
        label.setAttribute("for", k);
        label.textContent = param.name + ":";

        const input = document.createElement("input");
        input.type = param.type;
        if (param.attributes) {
            Object.keys(param.attributes).forEach(k => input.setAttribute(k, param.attributes[k]));
        }
        input.value = param.inverseTransformation(param.value);
        input.addEventListener("input", (ev) => parameterGroup.update(k, param.transformation(ev.target.value)));

        const container = document.createElement("div");
        container.setAttribute("class", "param-row");
        container.appendChild(label);
        container.appendChild(input);

        parent.appendChild(container);
    }
}

export { buildControls };
