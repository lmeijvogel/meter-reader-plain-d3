import * as d3 from "d3";
import { addMonths, format, getDate, getHours, getMonth, startOfDay, startOfMonth, startOfTomorrow, subDays, subMonths } from "date-fns";
import { monthNames } from "../lib/monthNames";
import { ValueWithTimestamp } from "../models/ValueWithTimestamp";
import { hideTooltip, showTooltip } from "../tooltip";

type GraphType = "hourly_30_days" | "hourly_year" | "year";

const xAxisWidth = 40;
const yAxisHeight = 20;

const legendWidth = 100;
const width = 480;
const height = 240;

const padding = 10;

type ColorStop = {
    value: number;
    color: string;
};

type Store = {
    colors: ColorStop[];
    backgroundColor?: string;
    data: ValueWithTimestamp[];
    cellWidth: number;
    cellHeight: number;
    unit: string;
    min: number;
    mapX: (d: ValueWithTimestamp) => number;
    mapY: (d: ValueWithTimestamp) => number;
    scaleX: d3.ScaleTime<number, number, never>;
    scaleY: d3.ScaleLinear<number, number, never>;
    tickFormat: (domainValue: Date) => string;
    onClick: (date: Date) => void;
};

export function formatMonthNames(domainValue: d3.NumberValue): string {
    return monthNames[getMonth(domainValue as any) + 1]; // Months are 0-based
}

export function heatMap(graphType: GraphType) {
    const store: Store = {
        colors: [
            {
                value: 0,
                color: "white"
            },
            {
                value: 50,
                color: "grey"
            },
            {
                value: 100,
                color: "black"
            }
        ],
        data: [],
        cellWidth: 10,
        cellHeight: 10,
        unit: "",
        scaleX: d3.scaleTime(),
        scaleY: d3.scaleLinear(),
        min: 0,
        mapX: () => 0,
        mapY: () => 0,
        onClick: () => {
            /* no-op */
        },
        tickFormat: (value) => value.toString()
    };

    const api = {
        data: (data: ValueWithTimestamp[]) => {
            store.data = data;

            const numberOfColumns = graphType === "hourly_30_days" ? 30 : (graphType === "hourly_year") ? 365 : 13;
            const numberOfRows = graphType === "year" ? 31 : 24;

            // Some funky bookkeeping here, but we want the last label of the yearly graph to show
            // the start of next month, so a column for, e.g., April starts at April and ends at May.
            const thisYear = addMonths(startOfMonth(new Date()), 1);
            const lastYear = subMonths(thisYear, 13);

            const xDomain =
                graphType === "hourly_30_days" ? [startOfDay(subDays(new Date(), 30)), startOfTomorrow()] :
                    graphType === "hourly_year" ? [startOfDay(subDays(new Date(), 365)), new Date()] :
                        [lastYear, thisYear];

            const yDomain = graphType === "year" ? [31, 0] : [24, 0];

            if (graphType === "year") {
                store.mapX = (d) => store.scaleX(startOfMonth(d.timestamp));
                store.mapY = (d) => store.scaleY(getDate(d.timestamp)) ?? 0;
            } else {
                store.mapX = (d) => store.scaleX(startOfDay(d.timestamp));
                store.mapY = (d) => store.scaleY(getHours(d.timestamp)) - store.cellHeight ?? 0;
            }

            store.scaleX.domain(xDomain);
            store.scaleY.domain(yDomain);

            const graphBounds = calculateGraphBounds();

            store.cellWidth = graphBounds.width / numberOfColumns;
            store.cellHeight = graphBounds.height / numberOfRows;

            store.scaleX.range([graphBounds.left, graphBounds.right]);
            store.scaleY.range([graphBounds.top, graphBounds.bottom]);

            return api;
        },

        colors: (colors: ColorStop[]) => {
            store.colors = colors;

            return api;
        },

        backgroundColor(color: string) {
            store.backgroundColor = color;

            return api;
        },

        unit: (unit: string) => {
            store.unit = unit;

            return api;
        },

        min: (min: number) => {
            store.min = min;

            return api;
        },

        tickFormat: (formatter: (domainValue: Date) => string) => {
            store.tickFormat = formatter;
            return api;
        },

        onClick: (handler: (date: Date) => void) => {
            store.onClick = handler;

            return api;
        },

        draw: (selection: d3.Selection<d3.BaseType, unknown, HTMLElement, any>) => {
            selection.attr("viewBox", "0 0 480 240");

            ["background", "values", "xAxis axis", "yAxis axis", "legend"].forEach((className) =>
                addContainerIfNotExists(selection, className)
            );

            if (store.backgroundColor) {
                drawBackground(selection, store.backgroundColor);
            }

            drawData(selection, store);

            drawAxes(selection, store);

            drawLegend(selection, store);

            return api;
        }
    };

    return api;
}

function buildColorScale(store: Store) {
    const values = store.data.map((v) => v.value);

    const min = store.min;
    const max = d3.max(values)!;

    const interpolate = d3.interpolate(min, max);
    const domain = store.colors.map((stop) => interpolate(stop.value / 100));
    const range = store.colors.map((color) => color.color);

    return d3
        .scaleLinear()
        .domain(domain)
        .range(range as any[])
        .clamp(true);
}

function drawData(svg: d3.Selection<d3.BaseType, unknown, HTMLElement, any>, store: Store) {
    const colorScale = buildColorScale(store);

    svg.select(".values")
        .selectAll("rect")
        .data(store.data)
        .join("rect")
        .attr("x", (d) => store.mapX(d))
        .attr("y", (d) => store.mapY(d))
        .attr("width", store.cellWidth)
        .attr("height", store.cellHeight)
        .attr("stroke", "none")
        .attr("fill", (d) => colorScale(d.value ?? 0))
        .on("mouseover", (event, d) => {
            /* Sadly, it seems to be difficult to have a mouseover handler
             * for the whole canvas, since it's not trivial to get the date
             * from the current x,y-coordinates.
             *
             * For the other charts, it's easier since there's only one
             * scale to go over, while here there are two.
             */
            showTooltip(event, () => {
                const dateString = format(d.timestamp, "eee yyyy-MM-dd HH:00");

                const contents = `${dateString}<br />Waarde: <b>${d3.format(".2f")(d.value)}</b> ${store.unit}`;

                return contents;
            });
        })
        .on("mouseout", hideTooltip)
        .on("click", (_event, d) => {
            store.onClick(d.timestamp);
        });
}

function drawLegend(svg: d3.Selection<d3.BaseType, unknown, HTMLElement, any>, store: Store) {
    const { top, bottom } = calculateGraphBounds();

    const graphCenter = bottom + (top - bottom / 2)

    const labelBaseY = (i: number) => graphCenter + padding + ((i - store.colors.length / 2) * 20);

    svg.select(".legend")
        .selectAll("rect.color")
        .data(store.colors)
        .join("rect")
        .classed("color", true)
        .attr("x", width - padding - legendWidth)
        .attr("y", (_d, i) => labelBaseY(i))
        .attr("width", 10)
        .attr("height", 10)
        .attr("stroke", "black")
        .attr("fill", d => d.color);

    const f = d3.format(",.2r");
    const max = d3.max(store.data, d => d.value) ?? 0;

    svg.select(".legend")
        .selectAll("text.value")
        .data(store.colors)
        .join("text")
        .classed("value", true)
        .attr("x", width - padding - legendWidth + 25)
        .attr("y", (_d, i) => labelBaseY(i) + 12)
        .text(d => `${f((d.value / 100) * max)} ${store.unit}`);

}

function drawBackground(svg: d3.Selection<d3.BaseType, unknown, HTMLElement, any>, color: string) {
    const graphBounds = calculateGraphBounds();

    svg.select(".background")
        .append("rect")
        .attr("x", graphBounds.left)
        .attr("y", graphBounds.top)
        .attr("width", graphBounds.width)
        .attr("height", graphBounds.height)
        .attr("fill", color)
        .attr("stroke", "none");
}

function drawAxes(svg: d3.Selection<d3.BaseType, unknown, HTMLElement, any>, store: Store) {
    const xAxis = d3.axisBottom(store.scaleX).tickFormat(store.tickFormat as any);

    const xAxisContainer = svg.select(".xAxis").attr("transform", `translate(0, ${store.scaleY(0)})`);

    const yAxis = d3.axisLeft(store.scaleY);
    const yAxisContainer = svg.select(".yAxis").attr("transform", `translate(${padding + xAxisWidth}, 0)`);

    xAxisContainer.call(xAxis as any);
    yAxisContainer.call(yAxis as any);
}

function addContainerIfNotExists(
    selection: d3.Selection<d3.BaseType, unknown, HTMLElement, any>,
    className: string
): void {
    if (selection.filter(`.${className}`).empty()) {
        const container = selection.append("g");
        container.attr("class", className);
    }
}
function calculateGraphBounds() {
    const top = padding;
    const bottom = height - 2 * padding - yAxisHeight;
    const left = padding + xAxisWidth;
    const right = width - legendWidth - 2 * padding;

    const graphWidth = right - left;
    const graphHeight = bottom - top;

    return {
        top,
        bottom,
        left,
        right,
        width: graphWidth,
        height: graphHeight
    };
}
