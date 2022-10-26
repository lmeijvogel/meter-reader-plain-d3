import * as d3 from "d3";
import { GraphDescription } from "../models/GraphDescription";
import { PeriodDescription } from "../models/PeriodDescription";
import { ValueWithTimestamp } from "../models/ValueWithTimestamp";

import { format } from "date-fns";
import { clamp } from "../helpers/clamp";
import { getWindowWidth } from "../lib/getWindowWidth";

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
    let firstDrawCall = true;

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
        clearCanvas: false
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
            .attr("class", "xAxis")
            .attr("transform", `translate(0, ${scaleY(0)})`);

        renderXAxis(xAxisBase);

        selection
            .select(".yAxis")
            .attr("transform", `translate(${padding.left + axisWidth}, 0)`)
            .style("font-size", "13pt")
            .call(yAxis as any);
    };

    function drawBars(selection: d3.Selection<d3.BaseType, unknown, HTMLElement, any>) {
        selection
            .select("g.values")
            .selectAll("rect")
            .data(store.data)
            .join("rect")
            .attr("x", (el) => calculateBarXPosition(el.timestamp))
            .attr("y", (el) => scaleY(el.value))
            .attr("height", (el) => scaleY(0) - scaleY(el.value))
            .attr("width", scaleX.bandwidth())
            .attr("fill", store.barColor)
            .attr("data-value", (el) => el.value)
            .on("click", (_event: any, d) => {
                const clickedPeriod = store.periodDescription.atIndex(d.timestamp);
                store.onValueClick(clickedPeriod);
            })
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
        });

        selection.on("mouseout", () => {
            d3.select("#tooltip").style("display", "none");
        });

        selection.on("mousemove", (event) => {
            showTooltip(event, () => getHoverTooltipContents(event));
        });
    }

    function showTooltip(event: any, htmlProvider: () => string) {
        const tooltipWidth = 250; // Matches the CSS value
        const tooltipLeft = event.pageX + 20;

        const left = clamp(tooltipLeft, 0, windowWidth - tooltipWidth);

        const tooltipSelector = d3.select("#tooltip");
        tooltipSelector
            .style("top", event.pageY - 170 + "px")
            .style("left", left + "px")
            .html(htmlProvider);
    }

    function getHoverTooltipContents(event: any): string {
        var bisect = d3.bisector((d: ValueWithTimestamp) => d.timestamp).right;

        const pointerX = d3.pointer(event)[0];
        const pointerDate = scaleXForInversion.invert(pointerX);

        let closestDate = new Date();

        const data = store.data;

        var closestIndex = bisect(data, pointerDate, 1) - 1;
        closestDate = data[closestIndex].timestamp;

        console.log({ data, closestIndex });
        const value = data[closestIndex].value;

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
            }

            selection.on("mouseover", null);
            selection.on("mouseout", null);
            selection.on("mousemove", null);

            if (firstDrawCall) {
                addSvgChildTags(selection);
            }

            registerEventHandlers(selection);
            updateScales(selection);

            drawBars(selection);
        }
    };

    return api;
    // brushSvg.call(brush);
}

function addSvgChildTags(selection: d3.Selection<d3.BaseType, unknown, HTMLElement, any>) {
    ["gridLines", "additionalInfo", "values", "xAxis", "yAxis"].forEach((name) => {
        selection.append("g").attr("class", name);
    });

    selection.attr("viewBox", "0 0 480 240");
}

// protected onValueClick = (_event: unknown, value: ValueWithTimestamp) => {
// this.props.onBarClick(value.timestamp);
// };

// private buildTooltipContentsForSingleMeasurement(valueWithTimestamp: ValueWithTimestamp) {
// const formattedValue = d3.format(this.props.graphDescription.tooltipValueFormat)(valueWithTimestamp.value);

// return `${this.props.periodDescription
// .atIndex(valueWithTimestamp.timestamp)
// .toShortTitle()}:<br />${formattedValue} ${this.props.graphDescription.displayableUnit}`;
// }

// private buildTooltipContentsForRange(values: ValueWithTimestamp[]) {
// const total = d3.sum(values.map((value) => value.value));

// const formattedValue = d3.format(this.props.graphDescription.tooltipValueFormat)(total);

// const startTimestamp = this.props.periodDescription.atIndex(values[0].timestamp).toShortTitle();
// const endTimestamp = this.props.periodDescription.atIndex(values[values.length - 1].timestamp).toShortTitle();
// return `${startTimestamp}-${endTimestamp}:<br />${formattedValue} ${this.props.graphDescription.displayableUnit}`;
// }

// mouseover = () => {
// this.svg!.select("g.crosshairs").attr("opacity", 1);
// };

// // Example from https://d3-graph-gallery.com/graph/line_cursor.html
// mousemove = (event: any) => {
// // This allows to find the closest X index of the mouse:
// var bisect = d3.bisector((d: ValueWithTimestamp) => d.timestamp).right;

// const pointerX = d3.pointer(event)[0];
// const pointerDate = this.scaleXForInversion.invert(pointerX);

// var closestIndex = bisect(this.props.series, pointerDate, 1) - 1;

// // Find all y-values to highlight
// const hoveredEntry = this.props.series[closestIndex];

// if (!hoveredEntry) {
// return;
// }

// // Use `scaleXForInversion` because ScaleBand does not return anything,
// // possibly due to imprecise matches.
// const x =
// this.scaleX(this.props.periodDescription.normalize(hoveredEntry.timestamp))! + this.scaleX.bandwidth() / 2;
// const y = this.scaleY(hoveredEntry.value);

// this.svg!.select("g.crosshairs g.horizontal")
// .selectAll("path.value")
// .data([y])
// .join("path")
// .attr("class", "value")
// .attr("stroke", "black")
// .attr("stroke-width", 1)
// .attr("d", (y) => `M${this.padding.left + this.axisWidth},${y} H ${this.width - this.padding.right}`);

// this.svg!.select("g.crosshairs path.vertical")
// .attr("stroke", "black")
// .attr("stroke-width", 1)
// .attr("d", `M${x},${this.padding.top} V ${this.height - this.padding.bottom}`);

// const left = event.pageX + 20 + "px";
// const top = event.pageY - 58 + "px";

// this.showTooltip(this.buildTooltipContentsForSingleMeasurement(hoveredEntry), left, top);
// };

// mouseout = () => {
// this.svg!.select("g.crosshairs").attr("opacity", 0);
// console.log("mouseout");
// this.hideTooltip();
// };

// showTooltip(text: string, left: string, top: string) {
// const tooltip = d3.select("#tooltip");
// tooltip.html(text).style("left", left).style("top", top).style("display", "block");
// }

// hideTooltip() {
// const tooltip = d3.select("#tooltip");

// tooltip.style("display", "none");
// }
// }
// }
// }
