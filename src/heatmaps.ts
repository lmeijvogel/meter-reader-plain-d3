import * as d3 from "d3";
import { getDate } from "date-fns";
import { formatMonthNames, heatMap } from "./charts/heatMap";
import {
    darkGenerationGraphColor,
    darkStroomUsageGraphColor,
    darkWaterGraphColor,
    generationGraphColor,
    stroomUsageGraphColor,
    waterGraphColor,
    white
} from "./colors";
import { responseRowToValueWithTimestamp } from "./lib/responseRowToValueWithTimestamp";
import { createRowsWithCards } from "./lib/createRowsWithCards";
import { UsageField } from "./models/UsageData";
import { ValueWithTimestamp } from "./models/ValueWithTimestamp";
import { setCardTitle } from "./vizCard";
import { DayDescription } from "./models/periodDescriptions/DayDescription";
import { PeriodDescription } from "./models/periodDescriptions/PeriodDescription";

const enabledGraphs: string[] = ["gas", "stroom", "water", "generation"];

const cardsPerRow = [
    ["gas_heatmap_monthly", "gas_heatmap_yearly"],
    ["stroom_heatmap_monthly", "stroom_heatmap_yearly"],
    ["opwekking_heatmap_monthly", "opwekking_heatmap_yearly"],
    ["water_heatmap_monthly", "water_heatmap_yearly"]
];

export class Heatmaps {
    private _dataAlreadyLoaded = false;

    constructor(
        private periodSelected: (periodDescription: PeriodDescription) => void,
        private readonly updateLocation: (newPath: string) => void
    ) { }

    initializePage(selector: string) {
        createRowsWithCards(cardsPerRow, selector);
    }

    tabSelected() {
        this.updateLocation("/heatmaps");

        this.loadData();
    }

    private loadData() {
        if (this._dataAlreadyLoaded) {
            return;
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
                    .colors([
                        { color: "white", value: 0 },
                        { color: "#fbb021", value: 16 },
                        { color: "#f68838", value: 30 },
                        { color: "#ee3e32", value: 70 },
                        { color: "#8a0000", value: 100 }
                    ])
                    .data(result)
                    .unit("m³")
                    .tickFormat(formatMonthNames)
                    .onClick((date: Date) => this.periodSelected(DayDescription.fromDate(date)))
                    .draw(chartContainer.select(".chart"));
            });

            loadData("gas", "last_30_days").then((result) => {
                const chartContainer = d3.select("#gas_heatmap_monthly");
                setCardTitle(chartContainer, "Gas laatste 30 dagen");
                heatMap("30_days")
                    .colors([
                        { color: "white", value: 0 },
                        { color: "#fbb021", value: 16 },
                        { color: "#f68838", value: 30 },
                        { color: "#ee3e32", value: 70 },
                        { color: "#8a0000", value: 100 }
                    ])
                    .data(result)
                    .unit("m³")
                    .tickFormat((value: Date) => getDate(value).toString())
                    .onClick((date: Date) => this.periodSelected(DayDescription.fromDate(date)))
                    .draw(chartContainer.select(".chart"));
            });
        }

        if (enabledGraphs.includes("stroom")) {
            loadData("stroom", "last_year").then((result) => {
                const chartContainer = d3.select("#stroom_heatmap_yearly");
                setCardTitle(chartContainer, "Stroom laatste jaar");

                heatMap("year")
                    .colors([
                        { color: white, value: 0 },
                        { color: stroomUsageGraphColor, value: 50 },
                        { color: darkStroomUsageGraphColor, value: 100 }
                    ])
                    .data(result)
                    .unit("kWh")
                    .tickFormat(formatMonthNames)
                    .onClick((date: Date) => this.periodSelected(DayDescription.fromDate(date)))
                    .draw(chartContainer.select(".chart"));
            });

            loadData("stroom", "last_30_days").then((result) => {
                const chartContainer = d3.select("#stroom_heatmap_monthly");
                setCardTitle(chartContainer, "Stroom laatste 30 dagen");

                heatMap("30_days")
                    .colors([
                        { color: "white", value: 0 },
                        { color: stroomUsageGraphColor, value: 50 },
                        { color: darkStroomUsageGraphColor, value: 100 }
                    ])
                    .min(0.1)
                    .data(result)
                    .unit("kWh")
                    .tickFormat((value: Date) => getDate(value).toString())
                    .onClick((date: Date) => this.periodSelected(DayDescription.fromDate(date)))
                    .draw(chartContainer.select(".chart"));
            });
        }

        if (enabledGraphs.includes("generation")) {
            loadData("generation", "last_year").then((result) => {
                const chartContainer = d3.select("#opwekking_heatmap_yearly");
                setCardTitle(chartContainer, "Opwek laatste jaar");

                heatMap("year")
                    .colors([
                        { color: "white", value: 0 },
                        { color: generationGraphColor, value: 30 },
                        { color: darkGenerationGraphColor, value: 100 }

                    ])
                    .backgroundColor("white")
                    .data(result)
                    .unit("Wh")
                    .tickFormat(formatMonthNames)
                    .onClick((date: Date) => this.periodSelected(DayDescription.fromDate(date)))
                    .draw(chartContainer.select(".chart"));
            });

            loadData("generation", "last_30_days").then((result) => {
                const chartContainer = d3.select("#opwekking_heatmap_monthly");
                setCardTitle(chartContainer, "Opwek laatste 30 dagen");

                heatMap("30_days")
                    .colors([
                        { color: "black", value: 0 },
                        { color: generationGraphColor, value: 10 },
                        { color: "#bef621", value: 40 },
                        { color: "#fbc421", value: 100 }

                    ])
                    .backgroundColor("black")
                    .data(result)
                    .unit("Wh")
                    .tickFormat(formatMonthNames)
                    .onClick((date: Date) => this.periodSelected(DayDescription.fromDate(date)))
                    .draw(chartContainer.select(".chart"));
            });
        }

        if (enabledGraphs.includes("water")) {
            loadData("water", "last_year").then((result) => {
                const chartContainer = d3.select("#water_heatmap_yearly");
                setCardTitle(chartContainer, "Water laatste jaar");

                heatMap("year")
                    .colors([
                        { color: "white", value: 0 },
                        { color: "#1d92d0", value: 60 },
                        { color: "#1d48d0", value: 100 }
                    ])

                    .data(result)
                    .unit("L")
                    .tickFormat(formatMonthNames)
                    .onClick((date: Date) => this.periodSelected(DayDescription.fromDate(date)))
                    .draw(chartContainer.select(".chart"));
            });

            loadData("water", "last_30_days").then((result) => {
                const chartContainer = d3.select("#water_heatmap_monthly");
                setCardTitle(chartContainer, "Water laatste 30 dagen");

                heatMap("30_days")
                    .colors([
                        { color: "white", value: 0 },
                        { color: waterGraphColor, value: 50 },
                        { color: darkWaterGraphColor, value: 100 }
                    ])
                    .data(result)
                    .unit("L")
                    .tickFormat((value: Date) => getDate(value).toString())
                    .onClick((date: Date) => this.periodSelected(DayDescription.fromDate(date)))
                    .draw(chartContainer.select(".chart"));
            });
        }
        this._dataAlreadyLoaded = true;
    }
}
