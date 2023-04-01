import * as d3 from "d3";
import { barChart, BarChartApi } from "./charts/barChart";
import { lineChart, LineChartApi } from "./charts/lineChart";
import { usageAndGenerationBarChart, UsageAndGenerationBarChartApi } from "./charts/usageAndGenerationBarChart";
import { PriceCalculator } from "./lib/PriceCalculator";
import { JsonResponseRow, responseRowToValueWithTimestamp } from "./lib/responseRowToValueWithTimestamp";
import { ValueWithTimestamp } from "./models/ValueWithTimestamp";
import { initializeNavigation, NavigationApi } from "./navigation";
import { initKeyboardListener } from "./initKeyboardListener";
import {
    gasGraphColor,
    stroomGenerationColor,
    waterGraphColor,
} from "./colors";
import { createRowsWithCards } from "./lib/createRowsWithCards";
import { Thermometer } from "./charts/thermometer";
import { PeriodDescription } from "./models/periodDescriptions/PeriodDescription";
import { fetchAndDrawGenerationGraph } from "./periodDataFetchers/fetchAndDrawGenerationGraph";
import { fetchAndDrawWaterChart } from "./periodDataFetchers/fetchAndDrawWaterChart";
import { fetchAndDrawGasChart } from "./periodDataFetchers/fetchAndDrawGasGraph";
import { fetchAndDrawStroomGraph } from "./periodDataFetchers/fetchAndDrawStroomGraph";
import { fetchAndDrawTemperatureChart } from "./periodDataFetchers/fetchAndDrawTemperatureChart";

type Graphs = "gas" | "stroom" | "water" | "temperature" | "generation";

const enabledGraphs: Graphs[] = ["gas", "stroom", "water", "temperature", "generation"];

export class PeriodDataTab {
    private navigation: NavigationApi | null = null;

    private periodDescription: PeriodDescription;

    private readonly priceCalculator = new PriceCalculator();

    private _isNavigationInitialized = false;

    wasLoaded = false;

    private readonly stroomChartApi: UsageAndGenerationBarChartApi;
    private readonly waterChartApi: BarChartApi;
    private readonly gasChartApi: BarChartApi;
    private readonly generationBarChartApi: BarChartApi;
    private readonly temperatureChartApi: LineChartApi;

    private readonly thermometer = new Thermometer();

    constructor(initialPeriod: PeriodDescription, private readonly updateLocation: (path: string) => void) {
        this.periodDescription = initialPeriod;

        this.stroomChartApi = usageAndGenerationBarChart();

        this.waterChartApi = barChart()
            .onClick(this.retrieveAndDrawPeriodCharts)
            .color(waterGraphColor);

        this.gasChartApi = barChart()
            .onClick(this.retrieveAndDrawPeriodCharts)
            .color(gasGraphColor);

        this.generationBarChartApi = barChart()
            .onClick(this.retrieveAndDrawPeriodCharts)
            .color(stroomGenerationColor);

        this.temperatureChartApi = lineChart().minMaxCalculation("minMax");

        initKeyboardListener(this.retrieveAndDrawPeriodCharts, () => this.periodDescription);
    }

    initializePage(selector: string) {
        const element = document.querySelector(selector);

        if (!element) return;

        element.innerHTML = this.html();

        createRowsWithCards(
            [
                ["gas_period_data", "stroom_period_data", "water_period_data"],
                ["generation_period_data", "temperature_line_chart"]
            ],
            "#periodDataRows"
        );
    }

    tabSelected() {
        this.initializeNavigation();
        this.retrieveAndDrawPeriodCharts(this.periodDescription);
    }

    initializeNavigation() {
        if (!this._isNavigationInitialized) {
            this.navigation = initializeNavigation(this.retrieveAndDrawPeriodCharts);

            /* Hide navigation by default */
            this.navigation.hide();
        }

        this._isNavigationInitialized = true;
    }

    retrieveAndDrawPeriodCharts = (periodDescription: PeriodDescription) => {
        this.updateLocation(`/period${periodDescription.toUrl()}`);

        if (this.wasLoaded && this.periodDescription && periodDescription.equals(this.periodDescription)) {
            return;
        }

        this.wasLoaded = true;

        /* This gets a special place because the temperature
         * is also used by the gas graph, and I don't want to retrieve
         * the data twice.
         */
        const temperatureCard = d3.select("#temperature_line_chart");
        const temperatureRequest = fetchTemperatureData(periodDescription, temperatureCard);

        this.navigation?.setPeriodDescription(periodDescription);

        const shouldClearCanvas = this.periodDescription?.period !== periodDescription.period;

        if (enabledGraphs.includes("gas")) {
            fetchAndDrawGasChart(periodDescription, temperatureRequest, this.gasChartApi, this.thermometer, shouldClearCanvas, this.priceCalculator);
        }

        if (enabledGraphs.includes("water")) {
            fetchAndDrawWaterChart(periodDescription, this.waterChartApi, shouldClearCanvas, this.priceCalculator);
        }

        if (enabledGraphs.includes("generation")) {
            fetchAndDrawGenerationGraph(periodDescription, this.generationBarChartApi, this.priceCalculator, shouldClearCanvas);
        }

        if (enabledGraphs.includes("stroom")) {
            fetchAndDrawStroomGraph(periodDescription, this.stroomChartApi, shouldClearCanvas, this.priceCalculator);
        }

        if (enabledGraphs.includes("temperature")) {
            fetchAndDrawTemperatureChart(periodDescription, temperatureRequest, this.temperatureChartApi, temperatureCard);
        }

        this.periodDescription = periodDescription;
    };

    private html(): string {
        /* Note: The 'periodDataRows' section must be inside the navigation overlay, because
         * otherwise it won't pick up the touch events for navigation.
         */
        return `
            <div id="js-navigate-overlay" class="navigationOverlay js-navigate-overlay">
                <section id="periodDataRows"></section>
                <div class="upButtonsContainer js-navigate-up js-buttons-top visible">
                    <button class="label"><i icon-name="chevron-up"></i></button>
                </div>
                <div class="title-container js-page-title-container">
                    <h1 class="pageTitle js-page-title"></h1>
                </div>
                <div class="sideButtonsContainer prevButton js-navigate-prev js-buttons-left">
                    <button class="label"><i icon-name="chevron-left"></i></button>
                </div>
                <div class="sideButtonsContainer forwardButtons js-buttons-right">
                    <div class="forwardButton nextButton js-navigate-next">
                        <button class="label"><i icon-name="chevron-right"></i></button>
                    </div>
                    <div class="forwardButton todayButton js-navigate-today">
                        <button class="label"><i icon-name="chevron-last"></i></button>
                    </div>
                </div>
            </div>
        `;
    }
}

async function fetchTemperatureData(
    periodDescription: PeriodDescription,
    card: d3.Selection<d3.BaseType, unknown, HTMLElement, any>
): Promise<Map<string, ValueWithTimestamp[]>> {
    card.classed("loading", true);

    const url = periodDescription.toUrl();

    const result = new Map();

    try {
        const response = await fetch(`/api/temperature/living_room${url}`);
        const json: { [key: string]: JsonResponseRow[] } = await response.json();

        Object.entries(json).forEach((keyAndSeries) => {
            const [key, rawSeries] = keyAndSeries;
            const series = rawSeries.map(responseRowToValueWithTimestamp);

            result.set(key, series);
        });
    } finally {
        card.classed("loading", false);
    }

    return result;
}
