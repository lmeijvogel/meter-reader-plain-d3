import * as d3 from "d3";
import { LineChartApi } from "../charts/lineChart";
import { temperatuurHuiskamerColor, temperatuurTuinkamerColor, temperatuurZolderColor } from "../colors";
import { TemperatuurGraphDescription } from "../models/GraphDescription";
import { PeriodDescription } from "../models/periodDescriptions/PeriodDescription";
import { ValueWithTimestamp } from "../models/ValueWithTimestamp";
import { setCardTitle } from "../vizCard";

function aggregateDailyMax(values: ValueWithTimestamp[]): ValueWithTimestamp[] {
    const byDay = new Map<string, ValueWithTimestamp>();

    for (const v of values) {
        const key = `${v.timestamp.getFullYear()}-${v.timestamp.getMonth()}-${v.timestamp.getDate()}`;
        const existing = byDay.get(key);
        if (!existing || v.value > existing.value) {
            byDay.set(key, { timestamp: new Date(v.timestamp.getFullYear(), v.timestamp.getMonth(), v.timestamp.getDate(), 12), value: v.value });
        }
    }

    return Array.from(byDay.values()).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}

export function fetchAndDrawTemperatureChart(periodDescription: PeriodDescription, temperatureRequest: Promise<Map<string, ValueWithTimestamp[]>>, api: LineChartApi, temperatureCard: d3.Selection<d3.BaseType, unknown, HTMLElement, any>) {
    if (!temperatureCard.select(".thermometer").node()) {
        const thermometerCard = temperatureCard.select(".chart").append("g");
        thermometerCard.attr("class", "thermometer");
    }

    const chartContainer = temperatureCard.select(".chart");
    setCardTitle(temperatureCard, "Binnentemperatuur");

    temperatureRequest.then((result) => {
        const graphDescription = new TemperatuurGraphDescription(periodDescription);

        const series = [
            ["huiskamer", temperatuurHuiskamerColor],
            ["tuinkamer", temperatuurTuinkamerColor],
            ["zolder", temperatuurZolderColor]
        ].map(([name, color]) => {
            let values = result.get(name) ?? [];

            if (periodDescription.period === "month") {
                values = aggregateDailyMax(values);
            }

            return {
                name,
                values,
                lineColor: color
            };
        });

        api.setData(periodDescription, graphDescription, series);
        chartContainer.call(api.call);
    });
}
