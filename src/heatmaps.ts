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
import { onCardTitleClick, setCardTitle } from "./vizCard";
import { DayDescription } from "./models/periodDescriptions/DayDescription";
import { PeriodDescription } from "./models/periodDescriptions/PeriodDescription";

type GraphType = "gas" | "stroom" | "water" | "generation";

const enabledGraphs: GraphType[] = ["gas", "stroom", "water", "generation"];

const cardsPerRow = [
    ["gas_heatmap_monthly", "gas_heatmap_yearly"],
    ["stroom_heatmap_monthly", "stroom_heatmap_yearly"],
    ["opwekking_heatmap_monthly", "opwekking_heatmap_yearly"],
    ["water_heatmap_monthly", "water_heatmap_yearly"]
];

const graphTypes: { [key in GraphType]: "hourly_30_days" | "hourly_year" } = {
    gas: "hourly_30_days",
    stroom: "hourly_30_days",
    generation: "hourly_30_days",
    water: "hourly_30_days"
};

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

        if (enabledGraphs.includes("gas")) {
            this.loadHeatmapData("gas", "last_year").then((result) => {
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

            this.renderHourlyGasUsageChart();
        }

        if (enabledGraphs.includes("stroom")) {
            this.loadHeatmapData("stroom", "last_year").then((result) => {
                const chartContainer = d3.select("#stroom_heatmap_yearly");
                setCardTitle(chartContainer, "Stroomvraag laatste jaar");

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
            
            this.renderHourlyStroomUsageChart();
        }

        if (enabledGraphs.includes("generation")) {
            this.loadHeatmapData("generation", "last_year").then((result) => {
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

            this.renderHourlyGenerationChart();
        }

        if (enabledGraphs.includes("water")) {
            this.loadHeatmapData("water", "last_year").then((result) => {
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

            this.renderHourlyWaterUsageChart();
        }
        this._dataAlreadyLoaded = true;
    }

    private renderHourlyGasUsageChart() {
            this.loadHeatmapData("gas", graphTypes.gas).then((result) => {
                const chartContainer = d3.select("#gas_heatmap_monthly");
                setCardTitle(chartContainer, "Gas laatste 30 dagen");
                onCardTitleClick(chartContainer, () => {
                    toggleGraphType("gas");
                    this.renderHourlyGasUsageChart();
                });

                heatMap(graphTypes.gas)
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

    private renderHourlyStroomUsageChart() {
            this.loadHeatmapData("stroom", graphTypes.stroom).then((result) => {
                const chartContainer = d3.select("#stroom_heatmap_monthly");
                setCardTitle(chartContainer, "Stroomvraag laatste 30 dagen");
                onCardTitleClick(chartContainer, () => {
                    toggleGraphType("stroom");
                    this.renderHourlyStroomUsageChart();
                });

                const colors = graphTypes.stroom === "hourly_30_days" ? [
                        { color: "white", value: 0 },
                        { color: stroomUsageGraphColor, value: 50 },
                        { color: darkStroomUsageGraphColor, value: 100 }
                    ] : [
                        { color: "white", value: 0 },
                        { color: stroomUsageGraphColor, value: 10 },
                        { color: darkStroomUsageGraphColor, value: 100 }

                    ];
                heatMap(graphTypes.stroom)
                    .colors(colors)
                    .min(0.1)
                    .data(result)
                    .unit("kWh")
                    .tickFormat((value: Date) => getDate(value).toString())
                    .onClick((date: Date) => this.periodSelected(DayDescription.fromDate(date)))
                    .draw(chartContainer.select(".chart"));
            });
    }

    private renderHourlyGenerationChart() {
        this.loadHeatmapData("generation", graphTypes.generation).then((result) => {
            const chartContainer = d3.select("#opwekking_heatmap_monthly");
            setCardTitle(chartContainer, "Opwek laatste 30 dagen");
            onCardTitleClick(chartContainer, () => {
                toggleGraphType("generation");
                this.renderHourlyGenerationChart();
            });

            heatMap(graphTypes.generation)
                .colors([
                    { color: "#000064", value: 0 },
                    { color: "#882200", value: 1 },
                    { color: generationGraphColor, value: 20 },
                    { color: "#aee61a", value: 40 },
                    { color: "#fbb421", value: 100 }
                ])
                .backgroundColor("black")
                .data(result)
                .unit("Wh")
                .tickFormat(formatMonthNames)
                .onClick((date: Date) => this.periodSelected(DayDescription.fromDate(date)))
                .draw(chartContainer.select(".chart"));
        });
    }

    private renderHourlyWaterUsageChart() {
        this.loadHeatmapData("water", graphTypes.water).then((result) => {
            const chartContainer = d3.select("#water_heatmap_monthly");
            setCardTitle(chartContainer, "Water laatste 30 dagen");
            onCardTitleClick(chartContainer, () => {
                toggleGraphType("water");
                this.renderHourlyWaterUsageChart();
            });

            const colors = graphTypes.water === "hourly_30_days" ? [
                                    { color: "white", value: 0 },
                                    { color: waterGraphColor, value: 50 },
                                    { color: darkWaterGraphColor, value: 100 }
                                ] : [
                                    { color: "white", value: 0 },
                                    { color: waterGraphColor, value: 20 },
                                    { color: darkWaterGraphColor, value: 100 }
                                ];

            heatMap(graphTypes.water)
                .colors(colors)
                .data(result)
                .unit("L")
                .tickFormat((value: Date) => getDate(value).toString())
                .onClick((date: Date) => this.periodSelected(DayDescription.fromDate(date)))
                .draw(chartContainer.select(".chart"));
        });
    }

    private loadHeatmapData(fieldName: UsageField, period: "hourly_30_days" | "hourly_year" | "last_year") {
        const query = period === "hourly_30_days" ? `/api/${fieldName}/hourly/30`
            : period === "hourly_year" ? `/api/${fieldName}/hourly/365`
                : `/api/${fieldName}/last_year`;

        return this.fetchLastMonthHeatMapData(query);
    }

    private async fetchLastMonthHeatMapData(query: string): Promise<ValueWithTimestamp[]> {
        return fetch(query)
            .then((response) => response.json())
            .then((json) => json.map(responseRowToValueWithTimestamp));
    }
}

function toggleGraphType(type: GraphType) {
    if (graphTypes[type] === "hourly_30_days") {
        graphTypes[type] = "hourly_year";
    } else {
        graphTypes[type] = "hourly_30_days";
    }
}
