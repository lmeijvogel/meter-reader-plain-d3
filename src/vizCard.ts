export function setCardTitle(selection: d3.Selection<d3.BaseType, unknown, HTMLElement, any>, title: string) {
    const titleElement = selection.select(".title");

    titleElement.text(title);
}

export function onCardTitleClick(selection: d3.Selection<d3.BaseType, unknown, HTMLElement, any>, callback: () => void) {
    const titleElement = selection.select(".title");

    titleElement.on('click', callback);
    titleElement.classed('clickable', true);
}

export function setCardTitleRaw(selection: d3.Selection<d3.BaseType, unknown, HTMLElement, any>, title: string, classes: string) {
    const titleElement = selection.select(".title");

    titleElement.classed(classes, true);
    titleElement.html(title);
}

export function createSvgCard(id: string, container: HTMLElement) {
    const div = document.createElement("div");

    // Start with title = '&nbsp;' so it starts with the correct height.
    // This prevents a jump when the element does get its title.
    div.innerHTML = `<h3 class="title">&nbsp;</h3>
            <div class="chartContainer">
                <div class="overlay" style="">
                    <i class="spinner-icon"  icon-name="loader-2"></i>
                </div>
                <svg class="chart"></svg>
            </div>`;

    div.classList.add("card");
    div.id = id;

    container.append(div);
}
