// import classNames from "classnames";
import * as d3 from "d3";
import { format, getDate, getHours, getMonth, startOfDay, startOfMonth, subDays, subYears } from "date-fns";
import { monthNames } from "../lib/monthNames";
import { MeasurementEntry } from "../models/MeasurementEntry";

import { tip as d3tip } from "d3-v6-tip";
import { PeriodDescription } from "../models/PeriodDescription";

type GraphType = "30_days" | "year";

const borderGrey = "#ccc";
const xAxisWidth = 40;
const yAxisHeight = 20;

const width = 480;
const height = 240;

const padding = 10;

const widthForGraph = width - 2 * padding - xAxisWidth;
const heightForGraph = height - 2 * padding - yAxisHeight;

const lastYear = subYears(startOfMonth(new Date()), 1);
const thisYear = startOfMonth(new Date());

type Store = {
    lightColor: string;
    midColor: string;
    darkColor: string;
    data: MeasurementEntry[];
    cellWidth: number;
    cellHeight: number;
    unit: string;
    min: number;
    mapX: (d: MeasurementEntry) => number;
    mapY: (d: MeasurementEntry) => number;
    scaleX: d3.ScaleTime<number, number, never>;
    scaleY: d3.ScaleLinear<number, number, never>;
    tickFormat: (domainValue: Date) => string;
    onClick: (date: Date) => void;
};

export function formatMonthNames(domainValue: d3.NumberValue): string {
    return monthNames[getMonth(domainValue as any) + 1]; // Months are 0-based
}

export function heatMap(graphType: GraphType) {
    let tip: any;

    const store: Store = {
        lightColor: "#ffffff",
        midColor: "#808080",
        darkColor: "000000",
        data: [],
        cellWidth: 10,
        cellHeight: 10,
        unit: "",
        scaleX: d3.scaleTime(),
        scaleY: d3.scaleLinear(),
        min: 0,
        mapX: () => 0,
        mapY: () => 0,
        onClick: () => {},
        tickFormat: (value) => value.toString()
    };

    const api = {
        data: (data: MeasurementEntry[]) => {
            store.data = data;

            const numberOfColumns = graphType === "30_days" ? 30 : 13;
            const numberOfRows = graphType === "30_days" ? 24 : 31;

            const xDomain =
                graphType === "30_days" ? [startOfDay(subDays(new Date(), 30)), new Date()] : [lastYear, thisYear];

            const yDomain = graphType === "30_days" ? [24, 0] : [31, 0];

            if (graphType === "30_days") {
                store.mapX = (d) => store.scaleX(startOfDay(d.timestamp)) - store.cellWidth / 2;
                store.mapY = (d) => store.scaleY(getHours(d.timestamp)) - store.cellHeight ?? 0;
            } else {
                store.mapX = (d) => store.scaleX(startOfMonth(d.timestamp)) - store.cellWidth / 2;
                store.mapY = (d) => store.scaleY(getDate(d.timestamp)) ?? 0;
            }

            store.scaleX.domain(xDomain);
            store.scaleY.domain(yDomain);
            store.cellWidth = widthForGraph / numberOfColumns;
            store.cellHeight = heightForGraph / numberOfRows;
            store.scaleX.range([padding + xAxisWidth + store.cellWidth / 2, width - padding - store.cellWidth / 2]);
            store.scaleY.range([padding + store.cellHeight / 2, height - yAxisHeight - padding - store.cellHeight / 2]);

            return api;
        },

        colors: (...args: string[]) => {
            if (args.length === 1) {
                store.darkColor = args[0];
                store.midColor = d3.scaleLinear().range([store.darkColor, store.lightColor] as any)(0.5) as any;
            } else if (args.length === 2) {
                store.lightColor = args[0];
                store.darkColor = args[1];
                store.midColor = d3.scaleLinear().range([store.darkColor, store.lightColor] as any)(0.5) as any;
            } else if (args.length === 3) {
                store.lightColor = args[0];
                store.midColor = args[1];
                store.darkColor = args[2];
            } else {
                throw new Error("Expected 1-3 arguments");
            }

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

            ["values", "xAxis", "yAxis"].forEach((className) => addContainerIfNotExists(selection, className));

            /* Initialize tooltip */
            tip = d3tip()
                .attr("class", "d3-tip")
                .offset([-store.cellHeight / 2, 0])
                .html((_event: unknown, d: MeasurementEntry) => {
                    const dateString = format(d.timestamp, "eee yyyy-MM-dd HH:00");

                    const contents = `${dateString}<br />Waarde: <b>${d3.format(".2f")(d.value)}</b> ${store.unit}`;

                    return contents;
                });
            selection.call(tip);

            drawBorder(selection);
            drawData(selection, store, tip);

            drawAxes(selection, store);

            return api;
        }
    };

    return api;
}

function buildColorScale(store: Store) {
    const values = store.data.map((v) => v.value);
    const min = store.min;
    let median = d3.median(values.filter((value) => value !== 0));

    const max = d3.max(values);

    return d3
        .scaleLinear()
        .domain([min, median!, max!])
        .range([store.lightColor, store.midColor, store.darkColor] as any[])
        .clamp(true);
}

function drawData(svg: d3.Selection<d3.BaseType, unknown, HTMLElement, any>, store: Store, tip: any) {
    const colorScale = buildColorScale(store);

    svg.select(".values")
        .selectAll("rect")
        .data(store.data)
        .join("rect")
        .attr("x", (d) => store.mapX(d))
        .attr("y", (d) => store.mapY(d))
        .attr("width", store.cellWidth)
        .attr("height", store.cellHeight)
        .attr("fill", (d) => colorScale(d.value ?? 0))
        .text((d) => d.value)
        .on("mouseover", (event, d) => {
            tip.show(event, d);
        })
        .on("mouseout", tip.hide)
        .on("click", (_event, d) => {
            store.onClick(d.timestamp);
        });
}

function drawBorder(svg: d3.Selection<d3.BaseType, unknown, HTMLElement, any>) {
    svg.append("rect")
        .attr("x", padding)
        .attr("y", padding)
        .attr("width", width - 2 * padding)
        .attr("height", height - 2 * padding)
        .attr("fill", "none")
        .attr("stroke-width", "1px");
}

function drawAxes(svg: d3.Selection<d3.BaseType, unknown, HTMLElement, any>, store: Store) {
    const xAxis = d3.axisBottom(store.scaleX).tickFormat(store.tickFormat);

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
