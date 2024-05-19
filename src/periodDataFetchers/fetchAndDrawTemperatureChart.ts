import * as d3 from "d3";
import { LineChartApi } from "../charts/lineChart";
import { temperatuurHuiskamerColor, temperatuurTuinkamerColor, temperatuurZolderColor } from "../colors";
import { TemperatuurGraphDescription } from "../models/GraphDescription";
import { PeriodDescription } from "../models/periodDescriptions/PeriodDescription";
import { ValueWithTimestamp } from "../models/ValueWithTimestamp";
import { setCardTitle } from "../vizCard";

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
            ["zolder", temperatuurZolderColor],
            ["tuinkamer", temperatuurTuinkamerColor]
        ].map(([name, color]) => {
            const series = result.get(name) ?? [];

            return {
                name,
                values: series,
                lineColor: color
            };
        });

        api.setData(periodDescription, graphDescription, series);
        chartContainer.call(api.call);
    });
}
