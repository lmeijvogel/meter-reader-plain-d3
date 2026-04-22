import * as d3 from "d3";
import * as echarts from "echarts";
import { addDays } from "date-fns";

import { ValueWithTimestamp } from "../models/ValueWithTimestamp";
import { GraphDescription } from "../models/GraphDescription";
import { PeriodDescription } from "../models/periodDescriptions/PeriodDescription";
import { HouseLocation } from "../models/HouseLocation";
import { getTimes } from "suncalc";
import { getMaximumIncidentSunlight } from "../lib/calculatePotentialIncidentSunlight";

export type Series = {
    name: string;
    values: ValueWithTimestamp[];
    lineColor: string;
    strokeWidth?: number;
    fill?: {
        positive: string;
        negative: string;
    };
};

export type LineChartApi = {
    setData(periodDescription: PeriodDescription, graphDescription: GraphDescription, series: Series[]): LineChartApi;
    animate: (value: boolean) => LineChartApi;
    domain(domain: [number, number]): LineChartApi;
    minMaxCalculation: (method: "minMax" | "quantile") => LineChartApi;
    clearCanvas: (value: boolean) => LineChartApi;
    renderOutsideLightShading: (value: boolean) => LineChartApi;
    call: (selection: d3.Selection<d3.BaseType, unknown, HTMLElement, any>) => LineChartApi;
};

type Store = {
    animate: boolean;
    minMaxCalculation: "explicit" | "minMax" | "quantile";
    seriesCollection:
        | { periodDescription: PeriodDescription; graphDescription: GraphDescription; series: Series[] }
        | "not_set";
    domain?: [number, number];
    clearCanvas: boolean;
    renderOutsideLightShading: boolean;
};

function getChartTextColor(): string {
    return getComputedStyle(document.documentElement).getPropertyValue("--color-text").trim() || "#333";
}

function computeDomainY(store: Store): [number, number] {
    if (store.seriesCollection === "not_set") return [0, 1];

    if (store.renderOutsideLightShading) {
        const max = getMaximumIncidentSunlight(store.seriesCollection.periodDescription.startOfPeriod());
        return [0, max];
    }

    if (store.minMaxCalculation === "explicit") {
        return store.domain!;
    }

    const allValues = store.seriesCollection.series.flatMap((s) => s.values.map((v) => v.value));

    if (allValues.length === 0) return [0, 1];

    if (store.minMaxCalculation === "quantile") {
        const sorted = [...allValues].sort((a, b) => a - b);
        let min = sorted[Math.floor(sorted.length * 0.05)] ?? sorted[0];
        let max = sorted[Math.floor(sorted.length * 0.95)] ?? sorted[sorted.length - 1];

        if (max < 0) max = -min / 3;
        if (min > 0) min = -max / 3;

        return [min - Math.abs(min * 0.1), max + Math.abs(max * 1.0)];
    } else {
        // minMax
        const min = Math.min(...allValues) * 0.95;
        const max = Math.max(...allValues) * 1.1;
        return [min, max];
    }
}

export function lineChart(): LineChartApi {
    const store: Store = {
        animate: true,
        minMaxCalculation: "explicit",
        seriesCollection: "not_set",
        clearCanvas: false,
        renderOutsideLightShading: false,
    };

    const call = (selection: d3.Selection<d3.BaseType, unknown, HTMLElement, any>): LineChartApi => {
        if (store.seriesCollection === "not_set") return api;

        const el = (selection as any).node() as HTMLElement;
        if (!el) return api;

        if (store.clearCanvas) {
            const existing = echarts.getInstanceByDom(el);
            if (existing) existing.dispose();
        }

        let chart = echarts.getInstanceByDom(el);
        if (!chart) {
            chart = echarts.init(el);
            const ro = new ResizeObserver(() => chart!.resize());
            ro.observe(el);
        }

        const { periodDescription, graphDescription, series } = store.seriesCollection;
        const [yMin, yMax] = computeDomainY(store);
        const textColor = getChartTextColor();

        // For fill series: compute a LinearGradient that transitions at y=0,
        // avoiding the piecewise visualMap which crashes when data doesn't cross zero.
        const getFillGradient = (fill: { positive: string; negative: string }) => {
            const range = yMax - yMin;
            if (range === 0) return fill.positive;
            let zeroOffset: number;
            if (yMax <= 0) {
                zeroOffset = 0;
            } else if (yMin >= 0) {
                zeroOffset = 1;
            } else {
                zeroOffset = yMax / range;
            }
            return new (echarts as any).graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: fill.positive },
                { offset: zeroOffset, color: fill.positive },
                { offset: zeroOffset, color: fill.negative },
                { offset: 1, color: fill.negative },
            ]);
        };

        // Build ECharts series
        const eChartsSeries: any[] = series.map((s) => {
            const data: [number, number][] = s.values.map((v) => [v.timestamp.getTime(), v.value]);

            const seriesOption: any = {
                name: s.name,
                type: "line",
                data,
                smooth: true,
                showSymbol: false,
                lineStyle: {
                    color: s.lineColor,
                    width: s.strokeWidth ?? (s.fill ? 1 : 2),
                },
                itemStyle: { color: s.lineColor },
            };

            if (s.fill) {
                seriesOption.areaStyle = { color: getFillGradient(s.fill) };
            }

            return seriesOption;
        });

        const visualMap: any[] = [];

        // Solar incidence overlay as markArea
        const markAreas: any[] = [];
        if (store.renderOutsideLightShading) {
            const date = addDays(periodDescription.toDate(), 1);
            const times = getTimes(date, HouseLocation.latitude, HouseLocation.longitude);
            const nightStart = periodDescription.startOfPeriod().getTime();
            const dawn = (times.dawn as Date).getTime();
            const sunrise = (times.sunrise as Date).getTime();
            const sunset = (times.sunset as Date).getTime();
            const dusk = (times.dusk as Date).getTime();
            const nightEnd2 = periodDescription.endOfPeriod().getTime();

            const nightColor = "rgb(40,40,120)";
            const twilightColor = "rgb(100,100,160)";

            // Night before dawn
            if (nightStart < dawn) {
                markAreas.push([{ xAxis: nightStart, itemStyle: { color: nightColor } }, { xAxis: dawn }]);
            }
            // Dawn transition
            if (dawn < sunrise) {
                markAreas.push([{ xAxis: dawn, itemStyle: { color: twilightColor } }, { xAxis: sunrise }]);
            }
            // Dusk transition
            if (sunset < dusk) {
                markAreas.push([{ xAxis: sunset, itemStyle: { color: twilightColor } }, { xAxis: dusk }]);
            }
            // Night after dusk
            if (dusk < nightEnd2) {
                markAreas.push([{ xAxis: dusk, itemStyle: { color: nightColor } }, { xAxis: nightEnd2 }]);
            }

            if (eChartsSeries.length > 0 && markAreas.length > 0) {
                eChartsSeries[0].markArea = {
                    silent: true,
                    data: markAreas,
                };
            }
        }

        const option: any = {
            animation: store.animate,
            textStyle: { color: textColor },
            backgroundColor: "transparent",
            grid: { top: 10, right: 30, bottom: 25, left: 55 },
            tooltip: {
                trigger: "axis",
                axisPointer: { type: "cross" },
                formatter(params: any) {
                    if (!params.length) return "";
                    const ts = new Date(params[0].value[0]);
                    const dateStr = d3.timeFormat(periodDescription.timeFormatString())(ts);

                    const lines = params
                        .filter((p: any) => p.value[1] != null)
                        .map((p: any) => {
                            const val = p.value[1];
                            const formatted = `${d3.format(graphDescription.tooltipValueFormat)(val)} ${
                                graphDescription.displayableUnit
                            }`;
                            return `<span style="display:inline-block;width:10px;height:10px;background:${p.color};margin-right:4px"></span>${p.seriesName}: <b>${formatted}</b>`;
                        })
                        .join("<br/>");

                    return `<b>${dateStr}</b><br/>${lines}`;
                },
            },
            xAxis: {
                type: "time",
                axisLabel: {
                    color: textColor,
                    formatter: (value: number) => d3.timeFormat(periodDescription.tickFormatString())(new Date(value)),
                },
                axisLine: { lineStyle: { color: textColor } },
                min: periodDescription.startOfPeriod().getTime(),
                max: periodDescription.endOfPeriod().getTime(),
            },
            yAxis: {
                type: "value",
                min: yMin,
                max: yMax,
                axisLabel: { color: textColor, formatter: (value: number) => d3.format(".2f")(value) },
            },
            visualMap: visualMap.length > 0 ? visualMap : undefined,
            series: eChartsSeries,
        };

        chart.setOption(option, true);

        return api;
    };

    const api: LineChartApi = {
        setData(periodDescription, graphDescription, series) {
            store.seriesCollection = { periodDescription, graphDescription, series };
            return api;
        },

        animate(value) {
            store.animate = value;
            return api;
        },

        domain(domain) {
            store.domain = domain;
            store.minMaxCalculation = "explicit";
            return api;
        },

        minMaxCalculation(method) {
            store.minMaxCalculation = method;
            return api;
        },

        clearCanvas(value) {
            store.clearCanvas = value;
            return api;
        },

        renderOutsideLightShading(value) {
            store.renderOutsideLightShading = value;
            return api;
        },

        call,
    };

    return api;
}
