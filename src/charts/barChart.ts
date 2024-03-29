import * as d3 from "d3";
import { GraphDescription } from "../models/GraphDescription";
import { PeriodDescription } from "../models/periodDescriptions/PeriodDescription";
import { ValueWithTimestamp } from "../models/ValueWithTimestamp";

import { getClosestIndex } from "../lib/getClosestIndex";
import { hideTooltip, showTooltip } from "../tooltip";
import { height, padding, xAxisHeight, width } from "./barChartHelpers/constants";
import { initScales, updateScales } from "./barChartHelpers/updateScales";
import { grey, lightGrey } from "../colors";

export type BarChartApi = {
    data(
        periodDescription: PeriodDescription,
        graphDescription: GraphDescription,
        data: ValueWithTimestamp[]
    ): BarChartApi;
    addLineData(data: ValueWithTimestamp[], graphDescription: GraphDescription): BarChartApi;
    removeLineData(): BarChartApi;
    color(color: string): BarChartApi;
    onClick: (handler: (periodDescription: PeriodDescription) => void) => BarChartApi;
    clearCanvas: (value: boolean) => BarChartApi;
    call: (selection: d3.Selection<d3.BaseType, unknown, HTMLElement, BarChartApi>) => void;
};

type Store = {
    data: { periodDescription: PeriodDescription, graphDescription: GraphDescription, values: ValueWithTimestamp[] } | "no_data";
    lineData: { data: ValueWithTimestamp[]; graphDescription: GraphDescription }[];
    color: string;
    colorLight: string;
    relativeMinMax: boolean;
    onValueClick: (periodDescription: PeriodDescription) => void;
    clearCanvas: boolean;
    firstDrawCall: boolean;
    minMaxCalculator: (data: ValueWithTimestamp[]) => { min: number; max: number };
};

export function barChart(): BarChartApi {
    const minMaxCalculator = () => {
        if (store.data === "no_data") {
            throw new Error("No data initialized.");
        }

        const { graphDescription } = store.data;
        return ({ min: graphDescription.minY, max: graphDescription.maxY })
    }

    const store: Store = {
        relativeMinMax: true,
        data: "no_data",
        lineData: [],
        color: grey,
        colorLight: lightGrey,
        onValueClick: () => { /* no-op */ },
        clearCanvas: false,
        firstDrawCall: true,
        minMaxCalculator
    };
    const { scaleX, scaleXForInversion, scaleY } = initScales();

    const calculateBarXPosition = (date: Date) => {
        if (store.data === "no_data") {
            return 0;
        }

        const pos = scaleX(store.data.periodDescription.normalize(date));

        return pos ? pos : 0;
    };

    function drawBars(selection: d3.Selection<d3.BaseType, unknown, HTMLElement, any>) {
        if (store.data === "no_data") {
            throw new Error("Data is not initialized.")
        }

        const { periodDescription, values } = store.data;

        selection
            .select("g.values")
            .selectAll("rect.bar")
            .data<ValueWithTimestamp>(values)
            .join("rect")
            .classed("bar", true)
            .on("click", (_event: any, d) => {
                const clickedPeriod = periodDescription.atDate(d.timestamp);
                store.onValueClick(clickedPeriod);
            })
            .transition()
            .duration(store.firstDrawCall ? 0 : 200)
            .attr("x", (el) => calculateBarXPosition(el.timestamp))
            .attr("y", (el) => scaleY(el.value))
            .attr("height", (el) => scaleY(0) - scaleY(el.value))
            .attr("width", scaleX.bandwidth())
            .attr("fill", store.color)
            .attr("data-value", (el) => el.value)
            .attr("data-timestamp", (el) => el.timestamp.toString())
            .attr("index", (_d: any, i: number) => i);
    }

    function drawLines(selection: d3.Selection<d3.BaseType, unknown, HTMLElement, any>) {
        if (store.data === "no_data") {
            throw new Error("Data was not initialized.");
        }

        const data = store.lineData[0]?.data;

        if (!data) {
            selection.select("g.lines").selectAll("path").remove();
            selection.select("g.lineYAxis").selectAll("*").remove();
            return;
        }

        const periodDescription = store.data.periodDescription;

        const domainX = [periodDescription.startOfPeriod(), periodDescription.endOfPeriod()];
        const lineScaleX = d3.scaleTime().domain(domainX).range(scaleX.range());

        const lineScaleY = d3.scaleLinear().domain([-5, 40]).range(scaleY.range());
        const lineGenerator = d3
            .line<ValueWithTimestamp>()
            .x((d) => lineScaleX(d.timestamp)!)
            .y((d) => lineScaleY(d.value));

        selection
            .select("g.lines")
            .selectAll("path")
            .data(store.lineData)
            .join("path")
            .attr("stroke", "black")
            .attr("fill", "none")
            .transition()
            .duration(200)
            .attr("d", lineGenerator(data));

        const yAxis = d3.axisRight(lineScaleY);

        selection
            .select("g.lineYAxis")
            .attr("transform", `translate(${width - padding.right}, 0)`)
            .call(yAxis as any);
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
        if (store.data === "no_data") {
            return "";
        }

        const data = store.data.values;

        const closestIndex = getClosestIndex(event, scaleXForInversion, data);

        const closestDate = closestIndex.timestamp;
        const value = data[closestIndex.index].value;

        const dateString = d3.timeFormat(store.data.periodDescription.timeFormatString())(closestDate);

        return `${dateString}: <b>${renderDisplayValue(value, store.data.graphDescription)}</b>`;
    }

    function renderDisplayValue(value: number, graphDescription: GraphDescription) {
        return `${d3.format(graphDescription.tooltipValueFormat)(value)} ${graphDescription.displayableUnit}`;
    }

    function highlightActiveBar(selection: d3.Selection<d3.BaseType, unknown, HTMLElement, any>, event: any) {
        if (store.data === "no_data") {
            return;
        }

        const closestIndex = getClosestIndex(event, scaleXForInversion, store.data.values);

        selection
            .select(".values")
            .selectAll("rect")
            .style("fill", (_d, i) => (i === closestIndex.index ? store.colorLight : store.color));
    }

    function unhighlightBar(selection: d3.Selection<d3.BaseType, unknown, HTMLElement, any>) {
        selection.select(".values").selectAll("rect").style("fill", store.color);
    }

    function drawTooltipLine(selection: d3.Selection<d3.BaseType, unknown, HTMLElement, any>, event: any) {
        if (store.data === "no_data") {
            return;
        }

        const tooltipLineSelector = selection.select(".tooltipLine");

        const data = store.data.values;
        const closestIndex = getClosestIndex(event, scaleXForInversion, data);

        const x = scaleX(store.data.periodDescription.normalize(closestIndex.timestamp))!;

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
        data(periodDescription: PeriodDescription, graphDescription: GraphDescription, data: ValueWithTimestamp[]) {
            store.data = { periodDescription, graphDescription, values: data };

            return api;
        },

        addLineData(data: ValueWithTimestamp[], graphDescription: GraphDescription) {
            store.lineData.push({ data, graphDescription });

            return api;
        },

        removeLineData() {
            store.lineData = [];

            return api;
        },

        color(color: string) {
            store.color = color;
            store.colorLight = d3.color(color)!.brighter(1.5).formatHex();
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
            drawLines(selection);

            store.firstDrawCall = false;
        }
    };

    return api;
}

function addSvgChildTags(selection: d3.Selection<d3.BaseType, unknown, HTMLElement, any>) {
    ["tooltipLine", "gridLines", "additionalInfo", "values", "lines", "xAxis", "yAxis", "lineYAxis"].forEach((name) => {
        if (!selection.select(`g.${name}`).node()) {
            selection.append("g").attr("class", name);
        }
    });

    selection.attr("viewBox", "0 0 480 240");
}
