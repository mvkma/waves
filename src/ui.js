/**
 * @param {string} parentId
 * @param {object} params
 */
function buildControls(parentId, params) {
    const parent = document.querySelector(`#${parentId}`);

    while (parent.firstChild) {
        parent.removeChild(parent.firstChild);
    }

    for (const k of Object.keys(params)) {
        const param = params[k];

        const label = document.createElement("label");
        label.setAttribute("for", k);
        label.textContent = param.name + ":";

        const input = document.createElement("input");
        input.type = param.type;
        if (param.attributes) {
            Object.keys(param.attributes).forEach(k => input.setAttribute(k, param.attributes[k]));
        }
        input.value = param.value;
        input.addEventListener("input", (ev) => param.onChange(ev.target.value));

        const container = document.createElement("div");
        container.setAttribute("class", "param-row");
        container.appendChild(label);
        container.appendChild(input);

        parent.appendChild(container);
    }
}

export { buildControls };
