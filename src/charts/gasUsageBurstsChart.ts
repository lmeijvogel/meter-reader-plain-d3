import * as d3 from "d3";
import * as echarts from "echarts";
import { ValueWithTimestamp } from "../models/ValueWithTimestamp";
import { grey } from "../colors";
import { getChartTextColor, resizeObservers } from "./chartHelpers";

const Y_MAX = 0.2;
const TOOLTIP_FORMAT = ".3f";
const UNIT = "m³";
const SEPARATOR_COUNT = 2;

type DataItem = { timestamp: Date; value: number } | null;

export type GasUsageBurstsChartApi = {
    data(bursts: ValueWithTimestamp[][]): GasUsageBurstsChartApi;
    color(color: string): GasUsageBurstsChartApi;
    call: (selection: d3.Selection<d3.BaseType, unknown, HTMLElement, any>) => void;
};

export function gasUsageBurstsChart(): GasUsageBurstsChartApi {
    let currentBursts: ValueWithTimestamp[][] = [];
    let barColor = grey;

    const call = (selection: d3.Selection<d3.BaseType, unknown, HTMLElement, any>) => {
        const el = (selection as any).node() as HTMLElement;
        if (!el) return;

        let chart = echarts.getInstanceByDom(el);
        if (!chart) {
            chart = echarts.init(el);
            if (!resizeObservers.has(el)) {
                const ro = new ResizeObserver(() => echarts.getInstanceByDom(el)?.resize());
                ro.observe(el);
                resizeObservers.set(el, ro);
            }
        }

        const { xLabels, yValues, items, dayBoundaries } = buildChartData(currentBursts);
        const textColor = getChartTextColor();

        const option: any = {
            textStyle: { color: textColor },
            backgroundColor: "transparent",
            grid: { top: 25, right: 30, bottom: 40, left: 55 },
            tooltip: {
                trigger: "axis",
                formatter(params: any) {
                    if (!params.length) return "";
                    const item = items[params[0].dataIndex];
                    if (!item) return "";
                    const dateStr = d3.timeFormat("%a %d %b %H:%M")(item.timestamp);
                    const formatted = `${d3.format(TOOLTIP_FORMAT)(item.value)} ${UNIT}`;
                    return `${dateStr}: <b>${formatted}</b>`;
                },
            },
            xAxis: {
                type: "category",
                data: xLabels,
                axisLabel: {
                    color: textColor,
                    interval: 0,
                    rotate: 30,
                    formatter: (_: string, idx: number) => xLabels[idx],
                },
                axisLine: { lineStyle: { color: textColor } },
                axisTick: { alignWithLabel: true },
            },
            yAxis: {
                type: "value",
                min: 0,
                max: Y_MAX,
                axisLabel: {
                    color: textColor,
                    formatter: (value: number) => d3.format(TOOLTIP_FORMAT)(value),
                },
            },
            series: [
                {
                    type: "bar",
                    data: yValues,
                    itemStyle: { color: barColor },
                    markLine: {
                        silent: true,
                        symbol: "none",
                        lineStyle: { color: textColor, opacity: 0.3, type: "solid", width: 1 },
                        data: dayBoundaries.map((b) => ({
                            xAxis: b.xAxis,
                            label: {
                                show: true,
                                formatter: b.dateLabel,
                                position: "end",
                                color: textColor,
                            },
                        })),
                    },
                },
            ],
        };

        chart.setOption(option, true);
    };

    const api: GasUsageBurstsChartApi = {
        data(bursts) {
            currentBursts = bursts;
            return api;
        },
        color(color) {
            barColor = color;
            return api;
        },
        call,
    };

    return api;
}

function isSameDay(a: Date, b: Date): boolean {
    return (
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate()
    );
}

const MIN_LABEL_GAP = 6; // bars (6 × 10 min = 60 min)

function buildChartData(bursts: ValueWithTimestamp[][]): {
    xLabels: string[];
    yValues: (number | null)[];
    items: DataItem[];
    dayBoundaries: Array<{ xAxis: number; dateLabel: string }>;
} {
    const xLabels: string[] = [];
    const yValues: (number | null)[] = [];
    const items: DataItem[] = [];
    const dayBoundaries: Array<{ xAxis: number; dateLabel: string }> = [];

    const formatDate = d3.timeFormat("%-d %b");
    const formatTime = d3.timeFormat("%H:%M");

    const now = new Date();
    let lastLabelledIndex = -MIN_LABEL_GAP;

    bursts.forEach((burst, burstIndex) => {
        if (burstIndex > 0) {
            const prevLast = bursts[burstIndex - 1].at(-1)!.timestamp;
            const currFirst = burst[0].timestamp;
            if (!isSameDay(prevLast, currFirst)) {
                const xAxis = xLabels.length + (SEPARATOR_COUNT - 1) / 2;
                dayBoundaries.push({ xAxis, dateLabel: formatDate(currFirst) });
            }
            for (let i = 0; i < SEPARATOR_COUNT; i++) {
                xLabels.push("");
                yValues.push(null);
                items.push(null);
            }
        }

        burst.forEach((point, pointIndex) => {
            const minutes = point.timestamp.getMinutes();
            const currentIndex = xLabels.length;

            let label: string;
            if (pointIndex === 0) {
                label = formatTime(point.timestamp);
                lastLabelledIndex = currentIndex;
            } else if ((minutes === 0 || minutes === 30) && currentIndex - lastLabelledIndex >= MIN_LABEL_GAP) {
                label = formatTime(point.timestamp);
                lastLabelledIndex = currentIndex;
            } else {
                label = "";
            }

            xLabels.push(label);
            yValues.push(point.value);
            items.push(point);
        });

        // Trailing gap if last measurement is stale (> 10 min old)
        if (burstIndex === bursts.length - 1 && burst.length > 0) {
            const lastTs = burst.at(-1)!.timestamp;
            const ageMinutes = (now.getTime() - lastTs.getTime()) / 60000;
            if (ageMinutes > 10) {
                xLabels.push("");
                yValues.push(null);
                items.push(null);
            }
        }
    });

    return { xLabels, yValues, items, dayBoundaries };
}
