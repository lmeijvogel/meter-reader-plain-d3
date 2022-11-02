import * as d3 from "d3";
import { GraphDescription } from "../models/GraphDescription";
import { MeasurementEntry } from "../models/MeasurementEntry";
import { PeriodDescription } from "../models/PeriodDescription";

import { isEqual } from "date-fns";
import { clamp } from "../helpers/clamp";
import { getWindowWidth } from "../lib/getWindowWidth";
import { getClosestIndex } from "../lib/getClosestIndex";

type Data = {
    consumption: MeasurementEntry[];
    generation: MeasurementEntry[];
    backDelivery: MeasurementEntry[];
};

type ConsolidatedData = {
    timestamp: Date;
    consumption: number;
    generation: number;
    backDelivery: number;
};

type PowerSourcesAndBackDelivery = {
    solarSource: number;
    gridSource: number;
    backDelivery: number;
    timestamp: Date;
};

type Store = {
    periodDescription: PeriodDescription;
    barColor: string;
    tooltipDateFormat: string;
    tooltipValueFormat: string;
    tooltipDisplayableUnit: string;
    hasTextLabels: boolean;
    data: PowerSourcesAndBackDelivery[];
    relativeMinMax: boolean;
    graphTickPositions: "on_value" | "between_values";
    unit: string;
    onValueClick: (periodDescription: PeriodDescription) => void;
    clearCanvas: boolean;
};

const width = 480;
const height = 240;

const padding = {
    top: 10,
    right: 30,
    bottom: 10,
    left: 10
};

const axisWidth = 50;

let firstDrawCall = true;

export function usageAndGenerationBarChart(
    initialPeriodDescription: PeriodDescription,
    graphDescription: GraphDescription
) {
    const store: Store = {
        periodDescription: initialPeriodDescription,
        hasTextLabels: true,
        barColor: graphDescription.barColor,
        tooltipDateFormat: initialPeriodDescription.timeFormatString(),
        tooltipValueFormat: graphDescription.tooltipValueFormat,
        tooltipDisplayableUnit: graphDescription.displayableUnit,
        graphTickPositions: "on_value",
        relativeMinMax: true,
        data: [],
        unit: graphDescription.displayableUnit,
        onValueClick: () => {},
        clearCanvas: false
    };

    let windowWidth = getWindowWidth();

    window.addEventListener("resize", () => {
        windowWidth = getWindowWidth();
    });

    const scaleX = d3.scaleBand<Date>().padding(0.15);
    const scaleXForInversion = d3.scaleTime();

    const scaleY = d3
        .scaleLinear()
        .range([height - padding.bottom - xAxisHeight(), padding.top])
        .clamp(true);
    const yAxis = d3.axisLeft(scaleY);

    const renderXAxis = (xAxisBase: d3.Selection<d3.BaseType, unknown, HTMLElement, any>) => {
        /* The reasonable assumption would be that creating a scale for a bar chart
         * would just reuse the band scale, but that has the downside that the ticks will
         * always end up in the middle of the bars. For the year and month charts that is fine:
         * A bar represents the usage for a given day or month.
         *
         * For the day chart, it feels better to have the bars *between* the axis ticks,
         * since the graph shows the usage between e.g. 09:00 and 10:00. And we need a linear
         * scale to do that: I can't persuade an xAxis based on a band scale to put the ticks
         * between the bands.
         */

        // Sadly, I also can't use the same logic as in the LineChart here, by using
        // scaleTime and using .ticks(), since bandScale does not support .ticks().

        const { graphTickPositions, periodDescription } = store;

        let domain = [periodDescription.startOfPeriod(), periodDescription.endOfPeriod()];

        if (graphTickPositions === "on_value") {
            domain = domain.map(periodDescription.shiftHalfTick);
        }

        const scaleXForXAxis = d3
            .scaleTime()
            .domain(domain)
            .range([padding.left + axisWidth, width - padding.right]);

        const ticks = periodDescription.getChartTicks();
        const xAxis = d3
            .axisBottom(scaleXForXAxis)
            .ticks(ticks, d3.timeFormat(periodDescription.tickFormatString()))
            .tickSizeOuter(0);

        const renderedXAxisLabels = xAxisBase
            .call(xAxis as any)
            .selectAll("text")
            .style("font-size", "13pt");

        if (store.hasTextLabels) {
            renderedXAxisLabels
                .style("text-anchor", "end")
                .attr("dy", "-.2em")
                .attr("dx", "-1em")
                .attr("transform", "rotate(-65)");
        } else {
            // Got the 0.71em from the browser
            renderedXAxisLabels.style("text-anchor", null).attr("dy", "0.71em").attr("transform", null);
        }
    };

    const calculateBarXPosition = (date: Date) => {
        const { periodDescription } = store;
        const pos = scaleX(periodDescription.normalize(date));

        return !!pos ? pos : 0;
    };

    const getRelativeDomain = (): number[] => {
        const minY = d3.min(store.data, (el) => el.backDelivery) ?? 0;
        const maxY = d3.max(store.data, (el) => el.gridSource + el.solarSource) ?? 0;

        return [minY * 1.1, maxY * 1.1];
    };

    const updateScales = (selection: d3.Selection<d3.BaseType, unknown, HTMLElement, any>) => {
        const { periodDescription } = store;

        const domainY = store.relativeMinMax ? getRelativeDomain() : [graphDescription.minY, graphDescription.maxY];
        scaleY.domain(domainY);

        const domainX = periodDescription
            .getExpectedDomainValues()
            .range(periodDescription.startOfPeriod(), periodDescription.endOfPeriod());

        scaleX.domain(domainX).range([padding.left + axisWidth, width - padding.right]);

        scaleXForInversion
            .domain([periodDescription.startOfPeriod(), periodDescription.endOfPeriod()])
            .range([axisWidth + padding.left, width - padding.right]);

        const xAxisBase = selection.select("g.xAxis").attr("class", "xAxis");

        xAxisBase
            .transition()
            .duration(firstDrawCall ? 0 : 200)
            .attr("transform", `translate(0, ${scaleY(0)})`);

        renderXAxis(xAxisBase);

        selection
            .select(".yAxis")
            .attr("transform", `translate(${padding.left + axisWidth}, 0)`)
            .style("font-size", "13pt")
            .transition()
            .duration(200)
            .call(yAxis as any);
    };

    function drawBars(
        selection: d3.Selection<d3.BaseType, unknown, HTMLElement, any>,
        data: PowerSourcesAndBackDelivery[],
        field: Exclude<keyof PowerSourcesAndBackDelivery, "timestamp">,
        color: string,
        onTopOf?: Exclude<keyof PowerSourcesAndBackDelivery, "timestamp">
    ) {
        selection
            .select(`g.values-${field}`)
            .selectAll("rect")
            .data(data)
            .join("rect")
            .on("click", (_event: any, d) => {
                const clickedPeriod = store.periodDescription.atIndex(d.timestamp);
                store.onValueClick(clickedPeriod);
            })
            .transition()
            .duration(firstDrawCall ? 0 : 200)
            .attr("x", (el) => {
                return calculateBarXPosition(el.timestamp);
            })
            .attr("y", (el) =>
                onTopOf ? scaleY(el[onTopOf]) - (scaleY(0) - scaleY(el[field])) : scaleY(Math.max(0, el[field]))
            )
            .attr("height", (el) => Math.abs(scaleY(el[field]) - scaleY(0)))
            .attr("width", scaleX.bandwidth())
            .attr("fill", color)
            .attr("data-value", (el) => el[field])
            .attr("data-pos", onTopOf ?? "")
            .attr("index", (_d: any, i: number) => i);
    }

    function xAxisHeight() {
        return graphDescription.xLabelHeight;
    }

    function buildTooltip(event: any) {
        var bisect = d3.bisector((d: PowerSourcesAndBackDelivery) => d.timestamp).right;

        const pointerX = d3.pointer(event)[0];
        const pointerDate = scaleXForInversion.invert(pointerX);

        const data = store.data;

        var closestIndex = bisect(data, pointerDate, 1) - 1;

        const d = data[closestIndex];

        const dateString = d3.timeFormat(initialPeriodDescription.timeFormatString())(d.timestamp);

        const rows = [
            `<tr><td class="category">Grid</td><td class="tableValue">${d3.format(".2f")(d.gridSource)} ${
                store.unit
            }</td></tr>`
        ];

        if (Math.abs(d.solarSource) > 0.01) {
            rows.push(
                `<tr><td class="category">Panelen</td><td class="tableValue">${d3.format(".2f")(d.solarSource)} ${
                    store.unit
                }</td></tr>`
            );
        }

        if (Math.abs(d.backDelivery) > 0.01) {
            rows.push(
                `<tr><td class="category">Geleverd: </td><td class="tableValue">${d3.format(".2f")(-d.backDelivery)} ${
                    store.unit
                }</td></tr>`
            );
        }

        const contents = `<h3 class="title">${dateString}</h3>
                            <table class="usageAndGenerationTooltip">
                            <tbody>
                                ${rows.join("")}
                            </tbody>
                            </table>
                        `;

        return contents;
    }

    function drawTooltipLine(selection: d3.Selection<d3.BaseType, unknown, HTMLElement, any>, event: any) {
        const tooltipLineSelector = selection.select(".tooltipLine");

        const data = store.data;
        const closestIndex = getClosestIndex(event, scaleXForInversion, data);

        const x = scaleX(initialPeriodDescription.normalize(data[closestIndex].timestamp))!;

        tooltipLineSelector
            .selectAll("line")
            .data([x])
            .join("line")
            .attr("x1", (x) => x + scaleX.bandwidth() / 2)
            .attr("x2", (x) => x + scaleX.bandwidth() / 2)
            .attr("y1", padding.top)
            .attr("y2", height - padding.bottom - xAxisHeight())
            .attr("stroke", "#333")
            .attr("stroke-width", 1);
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
            showTooltip(event, () => buildTooltip(event));

            drawTooltipLine(selection, event);
        });
    }

    function showTooltip(event: any, htmlProvider: () => string) {
        const tooltipWidth = 300; // Matches the CSS value
        const tooltipLeft = event.pageX + 20;

        const left = clamp(tooltipLeft, 0, windowWidth - tooltipWidth);

        const tooltipSelector = d3.select("#tooltip");
        tooltipSelector
            .style("top", event.pageY - 200 + "px")
            .style("left", left + "px")
            .html(htmlProvider);
    }

    const api = {
        data(data: Data) {
            store.data = prepareForBars(consolidateData(data));

            return api;
        },

        onClick: (handler: (periodDescription: PeriodDescription) => void) => {
            store.onValueClick = handler;

            return api;
        },

        clearCanvas: (value: boolean) => {
            store.clearCanvas = value;
        },

        call: (selection: d3.Selection<d3.BaseType, unknown, HTMLElement, any>) => {
            if (store.clearCanvas) {
                firstDrawCall = true;
                selection.selectAll("*").remove();
            }

            d3.select("#tooltip").style("display", "none");

            addSvgChildTags(selection);

            registerEventHandlers(selection);
            updateScales(selection);

            drawBars(selection, store.data, "solarSource", "#55ff10", "gridSource");
            drawBars(selection, store.data, "gridSource", graphDescription.barColor);
            drawBars(selection, store.data, "backDelivery", "#55ff10");

            firstDrawCall = false;
        }
    };

    return api;
}

function addSvgChildTags(selection: d3.Selection<d3.BaseType, unknown, HTMLElement, any>) {
    [
        "tooltipLine",
        "gridLines",
        "additionalInfo",
        "values-solarSource",
        "values-backDelivery",
        "values-gridSource",
        "xAxis",
        "yAxis"
    ].forEach((name) => {
        if (!selection.select(`g.${name}`).node()) {
            selection.append("g").attr("class", name);
        }
    });

    selection.attr("viewBox", "0 0 480 240");
}

function consolidateData(input: Data): ConsolidatedData[] {
    const getDates = (input: MeasurementEntry[]) => input.map((el) => el.timestamp);
    const dataFields: (keyof Data)[] = ["consumption", "generation", "backDelivery"];
    const timestamps = d3.sort(d3.union(dataFields.flatMap((field) => getDates(input[field]))));

    const result: ConsolidatedData[] = [];

    for (const ts of timestamps) {
        const row = {
            consumption: input.consumption.find((el) => isEqual(el.timestamp, ts))?.value ?? 0,
            generation: input.generation.find((el) => isEqual(el.timestamp, ts))?.value ?? 0,
            backDelivery: input.backDelivery.find((el) => isEqual(el.timestamp, ts))?.value ?? 0,
            timestamp: ts
        };
        result.push(row);
    }

    return result;
}

function prepareForBars(input: ConsolidatedData[]): PowerSourcesAndBackDelivery[] {
    const result: PowerSourcesAndBackDelivery[] = [];

    for (const entry of input) {
        result.push({
            gridSource: entry.consumption,
            solarSource: entry.generation + entry.backDelivery,
            backDelivery: entry.backDelivery,
            timestamp: entry.timestamp
        } as PowerSourcesAndBackDelivery);
    }

    return result;
}
