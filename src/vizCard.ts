export function setCardTitle(selection: d3.Selection<d3.BaseType, unknown, HTMLElement, any>, title: string) {
    const titleElement = selection.select(".title");

    titleElement.text(title);
}

export function addCards(rowsAndIds: string[][], container: HTMLElement) {
    for (let ids of rowsAndIds) {
        const row = createRow(container);

        for (let id of ids) {
            createSvgCard(id, row);
        }
    }
}

function createSvgCard(id: string, row: HTMLElement) {
    const div = document.createElement("div");

    div.innerHTML = `<h3 class="title"></h3>
            <div class="chartContainer">
                <div class="overlay" style="">
                    <i class="spinner-icon"  icon-name="loader-2"></i>
                </div>
                <svg class="chart"></svg>
            </div>`;

    div.classList.add("card");
    div.id = id;

    row.append(div);

    // div.addEventListener("click", (e: any) => {
    // console.log("card clicked", e);
    // });

    // div.getElementsByClassName("overlay")[0].addEventListener("click", (e) => {
    // console.log("overlay clicked", e);
    // });
}

function createRow(container: HTMLElement) {
    const div = document.createElement("div");
    div.className = "row";

    container.append(div);

    return div;
}
