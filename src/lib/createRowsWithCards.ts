import { createSvgCard } from "../vizCard";

export function createRowsWithCards(rows: string[][], containerId: string) {
    const cardsContainer = document.getElementById(containerId)!;

    for (const itemsPerRow of rows) {
        const row = document.createElement("div");
        row.classList.add("row");
        cardsContainer.appendChild(row);

        for (const id of itemsPerRow) {
            createSvgCard(id, row);
        }
    }
}
