import * as d3 from "d3";
import { PeriodDescription } from "../models/PeriodDescription";
import { ValueWithTimestamp } from "../models/ValueWithTimestamp";

import { getWindowWidth } from "../lib/getWindowWidth";
import { assertNever } from "../lib/assertNever";
import { clamp } from "../helpers/clamp";
import { GraphDescription } from "../models/GraphDescription";
import { getClosestIndex } from "../lib/getClosestIndex";

type FillColors = {
    positive: string;
    negative: string;
};

type SeriesCollection = Map<string, { series: ValueWithTimestamp[]; lineColor: string; fill?: FillColors }>;

type Store = {
    lineColors?: Map<string, string>;
    defaultLineColor: string;
    minMaxCalculation: "explicit" | "minMax" | "quantile";
    tooltipDateFormat: string;
    tooltipValueFormat: string;
    tooltipDisplayableUnit: string;
    seriesCollection: SeriesCollection;
    domain?: [number, number];
    clearCanvas: boolean;
};

const padding = {
    top: 10,
    right: 30,
    bottom: 10,
    left: 10
};

const width = 480;
const height = 240;

const xAxisHeight = 20;
const axisWidth = 50;

export function lineChart(periodDescription: PeriodDescription, graphDescription: GraphDescription) {
    const store: Store = {
        lineColors: new Map(),
        defaultLineColor: "black",
        tooltipDateFormat: periodDescription.timeFormatString(),
        tooltipValueFormat: graphDescription.tooltipValueFormat,
        tooltipDisplayableUnit: graphDescription.displayableUnit,
        minMaxCalculation: "explicit",
        seriesCollection: new Map(),
        clearCanvas: false
    };

    let firstDrawCall = true;

    let windowWidth = getWindowWidth();

    window.addEventListener("resize", () => {
        windowWidth = getWindowWidth();
    });

    const minimumX = padding.left + axisWidth;
    const maximumX = width - padding.right;
    const minimumY = padding.top;
    const maximumY = height - padding.bottom - xAxisHeight;

    const scaleX = d3.scaleTime().range([minimumX, maximumX]);
    const scaleY = d3.scaleLinear().range([minimumY, maximumY]).clamp(true);

    const yAxis = d3.axisLeft(scaleY);

    let isBrushVisible = false;

    const api = {
        setSeries(name: string, series: ValueWithTimestamp[], lineColor: string, fill?: FillColors) {
            store.seriesCollection.set(name, { series, lineColor, fill });

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

        clearCanvas: (value: boolean) => {
            store.clearCanvas = value;

            return api;
        },

        call: (selection: d3.Selection<d3.BaseType, unknown, HTMLElement, any>) => {
            if (store.clearCanvas) {
                selection.selectAll("*").remove();
                d3.select("#tooltip").style("display", "none");
            }

            if (firstDrawCall) {
                firstDrawCall = false;

                addSvgChildTags(selection);
            }

            const brush = d3.brushX();
            brush.extent([
                [minimumX, minimumY],
                [maximumX, maximumY]
            ]);

            brush.on("start", () => {
                isBrushVisible = true;
            });

            brush.on("brush", (event) => showTooltip(event.sourceEvent, () => getBrushTooltipContents(event)));

            brush.on("end", (event) => {
                if (!event.selection) {
                    isBrushVisible = false;
                }
            });

            selection.select(".brush").call(brush as any);

            selection.attr("viewBox", `0 0 ${width} ${height}`);

            registerEventHandlers(selection);

            const domainX = [periodDescription.startOfPeriod(), periodDescription.endOfPeriod()];

            scaleX.domain(domainX);

            const domainY = store.domain ?? getDomainY();

            scaleY.domain(domainY).range([maximumY, minimumY]);

            renderXAxis(selection.select(".xAxis"));
            selection
                .select(".yAxis")
                .attr("transform", `translate(${minimumX}, 0)`)
                .style("font-size", "13pt")
                .call(yAxis as any);

            store.seriesCollection.forEach((series, name) => {
                const seriesGClassName = `series_${name}`;

                let g = selection.select<SVGGElement>(`.${seriesGClassName}`);

                if (!g.node()) {
                    g = selection.insert("g", "g.xAxis");
                    g.attr("class", seriesGClassName).attr("width", width).attr("height", height);
                }

                drawValues(series.series, series.lineColor, g, series.fill);
            });

            return api;
        }
    };

    function drawValues(
        series: ValueWithTimestamp[],
        lineColor: string,
        selection: d3.Selection<SVGGElement, unknown, HTMLElement, any>,
        fill?: FillColors
    ) {
        const lineGenerator = d3
            .line<ValueWithTimestamp>()
            .curve(d3.curveNatural)
            .x((d) => scaleX(d.timestamp))
            .y((d) => scaleY(d.value));

        if (!!fill) {
            const areaPositive = d3
                .area<ValueWithTimestamp>()
                .curve(d3.curveNatural)
                .x((d) => scaleX(d.timestamp))
                .y0(scaleY(-1.0))
                .y1((d) => scaleY(Math.max(0.0, d.value)));

            const areaNegative = d3
                .area<ValueWithTimestamp>()
                .curve(d3.curveNatural)
                .x((d) => scaleX(d.timestamp))
                .y0(scaleY(0.0))
                .y1((d) => scaleY(Math.min(0.0, d.value)));

            const positiveGradientId = `areaGradientPositive${graphDescription.fieldName}`;
            const negativeGradientId = `areaGradientNegative${graphDescription.fieldName}`;
            const areaGradientPositive = selection
                .append("defs")
                .append("linearGradient")
                .attr("id", positiveGradientId)
                .attr("x1", "0%")
                .attr("y1", "0%")
                .attr("x2", "0%")
                .attr("y2", "100%");

            areaGradientPositive.append("stop").attr("offset", "40%").attr("stop-color", fill.positive);
            areaGradientPositive.append("stop").attr("offset", "100%").attr("stop-color", "#fff");

            const areaGradientNegative = selection
                .append("defs")
                .append("linearGradient")
                .attr("id", negativeGradientId)
                .attr("x1", "0%")
                .attr("y1", "0%")
                .attr("x2", "0%")
                .attr("y2", "100%");

            areaGradientNegative.append("stop").attr("offset", "0%").attr("stop-color", "#fff");
            areaGradientNegative.append("stop").attr("offset", "60%").attr("stop-color", fill.negative);

            selection
                .selectAll(`path.areaPositive`)
                .data([series])
                .join("path")
                .transition()
                .duration(firstDrawCall ? 0 : 200)

                .attr("class", "areaPositive")
                .attr("fill", `url(#${positiveGradientId})`)
                .attr("d", areaPositive);

            selection
                .selectAll(`path.areaNegative`)
                .data([series])
                .join("path")
                .transition()
                .duration(firstDrawCall ? 0 : 200)
                .attr("class", "areaNegative")
                .attr("d", areaNegative)
                .attr("fill", `url(#${negativeGradientId})`);
        }

        selection
            .selectAll(`path.line`)
            .data([series])
            .join("path")
            .transition()
            .duration(firstDrawCall ? 0 : 200)
            .attr("class", `line`)
            .attr("fill", "none")
            .attr("stroke", lineColor)
            .attr("stroke-width", fill ? 1 : 2)
            .attr("d", lineGenerator);
    }

    function addSvgChildTags(selection: d3.Selection<d3.BaseType, unknown, HTMLElement, any>) {
        ["gridLines", "values", "xAxis", "yAxis", "tooltipLine", "brush"].forEach((className) => {
            const g = selection.append("g");

            g.attr("class", className);
        });
    }

    function renderXAxis(xAxisBase: d3.Selection<d3.BaseType, unknown, HTMLElement, any>) {
        const ticks = periodDescription.getChartTicks();
        const xAxis = d3.axisBottom(scaleX as any).ticks(ticks, d3.timeFormat(periodDescription.tickFormatString()));

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
            let min = d3.quantile(allValues, 0.05)!;
            let max = d3.quantile(allValues, 0.95)!;

            // Make sure x axis is visible
            if (max < 0) {
                max = -min / 3;
            }

            if (min > 0) {
                min = -max / 3;
            }

            // Always show a bit of margin around the range
            return [min - Math.abs(min * 0.1), max + Math.abs(max * 1.0)];
        } else if (store.minMaxCalculation === "minMax") {
            const min = Math.min(...allValues) * 0.95;
            const max = Math.max(...allValues) * 1.1;

            return [min, max];
        } else {
            assertNever(store.minMaxCalculation);
        }
    }

    function showTooltip(event: any, htmlProvider: () => string) {
        const tooltipWidth = 300; // Matches the CSS value
        const tooltipLeft = event.pageX + 20;

        const left = clamp(tooltipLeft, 0, windowWidth - tooltipWidth);

        const tooltipSelector = d3.select("#tooltip");
        tooltipSelector
            .style("top", event.pageY - 170 + "px")
            .style("left", left + "px")
            .html(htmlProvider);
    }

    function drawTooltipLine(selection: d3.Selection<d3.BaseType, unknown, HTMLElement, any>, event: any) {
        const tooltipLineSelector = selection.select(".tooltipLine");

        const seriesCollectionValues = Array.from(store.seriesCollection.values());
        const firstSeries = seriesCollectionValues[0].series;
        const closestIndex = getClosestIndex(event, scaleX, firstSeries);

        const x = scaleX(firstSeries[closestIndex].timestamp);

        tooltipLineSelector
            .selectAll("line")
            .data([x])
            .join("line")
            .attr("x1", (x) => x)
            .attr("x2", (x) => x)
            .attr("y1", minimumY)
            .attr("y2", maximumY)
            .attr("stroke", "#333")
            .attr("stroke-width", 1);

        /* Draw a circle on all matching lines */
        const yValues = seriesCollectionValues.map((series) => series.series[closestIndex].value);
        tooltipLineSelector
            .selectAll("circle")
            .data(yValues)
            .join("circle")
            .attr("stroke", "black")
            .attr("fill", "white")
            .attr("r", 4)
            .attr("cx", x)
            .attr("cy", (d) => scaleY(d));
    }

    function getHoverTooltipContents(event: any): string {
        let closestDate = new Date();

        const ys = Array.from(store.seriesCollection.keys()).map((key) => {
            const series = store.seriesCollection.get(key)!;

            var closestIndex = getClosestIndex(event, scaleX, series.series);
            closestDate = series.series[closestIndex].timestamp;

            return {
                name: key,
                value: series.series[closestIndex]?.value
            };
        });

        const dateString = d3.timeFormat(store.tooltipDateFormat)(closestDate);

        const valueLines = ys
            .map(
                ({ name, value }) => `<tr>
                                            <td>${name}:</td>
                                            <td class="tableValue">${renderDisplayValue(value)}</td>
                                        </tr>`
            )
            .join("");
        return `<b>${dateString}</b><table><tbody>${valueLines}</tbody></table>`;
    }

    function getBrushTooltipContents(event: any): string {
        const pointerStartDate = scaleX.invert(event.selection[0]);
        const pointerEndDate = scaleX.invert(event.selection[1]);

        const displayValues: Map<string, { min: number; max: number; mean: number }> = new Map();

        for (const series of store.seriesCollection.entries()) {
            const startIndex = getClosestIndex(event.selection[0], scaleX, series[1].series, event.selection[0]);
            const endIndex = getClosestIndex(event.selection[1], scaleX, series[1].series, event.selection[1]);

            const relevantEntries = series[1].series.slice(startIndex, endIndex);

            const [min, max] = d3.extent(relevantEntries, (v) => v.value);

            displayValues.set(series[0], {
                min: min ?? 0,
                mean: d3.mean(relevantEntries, (v) => v.value) ?? 0,
                max: max ?? 0
            });
        }

        const startDateString = d3.timeFormat(store.tooltipDateFormat)(pointerStartDate);
        const endDateString = d3.timeFormat(store.tooltipDateFormat)(pointerEndDate);

        return `<table class="lineChartBrush">
                    <caption>${startDateString} - ${endDateString}</caption>
                    ${renderBrushTooltipDisplayValues(displayValues).join("")}
                </table>`;
    }

    function renderBrushTooltipDisplayValues(displayValues: Map<string, { min: number; max: number; mean: number }>) {
        let result: string[] = [];

        const headers = ["min", "gem.", "max"];

        result.push('<thead><tr><th scope="col"></th>');
        result.push(...headers.map((h) => `<th scope="col">${h}</th>`));
        result.push("</tr></thead>");

        result.push("<tbody>");
        for (const [name, values] of displayValues) {
            result.push(`<tr><th scope="row">${name}</th>`);
            result.push(`<td class="tableValue">${d3.format(store.tooltipValueFormat)(values.min)}</td>
                    <td class="tableValue">${d3.format(store.tooltipValueFormat)(values.mean)}</td>
                    <td class="tableValue">${d3.format(store.tooltipValueFormat)(values.max)}</td></tr>`);
        }
        result.push("</tbody>");
        return result;
    }

    function renderDisplayValue(value: number) {
        return `${d3.format(store.tooltipValueFormat)(value)} ${store.tooltipDisplayableUnit}`;
    }

    function registerEventHandlers(selection: d3.Selection<d3.BaseType, unknown, HTMLElement, any>) {
        selection.on("mouseover", null);
        selection.on("mouseout", null);
        selection.on("mousemove", null);

        selection.on("mouseover", () => {
            d3.select("#tooltip").style("display", "flex");
            selection.select(".tooltipLine").style("display", "block");
        });

        selection.on("mouseout", () => {
            d3.select("#tooltip").style("display", "none");
            selection.select(".tooltipLine").style("display", "none");
        });

        selection.on("mousemove", (event) => {
            if (isBrushVisible) {
                return;
            }

            if (store.seriesCollection.size === 0) {
                return;
            }

            showTooltip(event, () => getHoverTooltipContents(event));

            /* Draw a vertical line as a visual aid */
            drawTooltipLine(selection, event);
        });
    }

    return api;
}
