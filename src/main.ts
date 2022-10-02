import { responseRowToMeasurementEntry } from "./helpers/responseRowToMeasurementEntry";
import { MeasurementEntry } from "./models/MeasurementEntry";
import { UsageField } from "./models/UsageData";

import { carpetChart } from "./charts/carpetChart";
import * as d3 from "d3";

import { defineWebComponents } from "./customElements/VizCard";

defineWebComponents();

async function fetchLastMonthCarpetData(query: string): Promise<MeasurementEntry[]> {
    return fetch(query)
        .then((response) => response.json())
        .then((json) => json.map(responseRowToMeasurementEntry));
}

function loadData(fieldName: UsageField, period: "last_30_days" | "last_year") {
    const query = period === "last_30_days" ? `/api/${fieldName}/last_30_days` : `/api/${fieldName}/last_year`;

    return fetchLastMonthCarpetData(query);
}

loadData("gas", "last_year").then((result) => {
    const chartContainer = d3.select("#gas_carpet_chart_yearly");

    carpetChart("year").colors("#ffffff", "#e73710", "#791d09").data(result).unit("m³").draw(chartContainer);
});

loadData("stroom", "last_year").then((result) => {
    const chartContainer = d3.select("#stroom_carpet_chart_yearly");

    carpetChart("year").colors("#ffffff", "#f0ad4e", "#784805").data(result).unit("kWh").draw(chartContainer);
});

loadData("water", "last_year").then((result) => {
    const chartContainer = d3.select("#water_carpet_chart_yearly");

    carpetChart("year").colors("#ffffff", "#428bca", "#224767").data(result).unit("L").draw(chartContainer);
});

loadData("gas", "last_30_days").then((result) => {
    const chartContainer = d3.select("#gas_carpet_chart_monthly");

    carpetChart("30_days").colors("#ffffff", "#e73710", "#791d09").data(result).unit("m³").draw(chartContainer);
});

loadData("stroom", "last_30_days").then((result) => {
    const chartContainer = d3.select("#stroom_carpet_chart_monthly");

    carpetChart("30_days").colors("#ffffff", "#ffddad", "#784805").data(result).unit("kWh").draw(chartContainer);
});

loadData("water", "last_30_days").then((result) => {
    const chartContainer = d3.select("#water_carpet_chart_monthly");

    carpetChart("30_days").colors("#ffffff", "#428bca", "#224767").data(result).unit("L").draw(chartContainer);
});
