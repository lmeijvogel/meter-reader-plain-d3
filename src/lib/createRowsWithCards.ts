import { createDivCard, createSvgCard } from "../vizCard";

/**
 * Plain string id → div card (for ECharts containers).
 * Use { id, svg: true } for charts that still render to an <svg> element.
 */
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
