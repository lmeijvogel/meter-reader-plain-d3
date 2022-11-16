import * as d3 from "d3";
import { GraphDescription } from "../models/GraphDescription";
import { MeasurementEntry } from "../models/MeasurementEntry";
import { PeriodDescription } from "../models/PeriodDescription";

import { isEqual } from "date-fns";
import { getClosestIndex } from "../lib/getClosestIndex";
import { hideTooltip, showTooltip } from "../tooltip";
import { height, padding, xAxisHeight } from "./barChartHelpers/constants";
import { initScales, updateScales } from "./barChartHelpers/updateScales";
import { PowerSourcesAndBackDelivery } from "./barChartHelpers/Types";

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

type Store = {
    periodDescription: PeriodDescription;
    data: PowerSourcesAndBackDelivery[];
    relativeMinMax: boolean;
    onValueClick: (periodDescription: PeriodDescription) => void;
    clearCanvas: boolean;
    minMaxCalculator: (data: PowerSourcesAndBackDelivery[]) => { min: number; max: number };
};

let firstDrawCall = true;

export function usageAndGenerationBarChart(
    initialPeriodDescription: PeriodDescription,
    graphDescription: GraphDescription
) {
    const store: Store = {
        periodDescription: initialPeriodDescription,
        relativeMinMax: true,
        data: [],
        onValueClick: () => {},
        clearCanvas: false,
        minMaxCalculator: (data: PowerSourcesAndBackDelivery[]): { min: number; max: number } => {
            const min = d3.min(data, (el) => el.backDelivery) ?? 0;
            const max = d3.max(data, (el) => el.gridSource + el.solarSource) ?? 0;

            return { min, max };
        }
    };
    const { scaleX, scaleXForInversion, scaleY } = initScales();

    const calculateBarXPosition = (date: Date) => {
        const { periodDescription } = store;
        const pos = scaleX(periodDescription.normalize(date));

        return !!pos ? pos : 0;
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

    function buildTooltip(event: any) {
        const unit = graphDescription.displayableUnit;
        var bisect = d3.bisector((d: PowerSourcesAndBackDelivery) => d.timestamp).right;

        const pointerX = d3.pointer(event)[0];
        const pointerDate = scaleXForInversion.invert(pointerX);

        const data = store.data;

        var closestIndex = bisect(data, pointerDate, 1) - 1;

        const d = data[closestIndex];

        const dateString = d3.timeFormat(initialPeriodDescription.timeFormatString())(d.timestamp);

        const rows = [
            `<tr><td class="category">Grid</td><td class="tableValue">${d3.format(".2f")(d.gridSource)} ${
                unit
            }</td></tr>`
        ];

        if (Math.abs(d.solarSource) > 0.01) {
            rows.push(
                `<tr><td class="category">Panelen</td><td class="tableValue">${d3.format(".2f")(d.solarSource)} ${
                    unit
                }</td></tr>`
            );
        }

        if (Math.abs(d.backDelivery) > 0.01) {
            rows.push(
                `<tr><td class="category">Geleverd: </td><td class="tableValue">${d3.format(".2f")(-d.backDelivery)} ${
                    unit
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

        const x = scaleX(initialPeriodDescription.normalize(closestIndex.timestamp))!;

        tooltipLineSelector
            .selectAll("line")
            .data([x])
            .join("line")
            .attr("x1", (x) => x + scaleX.bandwidth() / 2)
            .attr("x2", (x) => x + scaleX.bandwidth() / 2)
            .attr("y1", padding.top)
            .attr("y2", height - padding.bottom - xAxisHeight)
            .attr("stroke", "#333")
            .attr("stroke-width", 1);
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
            showTooltip(event, () => buildTooltip(event));

            drawTooltipLine(selection, event);
        });
    }

    const api = {
        data(data: Data) {
            store.data = splitSolarSourceData(groupValuesByDate(data));

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
            updateScales(selection, firstDrawCall, scaleX, scaleXForInversion, scaleY, store);

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
        "xAxis axis",
        "yAxis axis"
    ].forEach((name) => {
        if (!selection.select(`g.${name}`).node()) {
            selection.append("g").attr("class", name);
        }
    });

    selection.attr("viewBox", "0 0 480 240");
}

function groupValuesByDate(input: Data): ConsolidatedData[] {
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

function splitSolarSourceData(input: ConsolidatedData[]): PowerSourcesAndBackDelivery[] {
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
