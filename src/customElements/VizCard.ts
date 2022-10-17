export function defineWebComponents() {
    customElements.define("viz-card", VizCard);
}

export function setCardTitle(selector: string, title: string) {
    const titleElement = document.getElementsByClassName(selector)[0];

    if (!titleElement) {
        throw new Error(`Could not find selector ${selector}`);
    }
    titleElement.textContent = title;
}

class VizCard extends HTMLElement {
    constructor() {
        super();

        const shadowRoot = this.attachShadow({ mode: "open" });

        const template = document.getElementById("card-template")! as HTMLTemplateElement;
        const templateContent = template!.content;

        // This breaks the <slot> mechanism
        // this.appendChild(templateContent.cloneNode(true));
        shadowRoot.appendChild(templateContent.cloneNode(true));
    }
}
