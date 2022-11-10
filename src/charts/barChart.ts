import * as d3 from "d3";
import { GraphDescription } from "../models/GraphDescription";
import { PeriodDescription } from "../models/PeriodDescription";
import { ValueWithTimestamp } from "../models/ValueWithTimestamp";

import { clamp } from "../helpers/clamp";
import { getWindowWidth } from "../lib/getWindowWidth";
import { getClosestIndex } from "../lib/getClosestIndex";

type Store = {
    periodDescription: PeriodDescription;
    barColor: string;
    tooltipDateFormat: string;
    tooltipValueFormat: string;
    tooltipDisplayableUnit: string;
    hasTextLabels: boolean;
    data: ValueWithTimestamp[];
    relativeMinMax: boolean;
    graphTickPositions: "on_value" | "between_values";
    unit: string;
    onValueClick: (periodDescription: PeriodDescription) => void;
    clearCanvas: boolean;
    firstDrawCall: boolean;
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

export function barChart(initialPeriodDescription: PeriodDescription, graphDescription: GraphDescription) {
    const store: Store = {
        periodDescription: initialPeriodDescription,
        tooltipDateFormat: initialPeriodDescription.timeFormatString(),
        tooltipValueFormat: graphDescription.tooltipValueFormat,
        tooltipDisplayableUnit: graphDescription.displayableUnit,
        hasTextLabels: true,
        barColor: graphDescription.barColor,
        graphTickPositions: "on_value",
        relativeMinMax: true,
        data: [],
        unit: graphDescription.displayableUnit,
        onValueClick: () => {},
        clearCanvas: false,
        firstDrawCall: true
    };

    let windowWidth = getWindowWidth();

    window.addEventListener("resize", () => {
        windowWidth = getWindowWidth();
    });

    const scaleX = d3.scaleBand<Date>().padding(0.15);
    const scaleXForInversion = d3.scaleTime();

    const scaleY = d3.scaleLinear().clamp(true);
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

    const getDomain = (): number[] => {
        return [graphDescription.minY, graphDescription.maxY];
    };

    const updateScales = (selection: d3.Selection<d3.BaseType, unknown, HTMLElement, any>) => {
        const { periodDescription } = store;

        const domainY = store.relativeMinMax ? getDomain() : [graphDescription.minY, graphDescription.maxY];
        scaleY.domain(domainY).range([height - padding.bottom - xAxisHeight(), padding.top]);

        const domainX = periodDescription
            .getExpectedDomainValues()
            .range(periodDescription.startOfPeriod(), periodDescription.endOfPeriod());

        scaleX.domain(domainX).range([padding.left + axisWidth, width - padding.right]);

        scaleXForInversion
            .domain([periodDescription.startOfPeriod(), periodDescription.endOfPeriod()])
            .range([axisWidth + padding.left, width - padding.right]);

        const xAxisBase = selection
            .select("g.xAxis")
            .attr("class", "xAxis axis")
            .attr("transform", `translate(0, ${scaleY(0)})`);

        xAxisBase.transition().duration(store.firstDrawCall ? 0 : 200);

        renderXAxis(xAxisBase);

        selection
            .select(".yAxis")
            .attr("transform", `translate(${padding.left + axisWidth}, 0)`)
            .style("font-size", "13pt")
            .transition()
            .duration(store.firstDrawCall ? 0 : 200)
            .call(yAxis as any);
    };

    function drawBars(selection: d3.Selection<d3.BaseType, unknown, HTMLElement, any>) {
        selection
            .select("g.values")
            .selectAll("rect")
            .data(store.data)
            .join("rect")
            .on("click", (_event: any, d) => {
                const clickedPeriod = store.periodDescription.atIndex(d.timestamp);
                store.onValueClick(clickedPeriod);
            })
            .transition()
            .duration(store.firstDrawCall ? 0 : 200)
            .attr("x", (el) => calculateBarXPosition(el.timestamp))
            .attr("y", (el) => scaleY(el.value))
            .attr("height", (el) => scaleY(0) - scaleY(el.value))
            .attr("width", scaleX.bandwidth())
            .attr("fill", store.barColor)
            .attr("data-value", (el) => el.value)
            .attr("index", (_d: any, i: number) => i);
    }

    function xAxisHeight() {
        return graphDescription.xLabelHeight;
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
            unhighlightBar(selection);
        });

        selection.on("mousemove", (event) => {
            showTooltip(event, () => getHoverTooltipContents(event));
            highlightActiveBar(selection, event);

            drawTooltipLine(selection, event);
        });
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

    function getHoverTooltipContents(event: any): string {
        const data = store.data;

        var closestIndex = getClosestIndex(event, scaleXForInversion, data);

        const closestDate = closestIndex[1];
        const value = data[closestIndex[0]].value;

        const dateString = d3.timeFormat(store.tooltipDateFormat)(closestDate);

        const valueLine = `<tr>
                                            <td>${graphDescription.fieldName}:</td>
                                            <td class="tableValue">${renderDisplayValue(value)}</td>
                                        </tr>`;

        return `<b>${dateString}</b><table><tbody>${valueLine}</tbody></table>`;
    }

    function renderDisplayValue(value: number) {
        return `${d3.format(store.tooltipValueFormat)(value)} ${store.tooltipDisplayableUnit}`;
    }

    function highlightActiveBar(selection: d3.Selection<d3.BaseType, unknown, HTMLElement, any>, event: any) {
        const closestIndex = getClosestIndex(event, scaleXForInversion, store.data);

        selection
            .select(".values")
            .selectAll("rect")
            .style("fill", (_d, i) =>
                i === closestIndex[0] ? graphDescription.lightColor : graphDescription.barColor
            );
    }

    function unhighlightBar(selection: d3.Selection<d3.BaseType, unknown, HTMLElement, any>) {
        selection.select(".values").selectAll("rect").style("fill", graphDescription.barColor);
    }

    function drawTooltipLine(selection: d3.Selection<d3.BaseType, unknown, HTMLElement, any>, event: any) {
        const tooltipLineSelector = selection.select(".tooltipLine");

        const data = store.data;
        const closestIndex = getClosestIndex(event, scaleXForInversion, data);

        const x = scaleX(initialPeriodDescription.normalize(closestIndex[1]))!;

        tooltipLineSelector
            .selectAll("line")
            .data([x])
            .join("line")
            .attr("x1", (x) => x + scaleX.bandwidth() / 2)
            .attr("x2", (x) => x + scaleX.bandwidth() / 2)
            .attr("y1", padding.top)
            .attr("y2", height - padding.bottom - xAxisHeight())
            .attr("class", "tooltipLine");
    }

    const api = {
        data(data: ValueWithTimestamp[]) {
            store.data = data;

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

        onClick: (handler: (periodDescription: PeriodDescription) => void) => {
            store.onValueClick = handler;

            return api;
        },

        clearCanvas: (value: boolean) => {
            store.clearCanvas = value;

            return api;
        },

        call: (selection: d3.Selection<d3.BaseType, unknown, HTMLElement, any>) => {
            if (store.clearCanvas) {
                selection.selectAll("*").remove();
                store.firstDrawCall = true;
            }

            d3.select("#tooltip").style("display", "none");

            if (store.firstDrawCall) {
                addSvgChildTags(selection);
            }

            registerEventHandlers(selection);
            updateScales(selection);

            drawBars(selection);
            store.firstDrawCall = false;
        }
    };

    return api;
}

function addSvgChildTags(selection: d3.Selection<d3.BaseType, unknown, HTMLElement, any>) {
    ["tooltipLine", "gridLines", "additionalInfo", "values", "xAxis axis", "yAxis axis"].forEach((name) => {
        if (!selection.select(`g.${name}`).node()) {
            selection.append("g").attr("class", name);
        }
    });

    selection.attr("viewBox", "0 0 480 240");
}
