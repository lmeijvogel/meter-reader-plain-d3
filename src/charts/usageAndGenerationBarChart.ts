import * as d3 from "d3";
import * as echarts from "echarts";
import { GraphDescription } from "../models/GraphDescription";
import { isEqual } from "date-fns";
import { stroomBackDeliveryColor, stroomGenerationColor, stroomUsageGraphColor } from "../colors";
import { PeriodDescription } from "../models/periodDescriptions/PeriodDescription";
import { ValueWithTimestamp } from "../models/ValueWithTimestamp";

export type UsageAndGenerationBarChartApi = {
    data(periodDescription: PeriodDescription, graphDescription: GraphDescription, data: Data): UsageAndGenerationBarChartApi;
    onClick(handler: (periodDescription: PeriodDescription) => void): UsageAndGenerationBarChartApi;
    clearCanvas(value: boolean): UsageAndGenerationBarChartApi;
    call(selection: d3.Selection<d3.BaseType, unknown, HTMLElement, any>): void;
};

type Data = {
    consumption: ValueWithTimestamp[];
    generation: ValueWithTimestamp[];
    backDelivery: ValueWithTimestamp[];
};

type ConsolidatedData = {
    timestamp: Date;
    gridSource: number;
    solarSelfUse: number;
    backDelivery: number;
};

function getChartTextColor(): string {
    return getComputedStyle(document.documentElement).getPropertyValue("--color-text").trim() || "#333";
}

function consolidateData(input: Data): ConsolidatedData[] {
    const getDates = (arr: ValueWithTimestamp[]) => arr.map(el => el.timestamp);
    const dataFields: (keyof Data)[] = ["consumption", "generation", "backDelivery"];
    const timestamps = d3.sort(d3.union(dataFields.flatMap(field => getDates(input[field]))));

    return timestamps.map(ts => {
        const consumption = input.consumption.find(el => isEqual(el.timestamp, ts))?.value ?? 0;
        const generation = input.generation.find(el => isEqual(el.timestamp, ts))?.value ?? 0;
        const backDelivery = input.backDelivery.find(el => isEqual(el.timestamp, ts))?.value ?? 0;

        // backDelivery is already negative in the input (negated in fetchAndDrawStroomChart)
        // solarSelfUse = total generation minus what went back = generation + backDelivery (since backDelivery < 0)
        return {
            timestamp: ts,
            gridSource: consumption,
            solarSelfUse: generation + backDelivery,
            backDelivery
        };
    });
}

export function usageAndGenerationBarChart(): UsageAndGenerationBarChartApi {
    let currentPeriodDescription: PeriodDescription | null = null;
    let currentGraphDescription: GraphDescription | null = null;
    let consolidatedValues: ConsolidatedData[] = [];
    let onValueClick: (pd: PeriodDescription) => void = () => { /* no-op */ };
    let shouldClearCanvas = false;

    const call = (selection: d3.Selection<d3.BaseType, unknown, HTMLElement, any>) => {
        if (!currentPeriodDescription || !currentGraphDescription) return;

        const el = (selection as any).node() as HTMLElement;
        if (!el) return;

        if (shouldClearCanvas) {
            const existing = echarts.getInstanceByDom(el);
            if (existing) existing.dispose();
        }

        let chart = echarts.getInstanceByDom(el);
        if (!chart) {
            chart = echarts.init(el);
            const ro = new ResizeObserver(() => chart!.resize());
            ro.observe(el);
        }

        const pd = currentPeriodDescription;
        const gd = currentGraphDescription;
        const values = consolidatedValues;

        const formatX = d3.timeFormat(pd.tickFormatString());
        const xLabels = values.map(v => formatX(pd.normalize(v.timestamp)));

        const textColor = getChartTextColor();

        const option: any = {
            textStyle: { color: textColor },
            backgroundColor: "transparent",
            grid: { top: 10, right: 30, bottom: 25, left: 55 },
            tooltip: {
                trigger: "axis",
                formatter(params: any) {
                    if (!params.length) return "";
                    const idx = params[0].dataIndex;
                    if (idx < 0 || idx >= values.length) return "";
                    const d = values[idx];
                    const ts = d.timestamp;
                    const dateStr = d3.timeFormat(pd.timeFormatString())(ts);
                    const fmt = (v: number) => `${d3.format(gd.tooltipValueFormat)(v)} ${gd.displayableUnit}`;

                    const rows = [
                        { caption: "Van net", value: d.gridSource },
                        { caption: "Van panelen", value: d.solarSelfUse },
                        { caption: "Naar net", value: -d.backDelivery }
                    ]
                        .filter(r => r.caption === "Van net" || Math.abs(r.value) > 0.01)
                        .map(r => `<tr><td style="padding:0 8px">${r.caption}</td><td style="text-align:right">${fmt(r.value)}</td></tr>`)
                        .join("");

                    return `<b>${dateStr}</b><table style="border-collapse:collapse"><tbody>${rows}</tbody></table>`;
                }
            },
            xAxis: {
                type: "category",
                data: xLabels,
                axisLabel: { color: textColor, interval: "auto" },
                axisLine: { lineStyle: { color: textColor } }
            },
            yAxis: {
                type: "value",
                axisLabel: { color: textColor }
            },
            series: [
                {
                    // Back-delivery: negative bars going below zero
                    type: "bar",
                    name: "Naar net",
                    data: values.map(v => v.backDelivery),
                    itemStyle: { color: stroomBackDeliveryColor },
                    barGap: "-100%",
                    barMaxWidth: 20
                },
                {
                    // Grid consumption: positive bars, part of stacked group
                    type: "bar",
                    name: "Van net",
                    data: values.map(v => v.gridSource),
                    itemStyle: { color: stroomUsageGraphColor },
                    stack: "positive",
                    barGap: "-100%",
                    barMaxWidth: 20
                },
                {
                    // Solar self-use: stacked on top of grid consumption
                    type: "bar",
                    name: "Van panelen",
                    data: values.map(v => v.solarSelfUse),
                    itemStyle: { color: stroomGenerationColor },
                    stack: "positive",
                    barGap: "-100%",
                    barMaxWidth: 20
                }
            ]
        };

        chart.off("click");
        chart.on("click", (params: any) => {
            if (params.dataIndex >= 0 && params.dataIndex < values.length) {
                onValueClick(pd.atDate(values[params.dataIndex].timestamp));
            }
        });

        chart.setOption(option, true);
    };

    const api: UsageAndGenerationBarChartApi = {
        data(periodDescription, graphDescription, data) {
            currentPeriodDescription = periodDescription;
            currentGraphDescription = graphDescription;
            consolidatedValues = consolidateData(data);
            return api;
        },

        onClick(handler) {
            onValueClick = handler;
            return api;
        },

        clearCanvas(value) {
            shouldClearCanvas = value;
            return api;
        },

        call
    };

    return api;
}
