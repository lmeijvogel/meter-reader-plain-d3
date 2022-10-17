import * as d3 from "d3";
import { GraphDescription } from "../models/GraphDescription";
import { MeasurementEntry } from "../models/MeasurementEntry";
import { PeriodDescription } from "../models/PeriodDescription";

import { tip as d3tip } from "d3-v6-tip";
import { format, isEqual } from "date-fns";

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
    hasTextLabels: boolean;
    data: PowerSourcesAndBackDelivery[];
    relativeMinMax: boolean;
    graphTickPositions: "on_value" | "between_values";
    unit: string;
    onValueClick: (periodDescription: PeriodDescription) => void;
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

export function usageAndGenerationBarChart(
    initialPeriodDescription: PeriodDescription,
    graphDescription: GraphDescription
) {
    let tip: any;

    let firstDrawCall = true;

    const store: Store = {
        periodDescription: initialPeriodDescription,
        hasTextLabels: true,
        barColor: graphDescription.barColor,
        graphTickPositions: "on_value",
        relativeMinMax: true,
        data: [],
        unit: graphDescription.displayableUnit,
        onValueClick: () => {}
    };

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
            .ticks(ticks, d3.timeFormat(periodDescription.timeFormatString()))
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

        const xAxisBase = selection
            .select("g.xAxis")
            .attr("class", "xAxis")
            .attr("transform", `translate(0, ${scaleY(0)})`);

        renderXAxis(xAxisBase);

        selection
            .select(".yAxis")
            .attr("transform", `translate(${padding.left + axisWidth}, 0)`)
            .style("font-size", "13pt")
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
            .on("click", (_event: any, d) => {
                const clickedPeriod = store.periodDescription.atIndex(d.timestamp);
                store.onValueClick(clickedPeriod);
            })
            .on("mouseover", (event, d) => {
                tip.show(event, d);
            })
            .on("mouseout", tip.hide)
            .attr("index", (_d: any, i: number) => i);
    }

    function xAxisHeight() {
        return graphDescription.xLabelHeight;
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

        call: (selection: d3.Selection<d3.BaseType, unknown, HTMLElement, any>) => {
            if (firstDrawCall) {
                addSvgChildTags(selection);

                /* Initialize tooltip */
                tip = d3tip()
                    .attr("class", "d3-tip")
                    .offset([-10, 0])
                    .html((_event: unknown, d: PowerSourcesAndBackDelivery) => {
                        const dateString = format(d.timestamp, "eee yyyy-MM-dd HH:00");

                        const rows = [`<dt>Grid</dt><dd><b>${d3.format(".2f")(d.gridSource)}</b> ${store.unit}</dd>`];

                        if (Math.abs(d.solarSource) > 0.01) {
                            rows.push(
                                `<dt>Panelen</dt><dd><b>${d3.format(".2f")(d.solarSource)}</b> ${store.unit}</dd>`
                            );
                        }

                        if (Math.abs(d.backDelivery) > 0.01) {
                            rows.push(
                                `<dt>Geleverd: </dt><dd><b>${d3.format(".2f")(-d.backDelivery)}</b> ${store.unit}</dd>`
                            );
                        }

                        const contents = `${dateString}<br />
                            <dl>
                            ${rows.join("")}
                            </dl>
                        `;

                        return contents;
                    });
                selection.call(tip);

                firstDrawCall = false;
            }

            updateScales(selection);

            drawBars(selection, store.data, "solarSource", "#55ff10", "gridSource");
            drawBars(selection, store.data, "gridSource", graphDescription.barColor);
            drawBars(selection, store.data, "backDelivery", "#55ff10");
        }
    };

    return api;
}

function addSvgChildTags(selection: d3.Selection<d3.BaseType, unknown, HTMLElement, any>) {
    [
        "gridLines",
        "additionalInfo",
        "values-solarSource",
        "values-backDelivery",
        "values-gridSource",
        "xAxis",
        "yAxis"
    ].forEach((name) => {
        selection.append("g").attr("class", name);
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
