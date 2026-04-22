import * as d3 from "d3";
import * as echarts from "echarts";
import {
    addMonths,
    format,
    getDate,
    getHours,
    getMonth,
    startOfDay,
    startOfMonth,
    startOfTomorrow,
    subDays,
    subMonths
} from "date-fns";
import { monthNames } from "../lib/monthNames";
import { ValueWithTimestamp } from "../models/ValueWithTimestamp";

type GraphType = "hourly_30_days" | "hourly_year" | "year";

type ColorStop = {
    value: number;
    color: string;
};

type Store = {
    colors: ColorStop[];
    backgroundColor?: string;
    data: ValueWithTimestamp[];
    unit: string;
    min: number;
    tickFormat: (domainValue: Date) => string;
    onClick: (date: Date) => void;
};

export function formatMonthNames(domainValue: d3.NumberValue): string {
    return monthNames[getMonth(domainValue as any) + 1];
}

function getChartTextColor(): string {
    return getComputedStyle(document.documentElement).getPropertyValue("--color-text").trim() || "#333";
}

export function heatMap(graphType: GraphType) {
    const store: Store = {
        colors: [
            { value: 0, color: "white" },
            { value: 50, color: "grey" },
            { value: 100, color: "black" }
        ],
        data: [],
        unit: "",
        min: 0,
        onClick: () => { /* no-op */ },
        tickFormat: (value) => value.toString()
    };

    const api = {
        data: (data: ValueWithTimestamp[]) => {
            store.data = data;
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
            const el = (selection as any).node() as HTMLElement;
            if (!el || store.data.length === 0) return api;

            let chart = echarts.getInstanceByDom(el);
            if (chart) chart.dispose();
            chart = echarts.init(el, store.backgroundColor === "black" ? "dark" : undefined);
            const ro = new ResizeObserver(() => chart!.resize());
            ro.observe(el);

            const textColor = store.backgroundColor === "black" ? "#ccc" : getChartTextColor();
            const maxValue = d3.max(store.data, d => d.value) ?? 1;
            const minValue = store.min;

            // Build color scale using D3 for accurate percentile mapping
            const interpolate = d3.interpolate(minValue, maxValue);
            const colorDomain = store.colors.map(s => interpolate(s.value / 100));
            const colorRange = store.colors.map(s => s.color);
            const colorScale = d3.scaleLinear<string>()
                .domain(colorDomain)
                .range(colorRange as any[])
                .clamp(true);

            // Build visualMap pieces for legend
            const f = d3.format(",.2r");
            const pieces = store.colors.map((stop, i) => {
                const absValue = minValue + (stop.value / 100) * (maxValue - minValue);
                const label = `${f(absValue)} ${store.unit}`;
                if (i === store.colors.length - 1) {
                    return { gte: absValue, color: stop.color, label };
                }
                const nextStop = store.colors[i + 1];
                const nextAbsValue = minValue + (nextStop.value / 100) * (maxValue - minValue);
                return { gte: absValue, lt: nextAbsValue, color: stop.color, label };
            });

            // Build axis arrays and data
            let xCategories: string[];
            let yCategories: string[];
            let seriesData: any[];

            if (graphType === "year") {
                // X: months, Y: days 1-31
                const thisYear = addMonths(startOfMonth(new Date()), 1);
                const lastYear = subMonths(thisYear, 13);
                const months: Date[] = [];
                let cur = lastYear;
                while (cur < thisYear) {
                    months.push(cur);
                    cur = addMonths(cur, 1);
                }
                xCategories = months.map(m => store.tickFormat(m));
                yCategories = Array.from({ length: 31 }, (_, i) => String(i + 1));

                seriesData = store.data.map(d => {
                    const monthStart = startOfMonth(d.timestamp);
                    const xIdx = months.findIndex(m => m.getTime() === monthStart.getTime());
                    const yIdx = getDate(d.timestamp) - 1;
                    if (xIdx < 0) return null;
                    return {
                        value: [xIdx, yIdx, d.value, d.timestamp.getTime()],
                        itemStyle: { color: colorScale(d.value) }
                    };
                }).filter(Boolean);

            } else {
                // Hourly: X = days, Y = hours 0-23
                const daysCount = graphType === "hourly_30_days" ? 30 : 365;
                const startDate = startOfDay(subDays(new Date(), daysCount));
                const endDate = startOfTomorrow();

                const days: Date[] = [];
                let day = startDate;
                while (day < endDate) {
                    days.push(day);
                    day = new Date(day.getTime() + 86400000);
                }

                xCategories = days.map(d => store.tickFormat(d));
                yCategories = Array.from({ length: 24 }, (_, i) => String(i));

                seriesData = store.data.map(d => {
                    const dayStart = startOfDay(d.timestamp);
                    const xIdx = days.findIndex(day => day.getTime() === dayStart.getTime());
                    const yIdx = getHours(d.timestamp);
                    if (xIdx < 0) return null;
                    return {
                        value: [xIdx, yIdx, d.value, d.timestamp.getTime()],
                        itemStyle: { color: colorScale(d.value) }
                    };
                }).filter(Boolean);
            }

            const option: any = {
                textStyle: { color: textColor },
                backgroundColor: store.backgroundColor ?? "transparent",
                grid: { top: 10, right: 115, bottom: 25, left: 40 },
                tooltip: {
                    trigger: "item",
                    formatter(params: any) {
                        const [, , value, tsMs] = params.data.value;
                        const ts = new Date(tsMs);
                        const dateStr = format(ts, "eee yyyy-MM-dd HH:00");
                        return `${dateStr}<br/>Waarde: <b>${d3.format(".2f")(value)}</b> ${store.unit}`;
                    }
                },
                xAxis: {
                    type: "category",
                    data: xCategories,
                    splitArea: { show: false },
                    axisLabel: {
                        color: textColor,
                        interval: graphType === "hourly_year" ? Math.floor(xCategories.length / 12) : "auto"
                    },
                    axisLine: { lineStyle: { color: textColor } }
                },
                yAxis: {
                    type: "category",
                    data: yCategories,
                    inverse: graphType === "year" ? false : false,
                    splitArea: { show: false },
                    axisLabel: { color: textColor }
                },
                visualMap: {
                    type: "piecewise",
                    pieces,
                    orient: "vertical",
                    right: 5,
                    top: "middle",
                    textStyle: { color: textColor },
                    itemWidth: 12,
                    itemHeight: 12,
                    formatter: (val: number) => `${f(val)} ${store.unit}`
                },
                series: [{
                    type: "heatmap",
                    data: seriesData,
                    label: { show: false },
                    emphasis: { itemStyle: { shadowBlur: 5, shadowColor: "rgba(0,0,0,0.5)" } }
                }]
            };

            chart.off("click");
            chart.on("click", (params: any) => {
                if (params.data && params.data.value) {
                    const tsMs = params.data.value[3];
                    store.onClick(new Date(tsMs));
                }
            });

            chart.setOption(option);

            return api;
        }
    };

    return api;
}
