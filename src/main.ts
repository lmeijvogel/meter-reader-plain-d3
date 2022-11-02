import * as d3 from "d3";

import { responseRowToMeasurementEntry } from "./helpers/responseRowToMeasurementEntry";
import { MeasurementEntry } from "./models/MeasurementEntry";
import { UsageField } from "./models/UsageData";

import { formatMonthNames, heatMap } from "./charts/heatMap";

import { DayDescription, PeriodDescription } from "./models/PeriodDescription";
import { getDate } from "date-fns";
import { retrieveAndDrawPeriodCharts } from "./periodData";
import { initializeCurrentCharts } from "./currentCharts";
import { initIcons } from "./icons";
import { addCards, setCardTitle } from "./vizCard";

const cardsPerRow = [
    ["gas_period_data", "stroom_period_data"],
    ["water_period_data", "generation_period_data"],
    ["recent_current", "current_power_gauge", "temperature_line_chart"],
    ["gas_heatmap_monthly", "gas_heatmap_yearly"],
    ["stroom_heatmap_monthly", "stroom_heatmap_yearly"],
    ["opwekking_heatmap_monthly", "opwekking_heatmap_yearly"],
    ["water_heatmap_monthly", "water_heatmap_yearly"]
];

addCards(cardsPerRow, document.getElementById("rows")!);

initIcons();

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
    setCardTitle(chartContainer, "Gas laatste jaar");

    heatMap("year")
        .colors("#ffffff", "#e73710", "#791d09")
        .data(result)
        .unit("m³")
        .tickFormat(formatMonthNames)
        .onClick((date: Date) => selectPeriod(DayDescription.fromDate(date)))
        .draw(chartContainer.select(".chart"));
});

loadData("stroom", "last_year").then((result) => {
    const chartContainer = d3.select("#stroom_heatmap_yearly");
    setCardTitle(chartContainer, "Stroom laatste jaar");

    heatMap("year")
        .colors("#ffffff", "#f0ad4e", "#784805")
        .data(result)
        .unit("kWh")
        .tickFormat(formatMonthNames)
        .onClick((date: Date) => selectPeriod(DayDescription.fromDate(date)))
        .draw(chartContainer.select(".chart"));
});

loadData("generation", "last_year").then((result) => {
    const chartContainer = d3.select("#opwekking_heatmap_yearly");
    setCardTitle(chartContainer, "Opwek laatste jaar");

    heatMap("year")
        .colors("#ffffff", "#88ff28", "#22aa08")
        .data(result)
        .unit("Wh")
        .tickFormat(formatMonthNames)
        .onClick((date: Date) => selectPeriod(DayDescription.fromDate(date)))
        .draw(chartContainer.select(".chart"));
});

loadData("water", "last_year").then((result) => {
    const chartContainer = d3.select("#water_heatmap_yearly");
    setCardTitle(chartContainer, "Water laatste jaar");

    heatMap("year")
        .colors("#ffffff", "#428bca", "#224767")
        .data(result)
        .unit("L")
        .tickFormat(formatMonthNames)
        .onClick((date: Date) => selectPeriod(DayDescription.fromDate(date)))
        .draw(chartContainer.select(".chart"));
});

loadData("gas", "last_30_days").then((result) => {
    const chartContainer = d3.select("#gas_heatmap_monthly");
    setCardTitle(chartContainer, "Gas laatste 30 dagen");

    heatMap("30_days")
        .colors("#ffffff", "#e73710", "#791d09")
        .data(result)
        .unit("m³")
        .tickFormat((value: Date) => getDate(value).toString())
        .draw(chartContainer.select(".chart"));
});

loadData("stroom", "last_30_days").then((result) => {
    const chartContainer = d3.select("#stroom_heatmap_monthly");
    setCardTitle(chartContainer, "Stroom laatste 30 dagen");

    heatMap("30_days")
        .colors("#ffffff", "#f0ad4e", "#784805")
        .min(0.1)
        .data(result)
        .unit("kWh")
        .tickFormat((value: Date) => getDate(value).toString())
        .draw(chartContainer.select(".chart"));
});

loadData("generation", "last_30_days").then((result) => {
    const chartContainer = d3.select("#opwekking_heatmap_monthly");
    setCardTitle(chartContainer, "Opwek laatste 30 dagen");

    heatMap("30_days")
        .colors("#ffffff", "#88ff28", "#22aa08")
        .min(0.1)
        .data(result)
        .unit("Wh")
        .tickFormat((value: Date) => getDate(value).toString())
        .draw(chartContainer.select(".chart"));
});

loadData("water", "last_30_days").then((result) => {
    const chartContainer = d3.select("#water_heatmap_monthly");
    setCardTitle(chartContainer, "Water laatste 30 dagen");

    heatMap("30_days")
        .colors("#ffffff", "#428bca", "#224767")
        .data(result)
        .unit("L")
        .tickFormat((value: Date) => getDate(value).toString())
        .draw(chartContainer.select(".chart"));
});

retrieveAndDrawPeriodCharts(DayDescription.today());
initializeCurrentCharts();
