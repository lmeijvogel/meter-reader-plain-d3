import * as d3 from "d3";
import { GraphDescription } from "../models/GraphDescription";
import { PeriodDescription } from "../models/PeriodDescription";
import { ValueWithTimestamp } from "../models/ValueWithTimestamp";

import { getClosestIndex } from "../lib/getClosestIndex";
import { hideTooltip, showTooltip } from "../tooltip";
import { height, padding, xAxisHeight } from "./barChartHelpers/constants";
import { initScales, updateScales } from "./barChartHelpers/updateScales";

type Store = {
    periodDescription: PeriodDescription;
    barColor: string;
    tooltipDateFormat: string;
    tooltipValueFormat: string;
    tooltipDisplayableUnit: string;
    data: ValueWithTimestamp[];
    relativeMinMax: boolean;
    unit: string;
    onValueClick: (periodDescription: PeriodDescription) => void;
    clearCanvas: boolean;
    firstDrawCall: boolean;
    minMaxCalculator: (data: ValueWithTimestamp[]) => { min: number; max: number };
};

export function barChart(periodDescription: PeriodDescription, graphDescription: GraphDescription) {
    const store: Store = {
        periodDescription: periodDescription,
        tooltipDateFormat: periodDescription.timeFormatString(),
        tooltipValueFormat: graphDescription.tooltipValueFormat,
        tooltipDisplayableUnit: graphDescription.displayableUnit,
        barColor: graphDescription.barColor,
        relativeMinMax: true,
        data: [],
        unit: graphDescription.displayableUnit,
        onValueClick: () => {},
        clearCanvas: false,
        firstDrawCall: true,
        minMaxCalculator: () => ({ min: graphDescription.minY, max: graphDescription.maxY })
    };
    const { scaleX, scaleXForInversion, scaleY } = initScales();

    const calculateBarXPosition = (date: Date) => {
        const { periodDescription } = store;
        const pos = scaleX(periodDescription.normalize(date));

        return !!pos ? pos : 0;
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
            unhighlightBar(selection);
        });

        selection.on("mousemove", (event) => {
            showTooltip(event, () => getHoverTooltipContents(event));
            highlightActiveBar(selection, event);

            drawTooltipLine(selection, event);
        });
    }

    function getHoverTooltipContents(event: any): string {
        const data = store.data;

        var closestIndex = getClosestIndex(event, scaleXForInversion, data);

        const closestDate = closestIndex.timestamp;
        const value = data[closestIndex.index].value;

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
                i === closestIndex.index ? graphDescription.lightColor : graphDescription.barColor
            );
    }

    function unhighlightBar(selection: d3.Selection<d3.BaseType, unknown, HTMLElement, any>) {
        selection.select(".values").selectAll("rect").style("fill", graphDescription.barColor);
    }

    function drawTooltipLine(selection: d3.Selection<d3.BaseType, unknown, HTMLElement, any>, event: any) {
        const tooltipLineSelector = selection.select(".tooltipLine");

        const data = store.data;
        const closestIndex = getClosestIndex(event, scaleXForInversion, data);

        const x = scaleX(periodDescription.normalize(closestIndex.timestamp))!;

        tooltipLineSelector
            .selectAll("line")
            .data([x])
            .join("line")
            .attr("x1", (x) => x + scaleX.bandwidth() / 2)
            .attr("x2", (x) => x + scaleX.bandwidth() / 2)
            .attr("y1", padding.top)
            .attr("y2", height - padding.bottom - xAxisHeight)
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
            hideTooltip();

            if (store.firstDrawCall) {
                addSvgChildTags(selection);
            }

            registerEventHandlers(selection);
            updateScales(selection, store.firstDrawCall, scaleX, scaleXForInversion, scaleY, store);

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
