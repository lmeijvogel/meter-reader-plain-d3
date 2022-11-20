import * as d3 from "d3";
import * as uuid from "uuid";

import { PeriodDescription } from "../models/PeriodDescription";
import { ValueWithTimestamp } from "../models/ValueWithTimestamp";

import { assertNever } from "../lib/assertNever";
import { GraphDescription } from "../models/GraphDescription";
import { getClosestIndex } from "../lib/getClosestIndex";
import { hideTooltip, showTooltip } from "../tooltip";

type FillColors = {
    positive: string;
    negative: string;
};

type SeriesCollection = Map<string, { series: ValueWithTimestamp[]; lineColor: string; fill?: FillColors }>;

type Store = {
    animate: boolean;
    lineColors?: Map<string, string>;
    defaultLineColor: string;
    minMaxCalculation: "explicit" | "minMax" | "quantile";
    minMaxCalculationField: string | undefined;
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
    const randomId = uuid.v4();

    const store: Store = {
        animate: true,
        lineColors: new Map(),
        defaultLineColor: "black",
        minMaxCalculation: "explicit",
        minMaxCalculationField: undefined,
        seriesCollection: new Map(),
        clearCanvas: false
    };

    let firstDrawCall = true;

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

        animate: (value: boolean) => {
            store.animate = value;

            return api;
        },

        domain(domain: [number, number]) {
            store.domain = domain;
            store.minMaxCalculation = "explicit";

            return api;
        },

        minMaxCalculation: (method: "minMax" | "quantile", field?: string | undefined) => {
            store.minMaxCalculation = method;
            store.minMaxCalculationField = field;

            return api;
        },

        clearCanvas: (value: boolean) => {
            store.clearCanvas = value;

            return api;
        },

        call: (selection: d3.Selection<d3.BaseType, unknown, HTMLElement, any>) => {
            if (store.clearCanvas) {
                selection.selectAll("*").remove();
                hideTooltip();
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

            brush.on("start", () => (isBrushVisible = true));

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
            drawGradient(selection, fill, series, "positive");
            drawGradient(selection, fill, series, "negative");
        }

        var path = selection.selectAll(`path.line`).data([series]).join("path");

        if (store.animate) {
            path.transition().duration(firstDrawCall ? 0 : 200);
        }

        path.attr("class", `line`)
            .attr("fill", "none")
            .attr("stroke", lineColor)
            .attr("stroke-width", fill ? 1 : 2)
            .attr("d", lineGenerator);
    }

    function drawGradient(
        selection: d3.Selection<SVGGElement, unknown, HTMLElement, any>,
        fill: FillColors,
        series: ValueWithTimestamp[],
        areaRange: "positive" | "negative"
    ) {
        const gradientId = `areaGradient_${areaRange}_${randomId}`;

        const limitFunction =
            areaRange === "positive" ? (v: number) => Math.max(0.0, v) : (v: number) => Math.min(v, 0.0);

        const area = d3
            .area<ValueWithTimestamp>()
            .curve(d3.curveNatural)
            .x((d) => scaleX(d.timestamp))
            .y0(scaleY(-1.0))
            .y1((d) => scaleY(limitFunction(d.value)));

        const gradientExists = !!selection.select(`#${gradientId}`).node();

        if (!gradientExists) {
            const areaGradient = selection
                .append("defs")
                .append("linearGradient")
                .attr("id", gradientId)
                .attr("x1", "0%")
                .attr("y1", "0%")
                .attr("x2", "0%")
                .attr("y2", "100%");

            areaGradient.append("stop").attr("offset", "40%").attr("stop-color", fill[areaRange]);
            areaGradient.append("stop").attr("offset", "100%").attr("stop-color", "#fff");
        }

        selection
            .selectAll(`path.area_${areaRange}`)
            .data([series])
            .join("path")
            .transition()
            .duration(firstDrawCall ? 0 : 200)

            .attr("class", `area_${areaRange}`)
            .attr("fill", `url(#${gradientId})`)
            .attr("d", area);
    }

    function addSvgChildTags(selection: d3.Selection<d3.BaseType, unknown, HTMLElement, any>) {
        ["gridLines", "values", "xAxis axis", "yAxis axis", "tooltipLine", "brush"].forEach((className) => {
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

        const relevantValues = !!store.minMaxCalculationField
            ? store.seriesCollection.get(store.minMaxCalculationField)!.series.map((s) => s.value)
            : Array.from(store.seriesCollection.values()).flatMap((series) => series.series.map((s) => s.value));

        if (store.minMaxCalculation === "quantile") {
            let min = d3.quantile(relevantValues, 0.05)!;
            let max = d3.quantile(relevantValues, 0.95)!;

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
            const min = Math.min(...relevantValues) * 0.95;
            const max = Math.max(...relevantValues) * 1.1;

            return [min, max];
        } else {
            assertNever(store.minMaxCalculation);
        }
    }

    function drawTooltipLine(selection: d3.Selection<d3.BaseType, unknown, HTMLElement, any>, event: any) {
        const tooltipLineSelector = selection.select(".tooltipLine");

        const seriesCollectionValues = Array.from(store.seriesCollection.values());
        const closestIndices = seriesCollectionValues.map((collection) =>
            getClosestIndex(event, scaleX, collection.series)
        );

        const maxIndex = closestIndices.reduce(
            (acc, el, index) => {
                if (el.timestamp > acc.maxTimestamp) {
                    return { maxTimestamp: el.timestamp, seriesIndexInArray: index };
                } else {
                    return acc;
                }
            },
            { maxTimestamp: new Date(1970), seriesIndexInArray: -1 }
        );

        const x = scaleX(maxIndex.maxTimestamp);

        tooltipLineSelector
            .selectAll("line")
            .data([x])
            .join("line")
            .attr("x1", (x) => x)
            .attr("x2", (x) => x)
            .attr("y1", minimumY)
            .attr("y2", maximumY)
            .attr("class", "tooltipLine");

        /* Draw a circle on all matching lines */
        const yValues = seriesCollectionValues.map((series, i) => series.series[closestIndices[i].index].value);

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
            closestDate = closestIndex.timestamp;

            return {
                name: key,
                value: series.series[closestIndex.index]?.value
            };
        });

        const dateString = d3.timeFormat(periodDescription.timeFormatString())(closestDate);

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

            const relevantEntries = series[1].series.slice(startIndex.index, endIndex.index);

            const [min, max] = d3.extent(relevantEntries, (v) => v.value);

            displayValues.set(series[0], {
                min: min ?? 0,
                mean: d3.mean(relevantEntries, (v) => v.value) ?? 0,
                max: max ?? 0
            });
        }

        const formatString = periodDescription.timeFormatString();
        const startDateString = d3.timeFormat(formatString)(pointerStartDate);
        const endDateString = d3.timeFormat(formatString)(pointerEndDate);

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
        const tooltipValueFormat = graphDescription.tooltipValueFormat;
        for (const [name, values] of displayValues) {
            result.push(`<tr><th scope="row">${name}</th>`);
            result.push(`<td class="tableValue">${d3.format(tooltipValueFormat)(values.min)}</td>
                    <td class="tableValue">${d3.format(tooltipValueFormat)(values.mean)}</td>
                    <td class="tableValue">${d3.format(tooltipValueFormat)(values.max)}</td></tr>`);
        }
        result.push("</tbody>");
        return result;
    }

    function renderDisplayValue(value: number) {
        return `${d3.format(graphDescription.tooltipValueFormat)(value)} ${graphDescription.displayableUnit}`;
    }

    function registerEventHandlers(selection: d3.Selection<d3.BaseType, unknown, HTMLElement, any>) {
        selection.on("mouseover", null);
        selection.on("mouseout", null);
        selection.on("mousemove", null);

        selection.on("mouseover", () => {
            selection.select(".tooltipLine").style("display", "block");
        });

        selection.on("mouseout", () => {
            hideTooltip();
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
