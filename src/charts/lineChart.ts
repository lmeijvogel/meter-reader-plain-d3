import * as d3 from "d3";
import { isDefined } from "../lib/isDefined";
import { PeriodDescription } from "../models/PeriodDescription";
import { ValueWithTimestamp } from "../models/ValueWithTimestamp";

import { format } from "date-fns";
import { getWindowWidth } from "../lib/getWindowWidth";

type SeriesCollection = Map<string, { series: ValueWithTimestamp[]; lineColor: string }>;

type Store = {
    fillArea?: boolean;
    lineColors?: Map<string, string>;
    defaultLineColor: string;
    relativeMinMax: boolean;
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
        relativeMinMax: false,
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
                const tooltipX = event.pageX + 20;

                const tooltipSelector = d3.select("#tooltip");

                const fitsOnRight = tooltipX + tooltipWidth < windowWidth;

                // Show the tooltip to the left if it doesn't fit to the right of the cursor
                const left = fitsOnRight ? event.pageX + 20 + "px" : event.pageX - tooltipWidth - 80 + "px";

                tooltipSelector
                    .style("top", event.pageY - 170 + "px")
                    .style("left", left)

                    .html(() => {
                        // This allows to find the closest X index of the mouse:
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
                                return `<tr><td>${name}:</td>
                                    <td class="tableValue">${d3.format(store.tooltipValueFormat)(value)} ${
                                    store.tooltipDisplayableUnit
                                }</td></tr>`;
                            })
                            .join("");
                        return `<b>${dateString}</b><table><tbody>${valueLines}</tbody></table>`;
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
            .x((d) => {
                return scaleX(d.timestamp);
            })
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
        ["gridLines", "additionalInfo", "values", "xAxis", "yAxis"].forEach((className) => {
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
        const allValues = Array.from(store.seriesCollection.values()).flatMap((series) =>
            series.series.map((s) => s.value)
        );
        const min = Math.min(...allValues) * 0.95;
        const max = Math.max(...allValues) * 1.05;
        return [min, max];
    }

    return api;
}
