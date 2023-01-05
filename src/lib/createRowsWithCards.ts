import { createSvgCard } from "../vizCard";

export function createRowsWithCards(rows: string[][], containerSelector: string) {
    const cardsContainer = document.querySelector(containerSelector)!;

    for (const itemsPerRow of rows) {
        const row = document.createElement("div");
        row.classList.add("row");
        cardsContainer.appendChild(row);

        for (const id of itemsPerRow) {
            createSvgCard(id, row);
        }
    }
}
