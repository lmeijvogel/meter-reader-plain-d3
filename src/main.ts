import { responseRowToMeasurementEntry } from "./helpers/responseRowToMeasurementEntry";
import { MeasurementEntry } from "./models/MeasurementEntry";
import { UsageField } from "./models/UsageData";

import { heatMap } from "./charts/heatMap";
import { gauge } from "./charts/gauge";
import * as d3 from "d3";

import { defineWebComponents } from "./customElements/VizCard";
import { DayDescription, HourDescription, LastHourDescription, PeriodDescription } from "./models/PeriodDescription";
import { padData } from "./helpers/padData";
import { barChart } from "./charts/barChart";
import { GasGraphDescription, StroomGraphDescription, WaterGraphDescription } from "./models/GraphDescription";
import { lineChart } from "./charts/lineChart";

defineWebComponents();

// PeriodUsage
async function fetchPeriodData(
    fieldName: UsageField,
    periodDescription: PeriodDescription
): Promise<MeasurementEntry[]> {
    const url = periodDescription.toUrl();

    const response = await fetch(`/api/${fieldName}${url}`);
    const json = await response.json();
    const data = json.map(responseRowToMeasurementEntry);
    const paddedData = padData(data, periodDescription.startOfPeriod(), periodDescription.periodSize);

    return paddedData;
}

const periodGasContainer = d3.select("#gas_period_data");
const periodStroomContainer = d3.select("#stroom_period_data");
const periodWaterContainer = d3.select("#water_period_data");
const initialPeriodDescription = DayDescription.today();

fetchPeriodData("gas", initialPeriodDescription).then((values) => {
    const graphDescription = new GasGraphDescription(initialPeriodDescription);
    const api = barChart(initialPeriodDescription, graphDescription).data(values);

    api.call(periodGasContainer);
});

fetchPeriodData("stroom", initialPeriodDescription).then((values) => {
    const graphDescription = new StroomGraphDescription(initialPeriodDescription);
    const api = barChart(initialPeriodDescription, graphDescription).data(values);

    api.call(periodStroomContainer);
});

fetchPeriodData("water", initialPeriodDescription).then((values) => {
    const graphDescription = new WaterGraphDescription(initialPeriodDescription);
    const api = barChart(initialPeriodDescription, graphDescription).data(values);

    api.call(periodWaterContainer);
});

async function fetchTemperatureData(periodDescription: PeriodDescription): Promise<Map<string, MeasurementEntry[]>> {
    const url = periodDescription.toUrl();

    const response = await fetch(`/api/temperature/living_room${url}`);
    const json: { [key: string]: MeasurementEntry[] } = await response.json();

    const result = new Map();

    Array.from(Object.entries(json)).forEach((keyAndSeries) => {
        const [key, rawSeries] = keyAndSeries;
        const series = rawSeries.map(responseRowToMeasurementEntry);

        console.log(series, key);
        result.set(key, series);
    });

    return result;
}

fetchTemperatureData(initialPeriodDescription).then((result) => {
    const chartContainer = d3.select("#temperature_line_chart");
    const temperatureChart = lineChart(initialPeriodDescription).tooltipValueFormat(".1f").tooltipDisplayableUnit("°C");

    [
        ["huiskamer", "#ff0000"],
        ["zolder", "#0000ff"],
        ["tuinkamer", "#00ff00"]
    ].forEach((set) => {
        const [key, color] = set;
        const series = result.get(key);

        if (!!series) {
            temperatureChart.setSeries(key, series, color);
        }
    });
    chartContainer.call(temperatureChart.call);
});

async function fetchLastMonthHeatMapData(query: string): Promise<MeasurementEntry[]> {
    return fetch(query)
        .then((response) => response.json())
        .then((json) => json.map(responseRowToMeasurementEntry));
}

function loadData(fieldName: UsageField, period: "last_30_days" | "last_year") {
    const query = period === "last_30_days" ? `/api/${fieldName}/last_30_days` : `/api/${fieldName}/last_year`;

    return fetchLastMonthHeatMapData(query);
}

loadData("gas", "last_year").then((result) => {
    const chartContainer = d3.select("#gas_heatmap_yearly");

    heatMap("year").colors("#ffffff", "#e73710", "#791d09").data(result).unit("m³").draw(chartContainer);
});

loadData("stroom", "last_year").then((result) => {
    const chartContainer = d3.select("#stroom_heatmap_yearly");

    heatMap("year").colors("#ffffff", "#f0ad4e", "#784805").data(result).unit("kWh").draw(chartContainer);
});

loadData("water", "last_year").then((result) => {
    const chartContainer = d3.select("#water_heatmap_yearly");

    heatMap("year").colors("#ffffff", "#428bca", "#224767").data(result).unit("L").draw(chartContainer);
});

loadData("gas", "last_30_days").then((result) => {
    const chartContainer = d3.select("#gas_heatmap_monthly");

    heatMap("30_days").colors("#ffffff", "#e73710", "#791d09").data(result).unit("m³").draw(chartContainer);
});

loadData("stroom", "last_30_days").then((result) => {
    const chartContainer = d3.select("#stroom_heatmap_monthly");

    heatMap("30_days").colors("#ffffff", "#f0ad4e", "#784805").min(0.1).data(result).unit("kWh").draw(chartContainer);
});

loadData("water", "last_30_days").then((result) => {
    const chartContainer = d3.select("#water_heatmap_monthly");

    heatMap("30_days").colors("#ffffff", "#428bca", "#224767").data(result).unit("L").draw(chartContainer);
});

const gaugeContainer = d3.select("#current_power_gauge");
const recentCurrentContainer = d3.select("#recent_current");
const powerUsageGauge = gauge().domain([-3000, 3000]).goodValue(0).okValue(500).warnValue(2000).maxValue(3000);

const recentCurrentGraph = lineChart(new LastHourDescription())
    .domain([-3000, 3000])
    .tooltipDateFormat("HH:mm")
    .tooltipValueFormat("d")
    .tooltipDisplayableUnit("W");

const updatePowerUsage = () => {
    fetch("/api/stroom/recent")
        .then((response) => response.json())
        .then((json) => {
            console.log({ json });
            return json;
        })
        .then((json) => ({
            current: json["current"].map(responseRowToMeasurementEntry),
            generation: json["generation"].map(responseRowToMeasurementEntry)
        }))
        .then((fieldsKW: { current: MeasurementEntry[]; generation: MeasurementEntry[] }) => {
            const currentInW = fieldsKW.current.map((entry) => ({ ...entry, value: entry.value * 1000 }));
            const generationInW = fieldsKW.generation.map((entry) => ({ ...entry, value: entry.value * -1000 }));

            const lastCurrent = currentInW[currentInW.length - 1]?.value ?? 0;
            const lastGeneration = generationInW[generationInW.length - 1]?.value ?? 0;

            const newValue = lastCurrent + lastGeneration;

            powerUsageGauge.value(newValue);

            gaugeContainer.call(powerUsageGauge.call);

            recentCurrentGraph.setSeries("current", currentInW, "#f0ad4e");
            recentCurrentGraph.setSeries("generation", generationInW, "#adf04e");

            recentCurrentContainer.call(recentCurrentGraph.call);
        });
};

setInterval(updatePowerUsage, 5000);
updatePowerUsage();
