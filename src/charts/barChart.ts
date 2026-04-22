import * as d3 from "d3";
import * as echarts from "echarts";
import { GraphDescription } from "../models/GraphDescription";
import { PeriodDescription } from "../models/periodDescriptions/PeriodDescription";
import { ValueWithTimestamp } from "../models/ValueWithTimestamp";
import { grey } from "../colors";

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
    call: (selection: d3.Selection<d3.BaseType, unknown, HTMLElement, any>) => void;
};

function getChartTextColor(): string {
    return getComputedStyle(document.documentElement).getPropertyValue("--color-text").trim() || "#333";
}

export function barChart(): BarChartApi {
    let currentPeriodDescription: PeriodDescription | null = null;
    let currentGraphDescription: GraphDescription | null = null;
    let currentValues: ValueWithTimestamp[] = [];
    let lineData: { data: ValueWithTimestamp[]; graphDescription: GraphDescription }[] = [];
    let barColor = grey;
    let onValueClick: (pd: PeriodDescription) => void = () => {
        /* no-op */
    };
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
        const values = currentValues;
        const hasLine = lineData.length > 0;

        const formatX = d3.timeFormat(pd.tickFormatString());
        const xLabels = values.map((v) => formatX(pd.normalize(v.timestamp)));
        const yValues = values.map((v) => v.value);

        const textColor = getChartTextColor();

        const yAxes: any[] = [
            {
                type: "value",
                min: gd.minY,
                max: gd.maxY,
                axisLabel: { color: textColor, formatter: (value: number) => d3.format(gd.tooltipValueFormat)(value) },
            },
        ];

        if (hasLine) {
            yAxes.push({
                type: "value",
                min: -5,
                max: 40,
                position: "right",
                splitLine: { show: false },
                axisLabel: { color: textColor },
            });
        }

        const series: any[] = [
            {
                type: "bar",
                data: yValues,
                itemStyle: { color: barColor },
                yAxisIndex: 0,
            },
        ];

        if (hasLine) {
            const tempLineData = lineData[0].data;
            // Align temperature readings to each bar by closest timestamp
            const tempValues = values.map((barEntry) => {
                if (tempLineData.length === 0) return null;
                const closest = tempLineData.reduce((best, curr) =>
                    Math.abs(curr.timestamp.getTime() - barEntry.timestamp.getTime()) <
                    Math.abs(best.timestamp.getTime() - barEntry.timestamp.getTime())
                        ? curr
                        : best
                );
                return closest.value;
            });

            series.push({
                type: "line",
                data: tempValues,
                yAxisIndex: 1,
                smooth: true,
                lineStyle: { color: "#888" },
                itemStyle: { color: "#888" },
                showSymbol: false,
            });
        }

        const option: any = {
            textStyle: { color: textColor },
            backgroundColor: "transparent",
            grid: {
                top: 10,
                right: hasLine ? 60 : 30,
                bottom: 25,
                left: 55,
            },
            tooltip: {
                trigger: "axis",
                formatter(params: any) {
                    if (!params.length) return "";
                    const idx = params[0].dataIndex;
                    if (idx < 0 || idx >= values.length) return "";
                    const ts = values[idx].timestamp;
                    const dateStr = d3.timeFormat(pd.timeFormatString())(ts);
                    const value = values[idx].value;
                    const formatted = `${d3.format(gd.tooltipValueFormat)(value)} ${gd.displayableUnit}`;
                    return `${dateStr}: <b>${formatted}</b>`;
                },
            },
            xAxis: {
                type: "category",
                data: xLabels,
                axisLabel: { color: textColor, interval: "auto" },
                axisLine: { lineStyle: { color: textColor } },
            },
            yAxis: yAxes,
            series,
        };

        chart.off("click");
        chart.on("click", (params: any) => {
            if (params.dataIndex >= 0 && params.dataIndex < values.length) {
                onValueClick(pd.atDate(values[params.dataIndex].timestamp));
            }
        });

        chart.setOption(option, true);
    };

    const api: BarChartApi = {
        data(periodDescription, graphDescription, data) {
            currentPeriodDescription = periodDescription;
            currentGraphDescription = graphDescription;
            currentValues = data;
            return api;
        },

        addLineData(data, graphDescription) {
            lineData = [{ data, graphDescription }];
            return api;
        },

        removeLineData() {
            lineData = [];
            return api;
        },

        color(color) {
            barColor = color;
            return api;
        },

        onClick: (handler) => {
            onValueClick = handler;
            return api;
        },

        clearCanvas: (value) => {
            shouldClearCanvas = value;
            return api;
        },

        call,
    };

    return api;
}
