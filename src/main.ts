import * as d3 from "d3";

import { responseRowToValueWithTimestamp } from "./helpers/responseRowToValueWithTimestamp";
import { UsageField } from "./models/UsageData";

import { formatMonthNames, heatMap } from "./charts/heatMap";

import { DayDescription, PeriodDescription } from "./models/PeriodDescription";
import { getDate } from "date-fns";
import { retrieveAndDrawPeriodCharts } from "./periodData";
import { initializeCurrentCharts } from "./currentCharts";
import { initIcons } from "./icons";
import { addCards, setCardTitle } from "./vizCard";
import { ValueWithTimestamp } from "./models/ValueWithTimestamp";
import {
    darkGasGraphColor,
    darkGenerationGraphColor,
    darkStroomUsageColor,
    darkWaterGraphColor,
    gasGraphColor,
    generationGraphColor,
    stroomUsageColor,
    waterGraphColor,
    white
} from "./colors";

const enabledGraphs: string[] = ["gas", "stroom", "water", "generation"];

const cardsPerRow = [
    ["recent_current", "current_power_gauge"],
    ["gas_period_data", "stroom_period_data"],
    ["water_period_data", "generation_period_data"],
    ["temperature_line_chart"],
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

async function fetchLastMonthHeatMapData(query: string): Promise<ValueWithTimestamp[]> {
    return fetch(query)
        .then((response) => response.json())
        .then((json) => json.map(responseRowToValueWithTimestamp));
}

function loadData(fieldName: UsageField, period: "last_30_days" | "last_year") {
    const query = period === "last_30_days" ? `/api/${fieldName}/last_30_days` : `/api/${fieldName}/last_year`;

    return fetchLastMonthHeatMapData(query);
}

if (enabledGraphs.includes("gas")) {
    loadData("gas", "last_year").then((result) => {
        const chartContainer = d3.select("#gas_heatmap_yearly");
        setCardTitle(chartContainer, "Gas laatste jaar");

        heatMap("year")
            .colors(white, gasGraphColor, darkGasGraphColor)
            .data(result)
            .unit("m³")
            .tickFormat(formatMonthNames)
            .onClick((date: Date) => selectPeriod(DayDescription.fromDate(date)))
            .draw(chartContainer.select(".chart"));
    });

    loadData("gas", "last_30_days").then((result) => {
        const chartContainer = d3.select("#gas_heatmap_monthly");
        setCardTitle(chartContainer, "Gas laatste 30 dagen");

        heatMap("30_days")
            .colors(white, gasGraphColor, darkGasGraphColor)
            .data(result)
            .unit("m³")
            .tickFormat((value: Date) => getDate(value).toString())
            .draw(chartContainer.select(".chart"));
    });
}

if (enabledGraphs.includes("stroom")) {
    loadData("stroom", "last_year").then((result) => {
        const chartContainer = d3.select("#stroom_heatmap_yearly");
        setCardTitle(chartContainer, "Stroom laatste jaar");

        heatMap("year")
            .colors(white, stroomUsageColor, darkStroomUsageColor)
            .data(result)
            .unit("kWh")
            .tickFormat(formatMonthNames)
            .onClick((date: Date) => selectPeriod(DayDescription.fromDate(date)))
            .draw(chartContainer.select(".chart"));
    });

    loadData("stroom", "last_30_days").then((result) => {
        const chartContainer = d3.select("#stroom_heatmap_monthly");
        setCardTitle(chartContainer, "Stroom laatste 30 dagen");

        heatMap("30_days")
            .colors(white, stroomUsageColor, darkStroomUsageColor)
            .min(0.1)
            .data(result)
            .unit("kWh")
            .tickFormat((value: Date) => getDate(value).toString())
            .draw(chartContainer.select(".chart"));
    });
}

if (enabledGraphs.includes("generation")) {
    loadData("generation", "last_year").then((result) => {
        const chartContainer = d3.select("#opwekking_heatmap_yearly");
        setCardTitle(chartContainer, "Opwek laatste jaar");

        heatMap("year")
            .colors(white, generationGraphColor, darkGenerationGraphColor)
            .data(result)
            .unit("Wh")
            .tickFormat(formatMonthNames)
            .onClick((date: Date) => selectPeriod(DayDescription.fromDate(date)))
            .draw(chartContainer.select(".chart"));
    });

    loadData("generation", "last_30_days").then((result) => {
        const chartContainer = d3.select("#opwekking_heatmap_monthly");
        setCardTitle(chartContainer, "Opwek laatste 30 dagen");

        heatMap("30_days")
            .colors(white, generationGraphColor, darkGenerationGraphColor)
            .min(0.1)
            .data(result)
            .unit("Wh")
            .tickFormat((value: Date) => getDate(value).toString())
            .draw(chartContainer.select(".chart"));
    });
}

if (enabledGraphs.includes("water")) {
    loadData("water", "last_year").then((result) => {
        const chartContainer = d3.select("#water_heatmap_yearly");
        setCardTitle(chartContainer, "Water laatste jaar");

        heatMap("year")
            .colors(white, waterGraphColor, darkWaterGraphColor)
            .data(result)
            .unit("L")
            .tickFormat(formatMonthNames)
            .onClick((date: Date) => selectPeriod(DayDescription.fromDate(date)))
            .draw(chartContainer.select(".chart"));
    });

    loadData("water", "last_30_days").then((result) => {
        const chartContainer = d3.select("#water_heatmap_monthly");
        setCardTitle(chartContainer, "Water laatste 30 dagen");

        heatMap("30_days")
            .colors(white, waterGraphColor, darkWaterGraphColor)
            .data(result)
            .unit("L")
            .tickFormat((value: Date) => getDate(value).toString())
            .draw(chartContainer.select(".chart"));
    });
}

const startPeriod = DayDescription.today();

retrieveAndDrawPeriodCharts(startPeriod);
initializeCurrentCharts();
