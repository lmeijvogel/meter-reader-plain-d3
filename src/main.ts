import * as d3 from "d3";

import { responseRowToMeasurementEntry } from "./helpers/responseRowToMeasurementEntry";
import { MeasurementEntry } from "./models/MeasurementEntry";
import { UsageField } from "./models/UsageData";

import { formatMonthNames, heatMap } from "./charts/heatMap";

import { defineWebComponents } from "./customElements/VizCard";
import { DayDescription, LastHourDescription, PeriodDescription } from "./models/PeriodDescription";
import { getDate } from "date-fns";
import { retrieveAndDrawPeriodCharts } from "./periodData";
import { initializeCurrentCharts } from "./currentCharts";
import { initIcons } from "./icons";

initIcons();
defineWebComponents();

function selectPeriod(periodDescription: PeriodDescription) {
    retrieveAndDrawPeriodCharts(periodDescription);
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
        .colors("#ffffff", "#88ff28", "#22aa08")
        .data(result)
        .unit("Wh")
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
        .colors("#ffffff", "#88ff28", "#22aa08")
        .min(0.1)
        .data(result)
        .unit("Wh")
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

retrieveAndDrawPeriodCharts(DayDescription.today());
initializeCurrentCharts();
