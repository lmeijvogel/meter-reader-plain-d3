import * as d3 from "d3";

import { costsFor, PriceCategory } from "./helpers/PriceCalculator";

import { responseRowToMeasurementEntry } from "./helpers/responseRowToMeasurementEntry";
import { MeasurementEntry } from "./models/MeasurementEntry";
import { UsageField } from "./models/UsageData";

import { formatMonthNames, heatMap } from "./charts/heatMap";
import { gauge } from "./charts/gauge";

import { defineWebComponents } from "./customElements/VizCard";
import { DayDescription, LastHourDescription, PeriodDescription } from "./models/PeriodDescription";
import { padData } from "./helpers/padData";
import { barChart } from "./charts/barChart";
import {
    GasGraphDescription,
    GraphDescription,
    StroomGraphDescription,
    WaterGraphDescription
} from "./models/GraphDescription";
import { lineChart } from "./charts/lineChart";
import { initializeNavigation } from "./navigation";
import { getDate, subHours } from "date-fns";
import { usageAndGenerationBarChart } from "./charts/usageAndGenerationBarChart";

defineWebComponents();

const navigation = initializeNavigation(retrieveAndDrawPeriodCharts);

const periodGasContainer = d3.select("#gas_period_data");
const periodStroomContainer = d3.select("#stroom_period_data");
const periodWaterContainer = d3.select("#water_period_data");

function selectPeriod(periodDescription: PeriodDescription) {
    retrieveAndDrawPeriodCharts(periodDescription);
}

function retrieveAndDrawPeriodCharts(periodDescription: PeriodDescription) {
    navigation.setPeriodDescription(periodDescription);

    // PeriodUsage
    async function fetchPeriodData(
        fieldName: UsageField,
        periodDescription: PeriodDescription
    ): Promise<MeasurementEntry[]> {
        const url = `/api/${fieldName}${periodDescription.toUrl()}`;

        const response = await fetch(url);
        const json = await response.json();
        const data = json.map(responseRowToMeasurementEntry);
        const paddedData = padData(data, periodDescription.startOfPeriod(), periodDescription.periodSize);

        return paddedData;
    }

    fetchPeriodData("gas", periodDescription).then((values) => {
        const graphDescription = new GasGraphDescription(periodDescription);
        const api = barChart(periodDescription, graphDescription).onClick(retrieveAndDrawPeriodCharts).data(values);

        const cardTitle = createPeriodDataCardTitle(values, "gas", graphDescription, periodDescription);
        setCardTitle("js-period-gas-title", cardTitle);

        api.call(periodGasContainer);
    });

    fetchPeriodData("water", periodDescription).then((values) => {
        const graphDescription = new WaterGraphDescription(periodDescription);
        const api = barChart(periodDescription, graphDescription).onClick(retrieveAndDrawPeriodCharts).data(values);

        const cardTitle = createPeriodDataCardTitle(values, "water", graphDescription, periodDescription);
        setCardTitle("js-period-water-title", cardTitle);

        api.call(periodWaterContainer);
    });

    Promise.all<MeasurementEntry[]>([
        fetchPeriodData("stroom", periodDescription),
        fetchPeriodData("generation", periodDescription),
        fetchPeriodData("back_delivery", periodDescription)
    ]).then(([stroomValues, generationValues, backDeliveryValues]) => {
        const graphDescription = new StroomGraphDescription(periodDescription);

        const equalizedData = {
            consumption: stroomValues,
            generation: generationValues.map((el) => ({ value: el.value / 1000, timestamp: el.timestamp })),
            backDelivery: backDeliveryValues.map((el) => ({ value: -el.value, timestamp: el.timestamp }))
        };

        const api = usageAndGenerationBarChart(periodDescription, graphDescription)
            .onClick(retrieveAndDrawPeriodCharts)
            .data(equalizedData);

        const cardTitle = createPeriodDataCardTitle(stroomValues, "stroom", graphDescription, periodDescription);
        setCardTitle("js-period-stroom-title", cardTitle);

        api.call(periodStroomContainer);
    });

    async function fetchTemperatureData(
        periodDescription: PeriodDescription
    ): Promise<Map<string, MeasurementEntry[]>> {
        const url = periodDescription.toUrl();

        const response = await fetch(`/api/temperature/living_room${url}`);
        const json: { [key: string]: MeasurementEntry[] } = await response.json();

        const result = new Map();

        Array.from(Object.entries(json)).forEach((keyAndSeries) => {
            const [key, rawSeries] = keyAndSeries;
            const series = rawSeries.map(responseRowToMeasurementEntry);

            result.set(key, series);
        });

        return result;
    }

    fetchTemperatureData(periodDescription).then((result) => {
        const chartContainer = d3.select("#temperature_line_chart");
        const temperatureChart = lineChart(periodDescription).tooltipValueFormat(".1f").tooltipDisplayableUnit("°C");

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
}

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

    heatMap("year")
        .colors("#ffffff", "#e73710", "#791d09")
        .data(result)
        .unit("m³")
        .tickFormat(formatMonthNames)
        .onClick((date: Date) => selectPeriod(DayDescription.fromDate(date)))
        .draw(chartContainer);
});

loadData("stroom", "last_year").then((result) => {
    const chartContainer = d3.select("#stroom_heatmap_yearly");

    heatMap("year")
        .colors("#ffffff", "#f0ad4e", "#784805")
        .data(result)
        .unit("kWh")
        .tickFormat(formatMonthNames)
        .onClick((date: Date) => selectPeriod(DayDescription.fromDate(date)))
        .draw(chartContainer);
});

loadData("generation", "last_year").then((result) => {
    const chartContainer = d3.select("#opwekking_heatmap_yearly");

    heatMap("year")
        .colors("#ffffff", "#f0ad4e", "#784805")
        .data(result)
        .unit("kWh")
        .tickFormat(formatMonthNames)
        .onClick((date: Date) => selectPeriod(DayDescription.fromDate(date)))
        .draw(chartContainer);
});

loadData("water", "last_year").then((result) => {
    const chartContainer = d3.select("#water_heatmap_yearly");

    heatMap("year")
        .colors("#ffffff", "#428bca", "#224767")
        .data(result)
        .unit("L")
        .tickFormat(formatMonthNames)
        .onClick((date: Date) => selectPeriod(DayDescription.fromDate(date)))
        .draw(chartContainer);
});

loadData("gas", "last_30_days").then((result) => {
    const chartContainer = d3.select("#gas_heatmap_monthly");

    heatMap("30_days")
        .colors("#ffffff", "#e73710", "#791d09")
        .data(result)
        .unit("m³")
        .tickFormat((value: Date) => getDate(value).toString())
        .draw(chartContainer);
});

loadData("stroom", "last_30_days").then((result) => {
    const chartContainer = d3.select("#stroom_heatmap_monthly");

    heatMap("30_days")
        .colors("#ffffff", "#f0ad4e", "#784805")
        .min(0.1)
        .data(result)
        .unit("kWh")
        .tickFormat((value: Date) => getDate(value).toString())
        .draw(chartContainer);
});

loadData("generation", "last_30_days").then((result) => {
    const chartContainer = d3.select("#opwekking_heatmap_monthly");

    heatMap("30_days")
        .colors("#ffffff", "#f0ad4e", "#784805")
        .min(0.1)
        .data(result)
        .unit("kWh")
        .tickFormat((value: Date) => getDate(value).toString())
        .draw(chartContainer);
});

loadData("water", "last_30_days").then((result) => {
    const chartContainer = d3.select("#water_heatmap_monthly");

    heatMap("30_days")
        .colors("#ffffff", "#428bca", "#224767")
        .data(result)
        .unit("L")
        .tickFormat((value: Date) => getDate(value).toString())
        .draw(chartContainer);
});
function createPeriodDataCardTitle(
    values: MeasurementEntry[],
    priceCategory: PriceCategory,
    graphDescription: GraphDescription,
    periodDescription: PeriodDescription
): string {
    const usage = values.map((v) => v.value).reduce((acc: number, el: number) => acc + el, 0);
    const costs = costsFor(usage, priceCategory, periodDescription.startOfPeriod());

    const categoryName = priceCategory === "gas" ? "Gas" : priceCategory === "stroom" ? "Stroom" : "Water";

    return `${categoryName}: ${d3.format(graphDescription.tooltipValueFormat)(usage)} ${
        graphDescription.displayableUnit
    } (${costs})`;
}

function setCardTitle(selector: string, title: string) {
    const titleElement = document.getElementsByClassName(selector)[0];

    if (!titleElement) {
        throw new Error(`Could not find selector ${selector}`);
    }
    titleElement.textContent = title;
}

const gaugeContainer = d3.select("#current_power_gauge");
const recentCurrentContainer = d3.select("#recent_current");
const powerUsageGauge = gauge().domain([-3000, 3000]).goodValue(0).okValue(500).warnValue(2000).maxValue(3000);

const recentCurrentGraph = lineChart(new LastHourDescription())
    .domain([-3000, 3000])
    .tooltipDateFormat("HH:mm")
    .tooltipValueFormat("d")
    .tooltipDisplayableUnit("W");

type CurrentFields = { current: MeasurementEntry[]; generation: MeasurementEntry[] };

async function retrievePowerUsage(page = 0) {
    return fetch(`/api/stroom/recent?page=${page}`)
        .then((response) => response.json())
        .then((json) => {
            const fieldsKW: CurrentFields = {
                current: json["current"].map(responseRowToMeasurementEntry),
                generation: json["generation"].map(responseRowToMeasurementEntry)
            };

            return fieldsKW;
        });
}

const powerUsage: CurrentFields = {
    current: [],
    generation: []
};

async function updatePowerUsage(page = 0) {
    const newValues = await retrievePowerUsage(page);

    powerUsage.current = addAndReplaceValues(powerUsage.current, newValues.current);
    powerUsage.generation = addAndReplaceValues(powerUsage.generation, newValues.generation);

    drawPowerUsage(powerUsage);
}

function addAndReplaceValues(existing: MeasurementEntry[], newValues: MeasurementEntry[]): MeasurementEntry[] {
    const addedValues = newValues.filter((newValue) => !existing.some((m) => m.timestamp === newValue.timestamp));

    const tooOld = subHours(new Date(), 1);

    const result = [...existing, ...addedValues].filter((m) => m.timestamp >= tooOld);

    return result;
}

function drawPowerUsage(fieldsKW: CurrentFields) {
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
}

retrieveAndDrawPeriodCharts(DayDescription.today());
retrieveAndDrawPowerUsageInBatches();

async function retrieveAndDrawPowerUsageInBatches() {
    for (let i = 0; i < 6; i++) {
        const batch = await retrievePowerUsage(i);

        powerUsage.current = sortByTimestamp([...batch.current, ...powerUsage.current]);
        powerUsage.generation = sortByTimestamp([...batch.generation, ...powerUsage.generation]);

        drawPowerUsage(powerUsage);
    }

    // Done with the batches: Only set interval now, now that we're in a known state.
    setInterval(updatePowerUsage, 5000);
}

function sortByTimestamp(entries: MeasurementEntry[]): MeasurementEntry[] {
    return d3.sort(entries, (a, b) => (a.timestamp < b.timestamp ? -1 : 1));
}
