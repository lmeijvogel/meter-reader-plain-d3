export function defineWebComponents() {
    customElements.define("viz-card", VizCard);
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
