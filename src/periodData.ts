import * as d3 from "d3";
import { isEqual } from "date-fns";
import { barChart, BarChartApi } from "./charts/barChart";
import { lineChart, LineChartApi } from "./charts/lineChart";
import { usageAndGenerationBarChart, UsageAndGenerationBarChartApi } from "./charts/usageAndGenerationBarChart";
import { PriceCalculator, PriceCategory } from "./lib/PriceCalculator";
import { JsonResponseRow, responseRowToValueWithTimestamp } from "./lib/responseRowToValueWithTimestamp";
import {
    GasGraphDescription,
    WaterGraphDescription,
    StroomGraphDescription,
    GraphDescription,
    GenerationGraphDescription,
    TemperatuurGraphDescription
} from "./models/GraphDescription";
import { ValueWithTimestamp } from "./models/ValueWithTimestamp";
import { initializeNavigation, NavigationApi } from "./navigation";
import { setCardTitle, setCardTitleRaw } from "./vizCard";
import { initKeyboardListener } from "./initKeyboardListener";
import {
    gasGraphColor,
    stroomGenerationColor,
    temperatuurHuiskamerColor,
    temperatuurTuinkamerColor,
    temperatuurZolderColor,
    waterGraphColor,
} from "./colors";
import { createRowsWithCards } from "./lib/createRowsWithCards";
import { Thermometer } from "./charts/thermometer";
import { PeriodDescription } from "./models/periodDescriptions/PeriodDescription";
import { ChartDataResult, fetchChartData } from "./periodDataFetchers/fetchChartData";
import { createPeriodDataCardTitle } from "./createPeriodDataCardTitle";
import { fetchAndDrawGenerationGraph } from "./periodDataFetchers/fetchAndDrawGenerationGraph";
import { fetchAndDrawWaterChart } from "./periodDataFetchers/fetchAndDrawWaterChart";
import { fetchAndDrawGasChart } from "./periodDataFetchers/fetchAndDrawGasGraph";
import { fetchAndDrawStroomGraph } from "./periodDataFetchers/fetchAndDrawStroomGraph";

type Graphs = "gas" | "stroom" | "water" | "temperature" | "generation";

const enabledGraphs: Graphs[] = ["gas", "stroom", "water", "temperature", "generation"];

export class PeriodDataTab {
    private navigation: NavigationApi | null = null;

    private periodDescription: PeriodDescription;

    private readonly priceCalculator = new PriceCalculator();

    /* Store the requested period to prevent older requests "overtaking" newer requests and being rendered
     * when the newer ones should be rendered.
     */
    private requestedStartOfPeriod: Date | null = null;
    private _isNavigationInitialized = false;

    wasLoaded = false;

    private readonly waterChartApi: BarChartApi;
    private readonly gasChartApi: BarChartApi;
    private readonly generationBarChartApi: BarChartApi;
    private readonly temperatureChartApi: LineChartApi;

    private readonly thermometer = new Thermometer();

    constructor(initialPeriod: PeriodDescription, private readonly updateLocation: (path: string) => void) {
        this.periodDescription = initialPeriod;

        const stroomGraphDescription = new StroomGraphDescription(this.periodDescription);

        const gasGraphDescription = new GasGraphDescription(this.periodDescription);
        const waterGraphDescription = new WaterGraphDescription(this.periodDescription);
        const generationGraphDescription = new GenerationGraphDescription(this.periodDescription);
        const temperatureGraphDescription = new TemperatuurGraphDescription(this.periodDescription);

        this.stroomChartApi = usageAndGenerationBarChart(this.periodDescription, stroomGraphDescription);

        this.waterChartApi = barChart(this.periodDescription, waterGraphDescription)
            .onClick(this.retrieveAndDrawPeriodCharts)
            .color(waterGraphColor);

        this.gasChartApi = barChart(this.periodDescription, gasGraphDescription)
            .onClick(this.retrieveAndDrawPeriodCharts)
            .color(gasGraphColor);

        this.generationBarChartApi = barChart(this.periodDescription, generationGraphDescription)
            .onClick(this.retrieveAndDrawPeriodCharts)
            .color(stroomGenerationColor);

        this.temperatureChartApi = lineChart(this.periodDescription, temperatureGraphDescription).minMaxCalculation(
            "minMax"
        );

        initKeyboardListener(this.retrieveAndDrawPeriodCharts, () => this.periodDescription);
    }

    initializePage(selector: string) {
        document.querySelector(selector)!.innerHTML = this.html();
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

        this.requestedStartOfPeriod = periodDescription.startOfPeriod();

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
            const temperatureCard = d3.select("#temperature_line_chart");

            if (!temperatureCard.select(".thermometer").node()) {
                const thermometerCard = temperatureCard.select(".chart").append("g");
                thermometerCard.attr("class", "thermometer");
            }

            const chartContainer = temperatureCard.select(".chart");
            setCardTitle(temperatureCard, "Binnentemperatuur");

            temperatureRequest.then((result) => {
                const graphDescription = new TemperatuurGraphDescription(periodDescription);

                this.temperatureChartApi.periodDescription(periodDescription).graphDescription(graphDescription);

                [
                    ["huiskamer", temperatuurHuiskamerColor],
                    ["zolder", temperatuurZolderColor],
                    ["tuinkamer", temperatuurTuinkamerColor]
                ].forEach(([key, color]) => {
                    const series = result.get(key);

                    if (series) {
                        this.temperatureChartApi.setSeries(key, series, color);
                    }
                });
                chartContainer.call(this.temperatureChartApi.call);
            });
        }

        this.periodDescription = periodDescription;
    };

    private isMeasurementValid(values: ChartDataResult) {
        if (!this.requestedStartOfPeriod) {
            return false;
        }

        return isEqual(this.requestedStartOfPeriod, values.requestedPeriodDescription.startOfPeriod());
    }
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
