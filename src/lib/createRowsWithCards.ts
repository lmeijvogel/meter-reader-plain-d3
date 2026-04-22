import { createDivCard, createSvgCard } from "../vizCard";

export type CardSpec = string | { id: string; svg: true };

export function createRowsWithCards(rows: CardSpec[][], containerSelector: string) {
    const cardsContainer = document.querySelector(containerSelector)!;

    for (const itemsPerRow of rows) {
        const row = document.createElement("div");
        row.classList.add("row");
        cardsContainer.appendChild(row);

        for (const spec of itemsPerRow) {
            if (typeof spec === "string") {
                createDivCard(spec, row);
            } else {
                createSvgCard(spec.id, row);
            }
        }
    }
}
