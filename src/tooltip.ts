import * as d3 from "d3";
import { clamp } from "./lib/clamp";
import { getWindowWidth } from "./lib/getWindowWidth";

let windowWidth = getWindowWidth();

window.addEventListener("resize", () => {
    windowWidth = getWindowWidth();
});

export function showTooltip(event: any, htmlProvider: () => string) {
    const tooltipWidth = 300; // Matches the CSS value
    const tooltipLeft = event.pageX + 20;

    const left = clamp(tooltipLeft, 0, windowWidth - tooltipWidth);

    d3.select("#tooltip")
        .style("display", "flex")
        .style("top", event.pageY - 170 + "px")
        .style("left", left + "px")
        .html(htmlProvider);
}

export function hideTooltip() {
    d3.select("#tooltip").style("display", "none");
}
