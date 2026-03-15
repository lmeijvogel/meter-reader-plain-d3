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

export class Heatmaps {
    private _dataAlreadyLoaded = false;

    private graphTypes: { [key in GraphType]: "hourly_30_days" | "hourly_year" } = {
        gas: "hourly_30_days",
        stroom: "hourly_30_days",
        generation: "hourly_30_days",
        water: "hourly_30_days"
    };

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
            }).catch((err) => { console.error("Failed to load gas yearly heatmap:", err); });

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
            }).catch((err) => { console.error("Failed to load stroom yearly heatmap:", err); });

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
                    .data(result.map(r => ({ ...r, value: r.value / 1000 })))
                    .unit("kWh")
                    .tickFormat(formatMonthNames)
                    .onClick((date: Date) => this.periodSelected(DayDescription.fromDate(date)))
                    .draw(chartContainer.select(".chart"));
            }).catch((err) => { console.error("Failed to load generation yearly heatmap:", err); });

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
            }).catch((err) => { console.error("Failed to load water yearly heatmap:", err); });

            this.renderHourlyWaterUsageChart();
        }
        this._dataAlreadyLoaded = true;
    }

    private renderHourlyGasUsageChart() {
        this.loadHeatmapData("gas", this.graphTypes.gas).then((result) => {
            const chartContainer = d3.select("#gas_heatmap_monthly");
            setCardTitle(chartContainer, "Gas laatste 30 dagen");
            onCardTitleClick(chartContainer, () => {
                this.toggleGraphType("gas");
                this.renderHourlyGasUsageChart();
            });

            heatMap(this.graphTypes.gas)
                .colors([
                    { color: "white", value: 0 },
                    { color: "#fbb021", value: 16 },
                    { color: "#f68838", value: 30 },
                    { color: "#ee3e32", value: 70 },
                    { color: "#8a0000", value: 100 }
                ])
                .data(result)
                .unit("m³")
                .tickFormat(this.tickFormatForHourlyGraph("gas"))
                .onClick((date: Date) => this.periodSelected(DayDescription.fromDate(date)))
                .draw(chartContainer.select(".chart"));
        }).catch((err) => {
            console.error("Failed to load gas heatmap data:", err);
        });
    }

    private renderHourlyStroomUsageChart() {
        this.loadHeatmapData("stroom", this.graphTypes.stroom).then((result) => {
            const chartContainer = d3.select("#stroom_heatmap_monthly");
            setCardTitle(chartContainer, "Stroomvraag laatste 30 dagen");
            onCardTitleClick(chartContainer, () => {
                this.toggleGraphType("stroom");
                this.renderHourlyStroomUsageChart();
            });

            const colors = this.graphTypes.stroom === "hourly_30_days" ? [
                { color: "white", value: 0 },
                { color: stroomUsageGraphColor, value: 50 },
                { color: darkStroomUsageGraphColor, value: 100 }
            ] : [
                { color: "white", value: 0 },
                { color: stroomUsageGraphColor, value: 10 },
                { color: darkStroomUsageGraphColor, value: 100 }
            ];
            heatMap(this.graphTypes.stroom)
                .colors(colors)
                .min(0.1)
                .data(result)
                .unit("kWh")
                .tickFormat(this.tickFormatForHourlyGraph("stroom"))
                .onClick((date: Date) => this.periodSelected(DayDescription.fromDate(date)))
                .draw(chartContainer.select(".chart"));
        }).catch((err) => {
            console.error("Failed to load stroom heatmap data:", err);
        });
    }

    private renderHourlyGenerationChart() {
        this.loadHeatmapData("generation", this.graphTypes.generation).then((result) => {
            const chartContainer = d3.select("#opwekking_heatmap_monthly");
            setCardTitle(chartContainer, "Opwek laatste 30 dagen");
            onCardTitleClick(chartContainer, () => {
                this.toggleGraphType("generation");
                this.renderHourlyGenerationChart();
            });

            heatMap(this.graphTypes.generation)
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
                .tickFormat(this.tickFormatForHourlyGraph("generation"))
                .onClick((date: Date) => this.periodSelected(DayDescription.fromDate(date)))
                .draw(chartContainer.select(".chart"));
        }).catch((err) => {
            console.error("Failed to load generation heatmap data:", err);
        });
    }

    private renderHourlyWaterUsageChart() {
        this.loadHeatmapData("water", this.graphTypes.water).then((result) => {
            const chartContainer = d3.select("#water_heatmap_monthly");
            setCardTitle(chartContainer, "Water laatste 30 dagen");
            onCardTitleClick(chartContainer, () => {
                this.toggleGraphType("water");
                this.renderHourlyWaterUsageChart();
            });

            const colors = this.graphTypes.water === "hourly_30_days" ? [
                { color: "white", value: 0 },
                { color: waterGraphColor, value: 50 },
                { color: darkWaterGraphColor, value: 100 }
            ] : [
                { color: "white", value: 0 },
                { color: waterGraphColor, value: 20 },
                { color: darkWaterGraphColor, value: 100 }
            ];

            heatMap(this.graphTypes.water)
                .colors(colors)
                .data(result)
                .unit("L")
                .tickFormat(this.tickFormatForHourlyGraph("water"))
                .onClick((date: Date) => this.periodSelected(DayDescription.fromDate(date)))
                .draw(chartContainer.select(".chart"));
        }).catch((err) => {
            console.error("Failed to load water heatmap data:", err);
        });
    }

    private loadHeatmapData(fieldName: UsageField, period: "hourly_30_days" | "hourly_year" | "last_year") {
        const query = period === "hourly_30_days" ? `/api/${fieldName}/hourly/30`
            : period === "hourly_year" ? `/api/${fieldName}/hourly/365`
                : `/api/${fieldName}/last_year`;

        return this.fetchLastMonthHeatMapData(query);
    }

    private async fetchLastMonthHeatMapData(query: string): Promise<ValueWithTimestamp[]> {
        const response = await fetch(query);
        if (!response.ok) throw new Error(`Failed to fetch ${query}: ${response.status}`);
        const json = await response.json();
        return json.map(responseRowToValueWithTimestamp);
    }

    private toggleGraphType(type: GraphType) {
        if (this.graphTypes[type] === "hourly_30_days") {
            this.graphTypes[type] = "hourly_year";
        } else {
            this.graphTypes[type] = "hourly_30_days";
        }
    }

    private tickFormatForHourlyGraph(type: GraphType) {
        if (this.graphTypes[type] === "hourly_30_days") {
            return (value: Date) => getDate(value).toString();
        } else {
            return formatMonthNames;
        }
    }
}
