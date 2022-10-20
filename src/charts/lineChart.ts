import * as d3 from "d3";
import { PeriodDescription } from "../models/PeriodDescription";
import { ValueWithTimestamp } from "../models/ValueWithTimestamp";

import { format } from "date-fns";
import { getWindowWidth } from "../lib/getWindowWidth";
import { assertNever } from "../lib/assertNever";

type SeriesCollection = Map<string, { series: ValueWithTimestamp[]; lineColor: string }>;

type Store = {
    fillArea?: boolean;
    lineColors?: Map<string, string>;
    defaultLineColor: string;
    minMaxCalculation: "explicit" | "minMax" | "quantile";
    tooltipDateFormat: string;
    tooltipValueFormat: string;
    tooltipDisplayableUnit: string;
    seriesCollection: SeriesCollection;
    domain?: [number, number];
};

const padding = {
    top: 10,
    right: 30,
    bottom: 10,
    left: 10
};

const width = 480;
const height = 240;

const axisWidth = 50;

export function lineChart(periodDescription: PeriodDescription) {
    const store: Store = {
        fillArea: false,
        lineColors: new Map(),
        defaultLineColor: "black",
        tooltipDateFormat: "eee yyyy-MM-dd HH:mm",
        tooltipValueFormat: "%d",
        tooltipDisplayableUnit: "",
        minMaxCalculation: "explicit",
        seriesCollection: new Map()
    };

    let firstDrawCall = true;

    let windowWidth = getWindowWidth();

    window.addEventListener("resize", () => {
        windowWidth = getWindowWidth();
    });

    const minimumX = padding.left + axisWidth;
    const maximumX = width - padding.right;
    const minimumY = padding.top;
    const maximumY = height - padding.bottom;

    const scaleX = d3.scaleTime().range([minimumX, maximumX]);
    const scaleY = d3.scaleLinear().range([minimumY, maximumY]).clamp(true);

    const yAxis = d3.axisLeft(scaleY);

    const api = {
        setSeries(name: string, series: ValueWithTimestamp[], lineColor: string) {
            store.seriesCollection.set(name, { series, lineColor });

            return api;
        },

        domain(domain: [number, number]) {
            store.domain = domain;
            store.minMaxCalculation = "explicit";

            return api;
        },

        minMaxCalculation: (method: "minMax" | "quantile") => {
            store.minMaxCalculation = method;

            return api;
        },

        tooltipDateFormat: (format: string) => {
            store.tooltipDateFormat = format;

            return api;
        },

        tooltipDisplayableUnit: (unit: string) => {
            store.tooltipDisplayableUnit = unit;

            return api;
        },

        tooltipValueFormat: (format: string) => {
            store.tooltipValueFormat = format;

            return api;
        },

        call: (selection: d3.Selection<d3.BaseType, unknown, HTMLElement, any>) => {
            const brush = d3.brushX();
            brush.extent([
                [minimumX, minimumY],
                [maximumX, maximumY]
            ]);

            brush.on("brush", showBrushTooltip);
            selection.select(".brush").call(brush as any);

            selection.attr("viewBox", `0 0 ${width} ${height}`);

            selection.on("mouseover", () => {
                d3.select("#tooltip").style("display", "flex");
            });

            selection.on("mouseout", () => {
                d3.select("#tooltip").style("display", "none");
            });

            selection.on("mousemove", (event) => {
                if (store.seriesCollection.size === 0) {
                    return;
                }

                const tooltipWidth = 250; // Matches the CSS value
                const tooltipX = event.pageX;

                const tooltipSelector = d3.select("#tooltip");

                const left = clamp(tooltipX, 0, windowWidth - tooltipWidth);

                tooltipSelector
                    .style("top", event.pageY - 170 + "px")
                    .style("left", left + "px")

                    .html(() => {
                        // This allows to find the closest X index of the mouse:
                        return getHoverTooltipContents(event);
                    });
            });

            const domainX = [periodDescription.startOfPeriod(), periodDescription.endOfPeriod()];

            scaleX.domain(domainX);

            const domain = store.domain ?? getDomainY();

            const xAxisHeight = 20;
            scaleY.domain(domain).range([height - padding.bottom - xAxisHeight, padding.top]);

            if (firstDrawCall) {
                firstDrawCall = false;

                addSvgChildTags(selection);
            }

            renderXAxis(selection.select(".xAxis"));
            selection
                .select(".yAxis")
                .attr("transform", `translate(${padding.left + axisWidth}, 0)`)
                .style("font-size", "13pt")
                .call(yAxis as any);

            store.seriesCollection.forEach((series, name) => {
                const seriesGClassName = `series_${name}`;

                let g = selection.select<SVGGElement>(`.${seriesGClassName}`);

                if (!g.node()) {
                    g = selection.append("g");
                    g.attr("class", seriesGClassName).attr("width", width).attr("height", height);
                }

                drawValues(series.series, series.lineColor, g);
            });

            return api;
        }
    };

    function drawValues(
        series: ValueWithTimestamp[],
        lineColor: string,
        selection: d3.Selection<SVGGElement, unknown, HTMLElement, any>
    ) {
        const lineGenerator = d3
            .line<ValueWithTimestamp>()
            .x((d) => scaleX(d.timestamp))
            .y((d) => scaleY(d.value));

        selection
            .selectAll(`path.line`)
            .data([series])
            .join("path")
            .attr("class", `line`)
            .attr("fill", "none")
            .attr("stroke", lineColor)
            .attr("stroke-width", 2)
            .attr("d", lineGenerator);
    }

    function addSvgChildTags(selection: d3.Selection<d3.BaseType, unknown, HTMLElement, any>) {
        ["gridLines", "additionalInfo", "values", "xAxis", "yAxis", "brush"].forEach((className) => {
            const g = selection.append("g");

            g.attr("class", className);
        });
    }

    function renderXAxis(xAxisBase: d3.Selection<d3.BaseType, unknown, HTMLElement, any>) {
        const ticks = periodDescription.getChartTicks();
        const xAxis = d3.axisBottom(scaleX as any).ticks(ticks, d3.timeFormat(periodDescription.timeFormatString()));

        xAxisBase.attr("transform", `translate(0, ${scaleY(0)})`).call(xAxis as any);
    }

    function getDomainY(): number[] {
        if (store.minMaxCalculation === "explicit") {
            return store.domain!;
        }

        const allValues = Array.from(store.seriesCollection.values()).flatMap((series) =>
            series.series.map((s) => s.value)
        );

        if (store.minMaxCalculation === "quantile") {
            const min = Math.min(...allValues) * 0.95;
            const max = d3.quantile(allValues, 0.95)! * 1.5;

            return [min, max];
        } else if (store.minMaxCalculation === "minMax") {
            const min = Math.min(...allValues) * 0.95;
            const max = Math.max(...allValues) * 1.1;

            return [min, max];
        } else {
            assertNever(store.minMaxCalculation);
        }
    }

    function showBrushTooltip(event: any) {
        d3.select("#tooltip").style("display", "flex");

        const sourceEvent = event.sourceEvent;

        const tooltipWidth = 250; // Matches the CSS value

        const tooltipLeft = sourceEvent.pageX + 20;

        const left = clamp(0, tooltipLeft, windowWidth - tooltipWidth);

        const tooltipSelector = d3.select("#tooltip");
        tooltipSelector
            .style("top", sourceEvent.pageY - 170 + "px")
            .style("left", left + "px")
            .html(() => getBrushTooltipContents(event));
    }

    function getHoverTooltipContents(event: any): string {
        var bisect = d3.bisector((d: ValueWithTimestamp) => d.timestamp).right;

        const pointerX = d3.pointer(event)[0];
        const pointerDate = scaleX.invert(pointerX);

        const ys = Array.from(store.seriesCollection.keys()).map((key) => {
            const series = store.seriesCollection.get(key)!;

            var closestIndex = bisect(series.series, pointerDate, 1) - 1;

            return {
                name: key,
                value: series.series[closestIndex]?.value
            };
        });

        const dateString = format(pointerDate, store.tooltipDateFormat);

        const valueLines = ys
            .map(({ name, value }) => {
                return `<tr>
                                            <td>${name}:</td>
                                            <td class="tableValue">${renderDisplayValue(value)}</td>
                                        </tr>`;
            })
            .join("");
        return `<b>${dateString}</b><table><tbody>${valueLines}</tbody></table>`;
    }

    function getBrushTooltipContents(event: any): string {
        // This allows to find the closest X index of the mouse:
        var bisect = d3.bisector((d: ValueWithTimestamp) => d.timestamp).right;

        const pointerStartDate = scaleX.invert(event.selection[0]);
        const pointerEndDate = scaleX.invert(event.selection[1]);

        const displayValues: Map<string, { min: number; max: number; mean: number }> = new Map();

        for (const series of Array.from(store.seriesCollection.entries())) {
            const startIndex = bisect(series[1].series, pointerStartDate, 1) - 1;
            const endIndex = bisect(series[1].series, pointerEndDate, 1) - 1;

            const relevantEntries = series[1].series.slice(startIndex, endIndex);

            const [min, max] = d3.extent(relevantEntries, (v) => v.value);

            displayValues.set(series[0], {
                min: min ?? 0,
                mean: d3.mean(relevantEntries, (v) => v.value) ?? 0,
                max: max ?? 0
            });
        }

        const startDateString = format(pointerStartDate, store.tooltipDateFormat);
        const endDateString = format(pointerEndDate, store.tooltipDateFormat);

        return `${startDateString} - ${endDateString}<br>
                <dl>${renderBrushTooltipDisplayValues(displayValues).join("")}</dl>
                `;
    }

    function renderBrushTooltipDisplayValues(displayValues: Map<string, { min: number; max: number; mean: number }>) {
        let result: string[] = [];

        for (const [name, values] of Array.from(displayValues)) {
            result.push(`<dt>${name}:</dt>`);
            result.push(
                `<dd>
                <table>
                  <tbody>
                    <tr><td>Min:</td><td class="tableValue"><b>${renderDisplayValue(values.min)}</b></td></tr>
                    <tr><td>Gem.:</td><td class="tableValue"><b>${renderDisplayValue(values.mean)}</b></td></tr>
                    <tr><td>Max:</td><td class="tableValue"><b>${renderDisplayValue(values.max)}</b></td></tr>
                  </tbody>
                </table>
                 </dd>`
            );
        }

        return result;
    }

    function renderDisplayValue(value: number) {
        return `${d3.format(store.tooltipValueFormat)(value)} ${store.tooltipDisplayableUnit}`;
    }

    return api;
}

function clamp(n: number, min: number, max: number): number {
    if (n < min) {
        return min;
    }

    if (n > max) {
        return max;
    }

    return n;
}
